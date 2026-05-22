'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { AlertTriangle, MapPin, CheckCircle, Navigation } from 'lucide-react';
import { useCartStore } from '@/store/cartStore'; // สมมติว่ามี cart store อยู่แล้วที่ path นี้

// โหลด Leaflet แบบ Dynamic เพื่อป้องกัน Error 'window is not defined' บน Next.js (SSR)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });

// สูตร Haversine Formula สำหรับหาระยะห่างระหว่างพิกัด (ส่งค่ากลับมาเป็นกิโลเมตร)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // รัศมีโลกหน่วยเป็นกิโลเมตร
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function CheckoutClient({ branch, user, savedLocation }: { branch: any, user: any, savedLocation: { lat: number, lng: number } | null }) {
  // ตั้งค่าพิกัดเริ่มต้น (ถ้าไม่มีพิกัดเก่า จะใช้พิกัดของสาขาก่อนชั่วคราว)
  const fallbackCenter = { lat: Number(branch?.lat || 13.7563), lng: Number(branch?.lng || 100.5018) };
  
  const [markerPos, setMarkerPos] = useState(savedLocation || fallbackCenter);
  const [distanceKm, setDistanceKm] = useState<number>(0);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { items, getTotalPrice, clearCart } = useCartStore();
  const router = useRouter();
  
  const markerRef = useRef<any>(null);

  // ควบคุมรัศมีบริการ (ถ้าไม่มีข้อมูลใน DB อนุโลมให้ Default เป็น 15 กม.)
  const SERVICE_RADIUS = branch?.service_radius || 15; 

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // จุดติดตั้งฟังก์ชัน: (1) ดึงตำแหน่งปัจจุบันของลูกค้าผ่าน HTML5 Geolocation
  useEffect(() => {
    // หากลูกค้าไม่เคยมีพิกัดที่บันทึกไว้ ให้ขอสิทธิ์ Location เพื่อดึงพิกัดล่าสุด
    if (!savedLocation && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const currentLoc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setMarkerPos(currentLoc); // ขยับหมุดไปหาลูกค้าอัตโนมัติ
          setIsLocating(false);
        },
        (error) => {
          console.warn('Geolocation ถูกปฏิเสธหรือไม่สามารถใช้งานได้', error);
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    }
  }, [savedLocation]);

  // จุดติดตั้งฟังก์ชัน: (2) คำนวณระยะทางเมื่อหมุดเปลี่ยนที่ หรือ แผนที่โหลดเสร็จ
  useEffect(() => {
    if (branch?.lat && branch?.lng && markerPos) {
      const dist = calculateDistance(
        Number(branch.lat), 
        Number(branch.lng), 
        markerPos.lat, 
        markerPos.lng
      );
      setDistanceKm(dist);
    }
  }, [markerPos, branch]);

  // ตัวแปรตรวจสอบสิทธิ์ปุ่ม (True = อยู่ในระยะ / False = อยู่นอกระยะ)
  const isWithinRadius = distanceKm <= SERVICE_RADIUS;

  // Event ลากหมุด (Draggable Marker)
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          setMarkerPos({ lat: newPos.lat, lng: newPos.lng }); // บันทึก State ใหม่เมื่อปล่อยเมาส์
        }
      },
    }),
    []
  );

  const handleConfirmOrder = async () => {
    if (!isWithinRadius || items.length === 0) return;
    setIsSaving(true);

    try {
      // 1. บันทึกพิกัดล่าสุดของลูกค้ากลับลง Profile
      await supabase
        .from('users')
        .update({ lat: markerPos.lat.toString(), lng: markerPos.lng.toString() })
        .eq('id', user.id);

      // 2. เรียก API เพื่อสร้างออเดอร์
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch_id: branch.id,
          total_price: getTotalPrice(),
          customer_info: {
            name: user.user_metadata?.full_name || user.email,
            phone: user.phone || '',
          },
          lat: markerPos.lat,
          lng: markerPos.lng,
          items: items.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            price: item.price,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'ไม่สามารถสร้างออเดอร์ได้');
      }

      // 3. หากสำเร็จ ให้ล้างตะกร้าและ Redirect
      clearCart();
      alert(`สร้างออเดอร์สำเร็จ! หมายเลขคำสั่งซื้อ: ${result.orderId.slice(0, 8).toUpperCase()}`);
      router.push(`/checkout/success?orderId=${result.orderId}`); // ไปยังหน้า Success
    } catch (error: any) {
      console.error("Failed to confirm order:", error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">ยืนยันการสั่งซื้อ</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            ระบุพิกัดจัดส่งของคุณ
          </h2>
        </div>
        
        {/* Interactive Map */}
        <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-300 relative z-0 mb-4">
          {isLocating && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
              <Navigation className="w-8 h-8 text-blue-600 animate-spin mb-2" />
              <span className="text-blue-800 font-medium">กำลังค้นหาตำแหน่งของคุณ...</span>
            </div>
          )}
          <MapContainer center={markerPos} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            {/* หมุดของลูกค้า (ลากได้) */}
            <Marker position={markerPos} draggable={true} ref={markerRef} eventHandlers={eventHandlers} />
            
            {/* วงกลมจำลองรัศมีสาขา */}
            <Circle 
              center={[Number(branch.lat), Number(branch.lng)]} 
              radius={SERVICE_RADIUS * 1000} // แปลงกิโลเมตรเป็นเมตร
              pathOptions={{ fillColor: 'blue', color: 'blue', fillOpacity: 0.1, weight: 1 }} 
            />
          </MapContainer>
        </div>

        {/* กล่องแจ้งเตือน (Alert Box) กรณีอยู่นอกพื้นที่ */}
        {!isWithinRadius ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3 items-start mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-800 text-sm md:text-base">อยู่นอกพื้นที่ให้บริการของสาขา</h3>
              <p className="text-red-600 text-sm mt-1">
                ขออภัย ที่อยู่จัดส่งของคุณอยู่นอกพื้นที่ให้บริการของสาขานี้ <br className="hidden md:block" />
                (ระยะทาง {distanceKm.toFixed(2)} กม. / รัศมีบริการ {SERVICE_RADIUS} กม.)
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 items-center mb-4">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-green-800 text-sm font-medium">
              สามารถจัดส่งได้ (ระยะทางจากสาขา: {distanceKm.toFixed(2)} กม.)
            </p>
          </div>
        )}

        {/* ปุ่มยืนยันการสั่งซื้อ */}
        <button 
          onClick={handleConfirmOrder}
          disabled={!isWithinRadius || isSaving}
          className={`w-full py-3.5 rounded-xl font-semibold transition-colors shadow-sm flex justify-center items-center gap-2 ${
            isWithinRadius && !isSaving
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
          }`}
        >
          {isSaving ? 'กำลังบันทึกข้อมูล...' : 'ยืนยันการสั่งซื้อและชำระเงิน'}
        </button>
      </div>
    </div>
  );
}