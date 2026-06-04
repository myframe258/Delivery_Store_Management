'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useBranchStore } from '@/store/branchStore';
import dynamic from 'next/dynamic';
import { compressImage } from '@/lib/utils/imageCompression';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, Minus, Trash2, AlertCircle, CheckCircle, Store, Truck, MapPin as MapPinIcon, Info, Home, Navigation, QrCode, Wallet, UploadCloud, Loader2 } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

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

interface Address {
  id: string;
  title: string;
  address_text: string;
  lat: number;
  lng: number;
  is_default: boolean;
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
  const [liveProducts, setLiveProducts] = useState<any[]>([]);
  const [isPriceValidating, setIsPriceValidating] = useState(true);

  // State สำหรับเก็บรูปแบบการรับสินค้า (Delivery / Pickup)
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');

  // State สำหรับเก็บข้อมูลลูกค้า
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  // เพิ่ม State สำหรับระบบชำระเงิน
  const [paymentMethod, setPaymentMethod] = useState<'promptpay' | 'cod'>('promptpay');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  // Address Book States
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveToAddressBook, setSaveToAddressBook] = useState(true);

  // State สำหรับวันและรอบจัดส่ง
  const [deliveryDate, setDeliveryDate] = useState<string>('');
  const [deliverySlot, setDeliverySlot] = useState<string>('');
  const [slots, setSlots] = useState<any[]>([]);
  const [minDateStr, setMinDateStr] = useState<string>('');
  const [currentHour, setCurrentHour] = useState<number>(0);

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

  // แปลงวันที่ปัจจุบันเป็น YYYY-MM-DD แบบปลอดภัยไม่ติด Timezone เพี้ยน
  const todayObj = new Date();
  const todayStr = new Date(todayObj.getTime() - (todayObj.getTimezoneOffset() * 60 * 1000)).toISOString().split('T')[0];

  // 1. ดึงข้อมูลรอบจัดส่งจาก Database
  useEffect(() => {
    const now = new Date();
    setCurrentHour(now.getHours());

    const fetchSlots = async () => {
      const { data } = await supabase
        .from('delivery_slots')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setSlots(data);
    };
    fetchSlots();
  }, []);

  // 2. คำนวณวันที่เริ่มต้นที่เลือกได้ (minDate) ตามเวลาตัดรอบ (Cut-off) ของช่องทางที่เลือก
  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();

    const minDateObj = new Date(now);

    // หารอบจัดส่งที่ตรงกับวิธีที่ลูกค้าเลือก
    const relevantSlots = slots.filter(s => !s.slot_type || s.slot_type === 'both' || s.slot_type === deliveryMethod);

    // หาเวลาตัดรอบที่ช้าที่สุดของวิธีนั้นๆ (ถ้าไม่มีให้ใช้ 12)
    let maxCutOff = 12;
    if (relevantSlots.length > 0) {
      maxCutOff = Math.max(...relevantSlots.map(s => s.cut_off_hour));
    }

    // หากเวลาปัจจุบัน เลยเวลาตัดรอบสุดท้ายของวันไปแล้ว ให้บังคับเริ่มเลือกวันพรุ่งนี้แทน
    if (hour >= maxCutOff) {
      minDateObj.setDate(minDateObj.getDate() + 1);
    }

    const offset = minDateObj.getTimezoneOffset();
    const localDate = new Date(minDateObj.getTime() - (offset * 60 * 1000));
    const calculatedMinDate = localDate.toISOString().split('T')[0];

    setMinDateStr(calculatedMinDate);

    // หากมีการเลือกวันที่ไว้แล้ว แต่วันที่เลือกน้อยกว่าที่ควรจะเป็น ให้รีเซ็ตค่า
    if (deliveryDate && deliveryDate < calculatedMinDate) {
      setDeliveryDate('');
      setDeliverySlot('');
    }
  }, [slots, deliveryMethod, deliveryDate]);

  // รีเซ็ตรอบที่เลือกอัตโนมัติ ถ้าผู้ใช้คลิกเปลี่ยนมาเลือก "วันนี้" แล้วรอบนั้นเลยเวลาตัดรอบ (cut_off_hour) ไปแล้ว
  useEffect(() => {
    if (deliveryDate === todayStr && deliverySlot) {
      const selectedSlotObj = slots.find(s => s.id === deliverySlot);
      if (selectedSlotObj && currentHour >= selectedSlotObj.cut_off_hour) {
        setDeliverySlot('');
      }
    }

    // รีเซ็ตหากเปลี่ยนวิธีรับของแล้วรอบที่เลือกไว้ไม่รองรับ
    const slotObj = slots.find(s => s.id === deliverySlot);
    if (slotObj && slotObj.slot_type && slotObj.slot_type !== 'both' && slotObj.slot_type !== deliveryMethod) {
      setDeliverySlot('');
    }
  }, [deliveryDate, todayStr, currentHour, deliverySlot, slots, deliveryMethod]);

  // ระบุว่าโหลดฝั่ง Client และกู้คืนข้อมูลตะกร้าเสร็จเรียบร้อยแล้ว
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ดึงราคาล่าสุดจาก Database เพื่อป้องกันการแก้ค่าจาก Local Storage
  useEffect(() => {
    const validatePrices = async () => {
      if (!activeBranchId || items.length === 0) {
        setIsPriceValidating(false);
        return;
      }
      
      setIsPriceValidating(true);
      const productIds = items.map((item: any) => item.id);
      
      try {
        const { data, error } = await supabase
          .from('branch_inventory')
          .select('product_id, discount_price, products(price)')
          .eq('branch_id', activeBranchId)
          .in('product_id', productIds);

        if (!error && data) {
          const liveData = data.map(inv => ({
            id: inv.product_id,
            price: Array.isArray(inv.products) ? inv.products[0]?.price : (inv.products as any)?.price,
            discount_price: inv.discount_price
          }));
          setLiveProducts(liveData);
        }
      } catch (err) {
        console.error("Price validation error:", err);
      } finally {
        setIsPriceValidating(false);
      }
    };

    if (isMounted) validatePrices();
  }, [activeBranchId, isMounted, supabase, items]);

  // สร้างข้อมูลตะกร้าที่เทียบราคาล่าสุดแล้ว
  const effectiveCartItems = useMemo(() => {
    return items.map((cartItem: any) => {
      const liveProduct = liveProducts.find(p => p.id === cartItem.id);
      const currentPrice = liveProduct ? (liveProduct.discount_price ?? liveProduct.price) : cartItem.price;
      const originalPrice = liveProduct ? liveProduct.price : cartItem.price;
      const isDiscounted = liveProduct ? !!liveProduct.discount_price : false;
      const priceChanged = liveProduct && currentPrice !== cartItem.price;

      return { ...cartItem, currentPrice, originalPrice, isDiscounted, priceChanged };
    });
  }, [items, liveProducts]);

  const liveTotalPrice = useMemo(() => effectiveCartItems.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0), [effectiveCartItems]);
  const hasPriceChanged = useMemo(() => effectiveCartItems.some((item: any) => item.priceChanged), [effectiveCartItems]);

  // ป้องกันการเข้าหน้า Checkout เมื่อตะกร้าว่าง และตรวจสอบสถานะ Auth แบบเงียบๆ
  useEffect(() => {
    if (!isMounted) return; // รอให้ดึงข้อมูลจาก LocalStorage ให้เสร็จก่อน
    if (items.length === 0 && !isSuccess) { // เพิ่ม && !isSuccess ตรงนี้
      router.push('/');
      return;
    }

    const checkAuthAndProfile = async () => {
      setIsAuthChecking(true);
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user || null;
      setUser(currentUser);

      let hasSavedLocation = false;

      if (currentUser) {
        // 1. ดึงข้อมูลโปรไฟล์ล่าสุดจากตาราง users
        const { data: profile } = await supabase
          .from('users')
          .select('name, phone, lat, lng')
          .eq('id', currentUser.id)
          .single();

        // 2. ดึงข้อมูลสมุดที่อยู่จากตาราง user_addresses
        const { data: userAddresses } = await supabase
          .from('user_addresses')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: false });

        if (userAddresses && userAddresses.length > 0) {
          setAddresses(userAddresses);
          const defaultAddr = userAddresses[0];
          setSelectedAddressId(defaultAddr.id);

          setFormData(prev => ({
            ...prev,
            name: profile?.name || currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '',
            phone: profile?.phone || currentUser.phone || currentUser.user_metadata?.phone || '',
            address: defaultAddr.address_text,
          }));

          setLocation({ lat: defaultAddr.lat, lng: defaultAddr.lng });
          setIsLocating(false);
          hasSavedLocation = true;
        } else {
          // 3. Fallback ดึงที่อยู่จัดส่งแบบข้อความจาก LocalStorage
          const savedAddress = localStorage.getItem('last_saved_address') || '';
          setFormData(prev => ({
            ...prev,
            name: profile?.name || currentUser.user_metadata?.name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '',
            phone: profile?.phone || currentUser.phone || currentUser.user_metadata?.phone || '',
            address: savedAddress,
          }));

          if (profile?.lat && profile?.lng) {
            setLocation({ lat: Number(profile.lat), lng: Number(profile.lng) });
            setIsLocating(false);
            hasSavedLocation = true;
          }
        }
      }

      // หากยังไม่มีพิกัดที่เคยบันทึก ค่อยหาตำแหน่งปัจจุบันของลูกค้า
      if (!hasSavedLocation) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
              setIsLocating(false);
            },
            (error) => {
              console.warn('Geolocation ถูกปฏิเสธหรือไม่สามารถใช้งานได้', error);
              setIsLocating(false);
            },
            { enableHighAccuracy: true }
          );
        } else {
          setIsLocating(false);
        }
      }

      setIsAuthChecking(false);
    };
    checkAuthAndProfile();
  }, [items, router, supabase, isSuccess, isMounted]); // เพิ่ม isMounted ใน Dependency Array

  const handleSelectAddress = (addr: Address) => {
    setSelectedAddressId(addr.id);
    setFormData(prev => ({ ...prev, address: addr.address_text }));
    setLocation({ lat: addr.lat, lng: addr.lng });
  };

  // ฟังก์ชันดึงพิกัดปัจจุบันและแปลงเป็นที่อยู่
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleLocationChangeAndFetchAddress(position.coords.latitude, position.coords.longitude);
          setIsLocating(false);
        },
        (error) => {
          console.warn('Geolocation error:', error);
              toast.error('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาเปิดการเข้าถึงพิกัด (GPS)');
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
          toast.error('เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่งปัจจุบัน');
    }
  };

  // ฟังก์ชันอัปเดตพิกัดพร้อมดึงที่อยู่จาก OpenStreetMap (Reverse Geocoding)
  const handleLocationChangeAndFetchAddress = async (lat: number, lng: number) => {
    setLocation({ lat, lng });
    setSelectedAddressId(null);

    try {
      // ดึงที่อยู่จาก OSM Nominatim API (รองรับภาษาไทย)
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=th`);
      const data = await res.json();

      if (data && data.display_name) {
        setFormData(prev => ({ ...prev, address: data.display_name }));
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    }
  };

  // ฟังก์ชันจัดการเมื่อผู้ใช้เลือกไฟล์สลิป (พร้อมบีบอัด)
  const handleSlipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsCompressing(true);
        // บีบอัดรูปสลิปให้ความกว้างไม่เกิน 800px เพื่อลดขนาดไฟล์
        const compressedFile = await compressImage(file, 800, 0.8);
        setSlipFile(compressedFile);
      } catch (error) {
        console.error("Slip compression error:", error);
        toast.error("ไม่สามารถประมวลผลรูปภาพสลิปได้ กรุณาลองใหม่อีกครั้ง");
        setSlipFile(null);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  // ดึงข้อมูลสาขาเพื่อเอารัศมีและพิกัด
  useEffect(() => {
    const fetchBranch = async () => {
      if (!activeBranchId) return;
      const { data } = await supabase
        .from('branches')
        .select('name, address, lat, lng, service_radius')
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
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData({ ...formData, [name]: value.replace(/\D/g, '').slice(0, 10) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // ฟังก์ชันหลัก: สั่งซื้อและบันทึกลง Database
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranchId) {
      toast.error('ไม่พบข้อมูลสาขา กรุณาเลือกสาขาใหม่');
      return;
    }
    if (deliveryMethod === 'delivery' && distanceKm !== null && !isWithinRadius) {
      toast.error('ที่อยู่ของคุณอยู่นอกพื้นที่ให้บริการของสาขานี้');
      return;
    }
    if (!deliveryDate || !deliverySlot) {
      toast.error(deliveryMethod === 'delivery' ? 'กรุณาเลือกวันที่และรอบการจัดส่ง' : 'กรุณาเลือกวันที่และเวลาที่คาดว่าจะมารับสินค้า');
      return;
    }

    setIsSubmitting(true);

    try {
      // ตรวจสอบกฎ Cut-off เบื้องต้น
      const now = new Date();
      const currentHour = now.getHours();
      const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60 * 1000)).toISOString().split('T')[0];

      const { data: slotData } = await supabase
        .from('delivery_slots')
        .select('cut_off_hour')
        .eq('id', deliverySlot)
        .single();

      if (deliveryDate === todayStr && slotData && currentHour >= slotData.cut_off_hour) {
        toast.error(deliveryMethod === 'delivery'
          ? 'ขออภัย รอบจัดส่งนี้ปิดรับออเดอร์สำหรับวันนี้แล้ว กรุณาเลือกรอบอื่นหรือเปลี่ยนวันจัดส่ง'
          : 'ขออภัย ช่วงเวลานี้ปิดรับออเดอร์แล้ว กรุณาเลือกเวลาอื่นหรือเปลี่ยนวันเข้ารับสินค้า');
        setIsSubmitting(false);
        return;
      }

      // --- ระบบอัปโหลดสลิป ---
      let paymentSlipUrl = null;
      let paymentStatus = paymentMethod === 'promptpay' ? 'pending_verification' : 'pending_payment';

      if (paymentMethod === 'promptpay') {
        if (!slipFile) {
          toast.error('กรุณาแนบสลิปโอนเงิน');
          setIsSubmitting(false);
          return;
        }
        const fileExt = slipFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('slips')
          .upload(fileName, slipFile);

        if (uploadError) throw new Error('อัปโหลดสลิปไม่สำเร็จ: ' + uploadError.message);
        const { data: publicUrlData } = supabase.storage.from('slips').getPublicUrl(uploadData.path);
        paymentSlipUrl = publicUrlData.publicUrl;
      }
      // ----------------------

      // 1. บันทึกข้อมูลลงตาราง orders
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: Number(activeBranchId), // ตารางต้องการ bigint
          customer_id: user?.id, // บันทึกไอดีลูกค้าลง Database
          total_price: liveTotalPrice + (deliveryMethod === 'delivery' ? deliveryFee : 0),
          lat: deliveryMethod === 'delivery' ? location.lat : null,
          lng: deliveryMethod === 'delivery' ? location.lng : null,
          delivery_date: deliveryDate,
          delivery_slot: deliverySlot,
          delivery_method: deliveryMethod, // เก็บรูปแบบการรับของ
          payment_method: paymentMethod, // เพิ่มช่องทางชำระเงิน
          payment_status: paymentStatus, // เพิ่มสถานะชำระเงิน
          payment_slip_url: paymentSlipUrl, // เพิ่ม URL สลิป
          customer_info: {
            name: formData.name,
            phone: formData.phone,
            address: deliveryMethod === 'delivery' ? formData.address : null,
            delivery_fee: deliveryMethod === 'delivery' ? deliveryFee : 0,
            distance_km: deliveryMethod === 'delivery' ? distanceKm : null
          },
          status: 'pending',
        })
        .select('id')
        .single();

      if (orderError || !orderData) throw new Error(orderError?.message || 'ไม่สามารถสร้างคำสั่งซื้อได้');

      // 2. บันทึกข้อมูลสินค้าลงตาราง order_items
      const orderItems = effectiveCartItems.map((item) => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_purchase: item.currentPrice, // ใช้ราคาที่อัปเดตล่าสุด
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw new Error(itemsError.message);

      // 3. อัปเดตข้อมูลลูกค้าลงตาราง users และ LocalStorage สำหรับครั้งถัดไป
      if (user?.id) {
        const userUpdate: any = {
          name: formData.name,
          phone: formData.phone,
        };

        if (deliveryMethod === 'delivery') {
          userUpdate.lat = location.lat.toString();
          userUpdate.lng = location.lng.toString();
        }

        await supabase
          .from('users')
          .update(userUpdate)
          .eq('id', user.id);

        if (deliveryMethod === 'delivery') {
          localStorage.setItem('last_saved_address', formData.address);

          // ตรวจสอบและบันทึกลงสมุดที่อยู่หากเป็นลูกค้าใหม่และเปิดสวิตช์ไว้
          if (addresses.length === 0 && saveToAddressBook) {
            await supabase.from('user_addresses').insert({
              user_id: user.id,
              title: 'บ้าน', // ให้ค่าเริ่มต้นเป็นคำว่า 'บ้าน'
              address_text: formData.address,
              lat: location.lat,
              lng: location.lng,
              is_default: true
            });
          }
        }
      }

      // --- แจ้งเตือนผ่าน Webhook ถ้ารับที่ร้านและมารับภายใน "วันนี้" ---
      if (deliveryMethod === 'pickup' && deliveryDate === todayStr) {
        try {
          const slotName = slots.find(s => s.id === deliverySlot)?.name || 'ไม่ระบุเวลา';
          const message = `\n🔔 มีลูกค้านัดรับที่ร้านวันนี้!\nออเดอร์: #${orderData.id.slice(0, 8).toUpperCase()}\nลูกค้า: ${formData.name}\nโทร: ${formData.phone}\nเวลานัดรับ: ${slotName}\nยอดสุทธิ: ฿${liveTotalPrice.toLocaleString()}`;

          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
          });
        } catch (err) {
          console.error('Notify error:', err);
        }
      }

      // 4. สำเร็จ: ล้างตะกร้าและเปลี่ยนหน้า
      setIsSuccess(true); // เซ็ตค่าเป็น true เพื่อล็อกไม่ให้ useEffect เตะกลับหน้าแรก
      clearCart();
      router.push(`/checkout/success?orderId=${orderData.id}`); // แนบ orderId ไปด้วย

    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error('เกิดข้อผิดพลาดในการสั่งซื้อ: ' + error.message);
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

          {/* เลือกวิธีการจัดส่ง */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4">รูปแบบการรับสินค้า</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              <label className="relative cursor-pointer group">
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="delivery"
                  className="peer sr-only"
                  checked={deliveryMethod === 'delivery'}
                  onChange={() => setDeliveryMethod('delivery')}
                />
                <div className="p-4 rounded-xl border-2 border-gray-100 hover:bg-gray-50 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 peer-checked:text-blue-700">จัดส่งตามรอบ (Delivery)</h4>
                    <p className="text-xs text-gray-500 mt-1">ให้พนักงานจัดส่งตามที่อยู่ที่คุณปักหมุดไว้</p>
                  </div>
                </div>
              </label>

              <label className="relative cursor-pointer group">
                <input
                  type="radio"
                  name="deliveryMethod"
                  value="pickup"
                  className="peer sr-only"
                  checked={deliveryMethod === 'pickup'}
                  onChange={() => setDeliveryMethod('pickup')}
                />
                <div className="p-4 rounded-xl border-2 border-gray-100 hover:bg-gray-50 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 transition-all flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 peer-checked:text-emerald-700">รับที่ร้าน (Store Pickup)</h4>
                    <p className="text-xs text-gray-500 mt-1">มารับสินค้าด้วยตนเองที่สาขานี้</p>
                  </div>
                </div>
              </label>

            </div>
          </div>

          {/* กล่องเลือกรอบจัดส่ง */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{deliveryMethod === 'delivery' ? 'เลือกรอบจัดส่งสินค้า' : 'เลือกเวลาเข้ามารับสินค้า'}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{deliveryMethod === 'delivery' ? 'วันที่จัดส่ง' : 'วันที่เข้ารับสินค้า'}</label>
                <input
                  type="date"
                  required
                  title="เลือกวันที่"
                  placeholder="วว/ดด/ปปปป"
                  min={minDateStr}
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{deliveryMethod === 'delivery' ? 'เวลารอบจัดส่ง' : 'เวลาที่คาดว่าจะมาถึง'}</label>
                {slots.length === 0 ? (
                  <p className="text-sm text-gray-500">กำลังโหลดรอบจัดส่ง...</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {slots.filter(s => !s.slot_type || s.slot_type === 'both' || s.slot_type === deliveryMethod).map(slot => {
                      const isDisabled = deliveryDate === todayStr && currentHour >= slot.cut_off_hour;
                      return (
                        <label key={slot.id} className={`flex flex-col items-center justify-center px-2 py-3 border rounded-xl cursor-pointer transition text-center ${isDisabled ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : deliverySlot === slot.id ? 'border-blue-600 bg-blue-50 text-blue-700 ring-1 ring-blue-600 shadow-sm' : 'border-gray-300 hover:border-blue-400 bg-white'}`}>
                          <input type="radio" name="slot" value={slot.id} className="sr-only"
                            disabled={isDisabled}
                            checked={deliverySlot === slot.id}
                            onChange={() => setDeliverySlot(slot.id)} />
                          <span className="text-sm font-medium">{slot.name}</span>
                          <span className="text-xs font-normal opacity-80 mt-1">{slot.time_range}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {deliveryDate === todayStr && slots.filter(s => !s.slot_type || s.slot_type === 'both' || s.slot_type === deliveryMethod).some(s => currentHour >= s.cut_off_hour) && (
                  <p className="text-xs text-orange-600 mt-3 font-medium flex items-start gap-1"><AlertCircle className="w-4 h-4 shrink-0" /> {deliveryMethod === 'delivery' ? 'บางรอบจัดส่งถูกปิดใช้งานสำหรับวันนี้ เนื่องจากเลยเวลาตัดรอบแล้ว' : 'บางช่วงเวลาไม่สามารถเข้ารับสินค้าได้ เนื่องจากเลยเวลาเตรียมสินค้าแล้ว'}</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-slate-800 mb-6">ข้อมูลผู้ติดต่อ</h2>

            <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="ระบุชื่อ" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                  <input required type="tel" name="phone" pattern="^0[0-9]{9}$" title="กรุณากรอกเบอร์โทรศัพท์ 10 หลัก ที่ขึ้นต้นด้วย 0" maxLength={10} value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="08XXXXXXXX" />
                </div>
              </div>
              {deliveryMethod === 'delivery' && (
                <div className="animate-in fade-in zoom-in-95 duration-300 mt-4 space-y-4">
                  {addresses.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">เลือกจากสมุดที่อยู่</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {addresses.map((addr) => (
                          <div
                            key={addr.id}
                            onClick={() => handleSelectAddress(addr)}
                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedAddressId === addr.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 hover:border-blue-300'
                              }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-gray-800 text-sm mb-1">
                              {addr.title === 'บ้าน' ? <Home className="w-4 h-4 text-blue-500" /> : addr.title === 'ร้านขายของ' ? <Store className="w-4 h-4 text-emerald-500" /> : <MapPinIcon className="w-4 h-4 text-orange-500" />}
                              {addr.title}
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{addr.address_text}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่จัดส่ง (รายละเอียด)</label>
                    <textarea required name="address" value={formData.address} onChange={(e) => { handleChange(e); setSelectedAddressId(null); }} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" placeholder="บ้านเลขที่, ซอย, ถนน, ตำบล, อำเภอ..." />
                  </div>

                  {user && addresses.length === 0 && (
                    <label className="flex items-center cursor-pointer gap-2 mt-3 select-none">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={saveToAddressBook} onChange={(e) => setSaveToAddressBook(e.target.checked)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${saveToAddressBook ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${saveToAddressBook ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">บันทึกเป็นที่อยู่จัดส่งหลักในสมุดที่อยู่</span>
                    </label>
                  )}
                </div>
              )}
            </form>
          </div>



          {deliveryMethod === 'delivery' ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 animate-in fade-in zoom-in-95 duration-300">
              <h2 className="text-xl font-bold text-slate-800 mb-2">ปักหมุดตำแหน่งจัดส่ง</h2>
              <p className="text-sm text-gray-500 mb-6">เลื่อนหมุดสีน้ำเงินไปยังตำแหน่งที่ต้องการให้พนักงานไปส่งสินค้า</p>
              <div className="relative min-h-[350px]">
                {isLocating ? (
                  <div className="absolute inset-0 z-10 bg-slate-50 flex items-center justify-center rounded-xl border border-gray-100">
                    <p className="text-blue-600 font-medium animate-pulse">📍 กำลังค้นหาตำแหน่งปัจจุบันของคุณ...</p>
                  </div>
                ) : (
                  <>
                    <CheckoutMap
                      initialPosition={[location.lat, location.lng]}
                      onLocationChange={handleLocationChangeAndFetchAddress}
                      branchLocation={branchData?.lat && branchData?.lng ? [Number(branchData.lat), Number(branchData.lng)] : undefined}
                      serviceRadius={serviceRadius}
                    />

                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      className="absolute bottom-4 right-4 z-[400] bg-white text-blue-600 p-3 rounded-full shadow-lg border border-gray-200 hover:bg-blue-50 transition-all flex items-center justify-center active:scale-95"
                      title="ตำแหน่งปัจจุบัน"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  </>
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
          ) : (
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 animate-in fade-in zoom-in-95 duration-300">
              <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
                <Store className="w-5 h-5" /> ข้อมูลสาขาที่ต้องไปรับสินค้า
              </h3>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100">
                <p className="font-semibold text-gray-800 text-lg">{branchData?.name || 'กำลังโหลดข้อมูลสาขา...'}</p>
                <p className="text-sm text-gray-600 mt-2 flex items-start gap-2">
                  <MapPinIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  {branchData?.address || 'ไม่พบที่อยู่สาขา'}
                </p>
              </div>

              <div className="mt-4 flex items-start gap-2 text-emerald-700 text-sm bg-emerald-100/50 p-3 rounded-lg">
                <Info className="w-5 h-5 shrink-0" />
                <p><strong>ข้อควรทราบ:</strong> กรุณามารับสินค้าภายในวันและเวลาที่เลือกรอบไว้ และแสดงหน้าประวัติคำสั่งซื้อให้พนักงานที่เคาน์เตอร์</p>
              </div>
            </div>
          )}

          {/* ส่วนเลือกช่องทางชำระเงิน */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4">ช่องทางการชำระเงิน</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="relative cursor-pointer group">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="promptpay"
                  className="peer sr-only"
                  checked={paymentMethod === 'promptpay'}
                  onChange={() => setPaymentMethod('promptpay')}
                />
                <div className="p-4 rounded-xl border-2 border-gray-100 hover:bg-gray-50 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 peer-checked:text-blue-700">โอนเงิน (PromptPay)</h4>
                    <p className="text-xs text-gray-500 mt-1">สแกน QR Code พร้อมแนบสลิป</p>
                  </div>
                </div>
              </label>
              <label className="relative cursor-pointer group">
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  className="peer sr-only"
                  checked={paymentMethod === 'cod'}
                  onChange={() => setPaymentMethod('cod')}
                />
                <div className="p-4 rounded-xl border-2 border-gray-100 hover:bg-gray-50 peer-checked:border-blue-500 peer-checked:bg-blue-50 transition-all flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 peer-checked:text-blue-700">{deliveryMethod === 'delivery' ? 'ชำระเงินปลายทาง (COD)' : 'ชำระเงินที่สาขา'}</h4>
                    <p className="text-xs text-gray-500 mt-1">{deliveryMethod === 'delivery' ? 'จ่ายเงินสดเมื่อรับสินค้า' : 'ชำระที่หน้าเคาน์เตอร์'}</p>
                  </div>
                </div>
              </label>
            </div>

            {paymentMethod === 'promptpay' && (
              <div className="mt-4 bg-gray-50 p-6 rounded-xl border border-gray-200 text-center animate-in fade-in zoom-in-95 duration-300">
                <h3 className="font-semibold text-gray-700 mb-2">สแกน QR Code เพื่อโอนเงิน</h3>
                <p className="text-xl font-bold text-blue-600 mb-4">ยอดโอน: ฿{(liveTotalPrice + (deliveryMethod === 'delivery' ? deliveryFee : 0)).toLocaleString()}</p>
                <div className="w-48 h-48 bg-white mx-auto mb-4 border border-gray-200 flex items-center justify-center rounded-lg overflow-hidden relative shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`https://promptpay.io/0928727608/${liveTotalPrice + (deliveryMethod === 'delivery' ? deliveryFee : 0)}.png`} alt="PromptPay QR Code" className="w-full h-full object-contain" />
                </div>
                <div className="text-left mt-4 relative">
                  {isCompressing && (
                    <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center rounded-xl">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                      <p className="mt-2 text-blue-800 font-medium">กำลังบีบอัดรูปภาพ...</p>
                    </div>
                  )}
                  <label className="block text-sm font-medium text-gray-700 mb-2">แนบสลิปโอนเงิน</label>
                  <input 
                    type="file" 
                    accept="image/*" 
                    title="เลือกไฟล์สลิปโอนเงิน"
                    placeholder="เลือกไฟล์รูปภาพสลิป"
                    onChange={handleSlipChange}
                    disabled={isCompressing}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" 
                  />
                  {slipFile ? (
                    <div className="mt-3 relative w-full h-48 border-2 border-dashed border-blue-300 rounded-xl overflow-hidden bg-blue-50/50 flex flex-col items-center justify-center group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={URL.createObjectURL(slipFile)} alt="Slip preview" className="max-h-full max-w-full object-contain p-2" />
                      <button 
                        type="button"
                        onClick={() => setSlipFile(null)} 
                        className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-red-500 p-2 rounded-full shadow-sm hover:bg-red-50 hover:scale-105 transition-all disabled:opacity-50"
                        title="ลบรูปภาพ"
                        disabled={isCompressing}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs py-1.5 text-center truncate px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {slipFile.name}
                      </div>
                    </div>
                  ) : (
                    <label className={`mt-3 flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl bg-white transition-colors ${isCompressing ? 'cursor-wait' : 'hover:bg-gray-50 hover:border-blue-400 cursor-pointer group'}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className="w-8 h-8 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
                        <p className="text-sm text-gray-600 font-medium group-hover:text-blue-600 transition-colors">คลิกเพื่ออัปโหลดสลิป</p>
                        <p className="text-xs text-gray-400 mt-1">รองรับไฟล์ JPG, PNG</p>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleSlipChange}
                        disabled={isCompressing}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ฝั่งขวา: สรุปคำสั่งซื้อ (Order Summary) */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6">สรุปคำสั่งซื้อ</h2>

            {hasPriceChanged && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-amber-800 text-sm leading-relaxed">ราคาสินค้าบางรายการมีการอัปเดตตามโปรโมชั่นปัจจุบัน โปรดตรวจสอบยอดรวมก่อนชำระเงิน</p>
              </div>
            )}

            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2 min-h-[100px]">
              {isPriceValidating ? (
                 <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                   <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
                   <p className="text-sm font-medium">กำลังอัปเดตราคาสินค้าล่าสุด...</p>
                 </div>
              ) : (
              effectiveCartItems.map((item: any) => {
                const step = item.step_value || 1;
                const min = item.min_value || 1;
                const displayQuantity = Number.isInteger(item.quantity) ? item.quantity.toString() : item.quantity.toFixed(2).replace(/\.?0+$/, '');

                return (
                  <div key={item.id} className="flex flex-col border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-4">
                        <h3 className="font-medium text-gray-800 line-clamp-2">{item.name}</h3>
                        <div className="text-sm font-semibold mt-1">
                          {item.isDiscounted ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-red-600">฿{item.currentPrice.toLocaleString()}</span>
                              <span className="text-xs text-gray-400 line-through">฿{item.originalPrice.toLocaleString()}</span>
                              {item.unit_name && <span className="text-gray-500 font-normal"> / {item.unit_name}</span>}
                            </div>
                          ) : (
                            <span className="text-blue-600">฿{item.currentPrice.toLocaleString()}{item.unit_name ? ` / ${item.unit_name}` : ''}</span>
                          )}
                        </div>
                      </div>
                      <div className="font-semibold text-gray-800">
                        ฿{(item.currentPrice * item.quantity).toLocaleString()}
                      </div>
                    </div>
                    {/* ส่วนควบคุมจำนวนสินค้า */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 w-fit">
                        <button type="button" title="ลดจำนวน" onClick={() => {
                          const nextQuantity = Number((item.quantity - step).toFixed(2));
                          if (nextQuantity >= min) {
                            updateQuantity(item.id, nextQuantity);
                          } else {
                            removeItem(item.id);
                          }
                        }} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm rounded transition-all">
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="min-w-[1.5rem] px-1 text-center font-semibold text-sm">{displayQuantity}</span>
                        <button type="button" title="เพิ่มจำนวน" onClick={() => updateQuantity(item.id, Number((item.quantity + step).toFixed(2)))} className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:text-slate-800 hover:shadow-sm rounded transition-all">
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <button type="button" onClick={() => removeItem(item.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium">
                        <Trash2 className="w-4 h-4" /> <span className="hidden sm:inline">ลบ</span>
                      </button>
                    </div>
                  </div>
                )
              })
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-3 mb-6">
              <div className="flex justify-between text-gray-600">
                <span>ค่าสินค้า</span>
                <span>฿{liveTotalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ค่าจัดส่ง {deliveryMethod === 'delivery' ? `(ระยะทาง ${distanceKm !== null ? distanceKm.toFixed(1) : 0} กม.)` : ''}</span>
                <span>{deliveryMethod === 'pickup' ? 'ไม่มีค่าจัดส่ง' : isCalculatingFee ? 'กำลังคำนวณ...' : `฿${deliveryFee.toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-blue-600 pt-2 border-t border-gray-200">
                <span>ยอดรวมทั้งสิ้น</span>
                <span>฿{(liveTotalPrice + (deliveryMethod === 'delivery' ? deliveryFee : 0)).toLocaleString()}</span>
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
                disabled={isSubmitting || isPriceValidating || (deliveryMethod === 'delivery' && distanceKm !== null && !isWithinRadius) || (deliveryMethod === 'delivery' && isCalculatingFee) || (paymentMethod === 'promptpay' && !slipFile)}
                className={`w-full py-3 px-4 rounded-xl font-medium transition shadow-sm flex justify-center items-center ${(deliveryMethod === 'delivery' && distanceKm !== null && !isWithinRadius) || (deliveryMethod === 'delivery' && isCalculatingFee) || (paymentMethod === 'promptpay' && !slipFile) || isPriceValidating ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed'
                  }`}
              >
                {isSubmitting || isPriceValidating ? 'กำลังดำเนินการ...' : 'ยืนยันการสั่งซื้อ'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}