'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useBranchStore } from '@/store/branchStore';
import dynamic from 'next/dynamic';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, Minus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

// โหลด CheckoutMap แบบ Dynamic (ปิด SSR) ป้องกัน Window is not defined
const CheckoutMap = dynamic(() => import('@/components/maps/CheckoutMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-slate-100 flex items-center justify-center rounded-xl animate-pulse">
      <p className="text-slate-500 font-medium">กำลังโหลดแผนที่...</p>
    </div>
  ),
});

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

export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const getTotalPrice = useCartStore((state) => state.getTotalPrice);
  const clearCart = useCartStore((state) => state.clearCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const { activeBranchId } = useBranchStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false); // เพิ่ม State เช็คว่าสั่งซื้อสำเร็จหรือยัง
  const [user, setUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isMounted, setIsMounted] = useState(false); // เพิ่ม State สำหรับรอโหลดข้อมูล

  // State สำหรับเก็บข้อมูลลูกค้า
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  // State สำหรับพิกัดแผนที่ (Default: กรุงเทพฯ กรณีไม่มีข้อมูล)
  const [location, setLocation] = useState<{ lat: number; lng: number }>({
    lat: 13.7563,
    lng: 100.5018,
  });
  const [isLocating, setIsLocating] = useState(true);

  const [branchData, setBranchData] = useState<any>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ระบุว่าโหลดฝั่ง Client และกู้คืนข้อมูลตะกร้าเสร็จเรียบร้อยแล้ว
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ป้องกันการเข้าหน้า Checkout เมื่อตะกร้าว่าง และตรวจสอบสถานะ Auth แบบเงียบๆ
  useEffect(() => {
    if (!isMounted) return; // รอให้ดึงข้อมูลจาก LocalStorage ให้เสร็จก่อน
    if (items.length === 0 && !isSuccess) { // เพิ่ม && !isSuccess ตรงนี้
      router.push('/');
      return;
    }

    const checkAuth = async () => {
      setIsAuthChecking(true);
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setIsAuthChecking(false);
    };
    checkAuth();
  }, [items, router, supabase.auth, isSuccess, isMounted]); // เพิ่ม isMounted ใน Dependency Array

  // ดึงตำแหน่งปัจจุบันของลูกค้า
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          setIsLocating(false);
        },
        (error) => {
          console.warn('Geolocation ถูกปฏิเสธหรือไม่สามารถใช้งานได้', error);
          setIsLocating(false); // ถ้าปฏิเสธ ให้ใช้ค่าเริ่มต้นแทน
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsLocating(false);
    }
  }, []);

  // ดึงข้อมูลสาขาเพื่อเอารัศมีและพิกัด
  useEffect(() => {
    const fetchBranch = async () => {
      if (!activeBranchId) return;
      const { data } = await supabase
        .from('branches')
        .select('lat, lng, service_radius')
        .eq('id', activeBranchId)
        .single();
      if (data) setBranchData(data);
    };
    fetchBranch();
  }, [activeBranchId, supabase]);

  // คำนวณระยะทางเมื่อพิกัดจัดส่งหรือข้อมูลสาขาเปลี่ยน
  useEffect(() => {
    if (branchData?.lat && branchData?.lng && location) {
      const dist = calculateDistance(Number(branchData.lat), Number(branchData.lng), location.lat, location.lng);
      setDistanceKm(dist);
    }
  }, [branchData, location]);

  const serviceRadius = branchData?.service_radius || 15;
  const isWithinRadius = distanceKm !== null && distanceKm <= serviceRadius;

  // เรียกใช้ API เพื่อคำนวณค่าจัดส่งเมื่อระยะทางเปลี่ยน
  useEffect(() => {
    const fetchDeliveryFee = async () => {
      if (distanceKm !== null && isWithinRadius) {
        setIsCalculatingFee(true);
        try {
          const res = await fetch('/api/calculate-fee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ distance: distanceKm }),
          });
          if (res.ok) {
            const data = await res.json();
            setDeliveryFee(data.fee);
          } else {
            // Fallback กรณี API มีปัญหา: คิดกิโลเมตรละ 10 บาท
            setDeliveryFee(Math.ceil(distanceKm * 10));
          }
        } catch (error) {
          console.error('Error fetching delivery fee:', error);
          setDeliveryFee(Math.ceil(distanceKm * 10));
        } finally {
          setIsCalculatingFee(false);
        }
      } else {
        setDeliveryFee(0);
      }
    };
    fetchDeliveryFee();
  }, [distanceKm, isWithinRadius]);

  // ฟังก์ชันอัปเดตแบบฟอร์ม
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ฟังก์ชันหลัก: สั่งซื้อและบันทึกลง Database
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranchId) return alert('ไม่พบข้อมูลสาขา กรุณาเลือกสาขาใหม่');
    if (distanceKm !== null && !isWithinRadius) return alert('ที่อยู่ของคุณอยู่นอกพื้นที่ให้บริการของสาขานี้');

    setIsSubmitting(true);

    try {
      // 1. บันทึกข้อมูลลงตาราง orders
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: Number(activeBranchId), // ตารางต้องการ bigint
          customer_id: user?.id, // บันทึกไอดีลูกค้าลง Database
            total_price: getTotalPrice() + deliveryFee,
          lat: location.lat,
          lng: location.lng,
            customer_info: { ...formData, delivery_fee: deliveryFee, distance_km: distanceKm }, // เก็บเป็น JSONB ตามโครงสร้าง Database
          status: 'pending',
        })
        .select('id')
        .single();

      if (orderError || !orderData) throw new Error(orderError?.message || 'ไม่สามารถสร้างคำสั่งซื้อได้');

      // 2. บันทึกข้อมูลสินค้าลงตาราง order_items
      const orderItems = items.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_purchase: item.price, // ตาม Database Schema กำหนดเป็น character varying
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw new Error(itemsError.message);

      // 3. สำเร็จ: ล้างตะกร้าและเปลี่ยนหน้า
      setIsSuccess(true); // เซ็ตค่าเป็น true เพื่อล็อกไม่ให้ useEffect เตะกลับหน้าแรก
      clearCart();
      router.push(`/checkout/success?orderId=${orderData.id}`); // แนบ orderId ไปด้วย

    } catch (error: any) {
      console.error('Error placing order:', error);
      alert('เกิดข้อผิดพลาดในการสั่งซื้อ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) return null; // ซ่อน UI ระหว่างรอข้อมูลตะกร้า
  if (items.length === 0 && !isSuccess) return null; // ป้องกัน UI กะพริบก่อนถูก Redirect

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* ฝั่งซ้าย: ฟอร์มที่อยู่ และ แผนที่ปักหมุด */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6">ข้อมูลสำหรับจัดส่ง</h2>
            
            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="ระบุชื่อผู้รับ" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                  <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="08X-XXX-XXXX" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่จัดส่ง (รายละเอียด)</label>
                <textarea required name="address" value={formData.address} onChange={handleChange} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="บ้านเลขที่, ซอย, ถนน, ตำบล, อำเภอ..." />
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-slate-800 mb-2">ปักหมุดตำแหน่งจัดส่ง</h2>
            <p className="text-sm text-gray-500 mb-6">เลื่อนหมุดสีน้ำเงินไปยังตำแหน่งที่ต้องการให้พนักงานไปส่งสินค้า</p>
            <div className="relative min-h-[350px]">
              {isLocating ? (
                <div className="absolute inset-0 z-10 bg-slate-50 flex items-center justify-center rounded-xl border border-gray-100">
                  <p className="text-blue-600 font-medium animate-pulse">📍 กำลังค้นหาตำแหน่งปัจจุบันของคุณ...</p>
                </div>
              ) : (
                <CheckoutMap 
                  initialPosition={[location.lat, location.lng]} 
                  onLocationChange={(lat, lng) => setLocation({ lat, lng })} 
                />
              )}
            </div>

            {/* กล่องแจ้งเตือนระยะทาง */}
            {distanceKm !== null && (
              !isWithinRadius ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-3 items-start mt-4">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-red-800 text-sm">อยู่นอกพื้นที่ให้บริการ</h3>
                    <p className="text-red-600 text-xs mt-1">
                      ระยะทาง {distanceKm.toFixed(2)} กม. (รัศมีบริการ {serviceRadius} กม.)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-3 items-center mt-4">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-green-800 text-sm font-medium">
                    สามารถจัดส่งได้ (ระยะทาง: {distanceKm.toFixed(2)} กม.)
                  </p>
                </div>
              )
            )}
          </div>
        </div>

        {/* ฝั่งขวา: สรุปคำสั่งซื้อ (Order Summary) */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6">สรุปคำสั่งซื้อ</h2>
            
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.id} className="flex flex-col border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                      <h3 className="font-medium text-gray-800 line-clamp-2">{item.name}</h3>
                      <div className="text-sm font-semibold text-blue-600 mt-1">฿{item.price.toLocaleString()}</div>
                    </div>
                    <div className="font-semibold text-gray-800">
                      ฿{(item.price * item.quantity).toLocaleString()}
                    </div>
                  </div>
                  {/* ส่วนควบคุมจำนวนสินค้า */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 w-fit">
                      <button type="button" title="ลดจำนวน" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm rounded transition-all">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                      <button type="button" title="เพิ่มจำนวน" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm rounded transition-all">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium">
                      <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">ลบ</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>ค่าสินค้า</span>
                <span>฿{getTotalPrice().toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
              <span>ค่าจัดส่ง (ระยะทาง {distanceKm !== null ? distanceKm.toFixed(1) : 0} กม.)</span>
              <span>{isCalculatingFee ? 'กำลังคำนวณ...' : `฿${deliveryFee.toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-blue-600 pt-2 border-t border-gray-200">
                <span>ยอดรวมทั้งสิ้น</span>
              <span>฿{(getTotalPrice() + deliveryFee).toLocaleString()}</span>
              </div>
            </div>

            {/* ตรวจสอบเงื่อนไขเพื่อแสดงปุ่ม Login หรือ ปุ่มยืนยันการสั่งซื้อ */}
            {isAuthChecking ? (
              <button type="button" disabled className="w-full bg-gray-100 text-gray-400 py-3 px-4 rounded-xl font-medium flex justify-center items-center cursor-not-allowed">
                กำลังตรวจสอบสิทธิ์...
              </button>
            ) : !user ? (
              <Link href="/login?returnTo=/checkout" className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition shadow-sm flex justify-center items-center">
                เข้าสู่ระบบเพื่อยืนยันการสั่งซื้อ
              </Link>
            ) : (
              <button
                type="submit"
                form="checkout-form"
              disabled={isSubmitting || (distanceKm !== null && !isWithinRadius) || isCalculatingFee}
              className={`w-full py-3 px-4 rounded-xl font-medium transition shadow-sm flex justify-center items-center ${
                (distanceKm !== null && !isWithinRadius) || isCalculatingFee ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed'
                }`}
              >
                {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการสั่งซื้อ'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}