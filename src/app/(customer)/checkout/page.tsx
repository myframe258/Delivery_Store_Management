'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useBranchStore } from '@/store/branchStore';
import dynamic from 'next/dynamic';
import { createBrowserClient } from '@supabase/ssr';
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

export default function CheckoutPage() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCartStore();
  const { activeBranchId } = useBranchStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ป้องกันการเข้าหน้า Checkout เมื่อตะกร้าว่าง
  useEffect(() => {
    if (items.length === 0) {
      router.push('/');
    }
  }, [items, router]);

  // ฟังก์ชันอัปเดตแบบฟอร์ม
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ฟังก์ชันหลัก: สั่งซื้อและบันทึกลง Database
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBranchId) return alert('ไม่พบข้อมูลสาขา กรุณาเลือกสาขาใหม่');

    setIsSubmitting(true);

    try {
      // 1. บันทึกข้อมูลลงตาราง orders
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          branch_id: Number(activeBranchId), // ตารางต้องการ bigint
          total_price: getTotalPrice(),
          lat: location.lat,
          lng: location.lng,
          customer_info: formData, // เก็บเป็น JSONB ตามโครงสร้าง Database
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
        price_at_purchase: String(item.price), // ตาม Database Schema กำหนดเป็น character varying
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw new Error(itemsError.message);

      // 3. สำเร็จ: ล้างตะกร้าและเปลี่ยนหน้า
      clearCart();
      router.push(`/checkout/success`); // คุณสามารถสร้างหน้า Success Page ต่อจากนี้ได้

    } catch (error: any) {
      console.error('Error placing order:', error);
      alert('เกิดข้อผิดพลาดในการสั่งซื้อ: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) return null; // ป้องกัน UI กะพริบก่อนถูก Redirect

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
            <CheckoutMap 
              initialPosition={[location.lat, location.lng]} 
              onLocationChange={(lat, lng) => setLocation({ lat, lng })} 
            />
          </div>
        </div>

        {/* ฝั่งขวา: สรุปคำสั่งซื้อ (Order Summary) */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 sticky top-6">
            <h2 className="text-xl font-bold text-slate-800 mb-6">สรุปคำสั่งซื้อ</h2>
            
            <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-start border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex-1 pr-4">
                    <h3 className="font-medium text-gray-800 line-clamp-2">{item.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">฿{item.price.toLocaleString()} x {item.quantity}</p>
                  </div>
                  <div className="font-semibold text-gray-800">
                    ฿{(item.price * item.quantity).toLocaleString()}
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
                <span>ค่าจัดส่ง (คำนวณภายหลัง)</span>
                <span>฿0</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-blue-600 pt-2 border-t border-gray-200">
                <span>ยอดรวมทั้งสิ้น</span>
                <span>฿{getTotalPrice().toLocaleString()}</span>
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={isSubmitting}
              className="w-full bg-slate-800 text-white py-3 px-4 rounded-xl font-medium hover:bg-slate-700 transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {isSubmitting ? 'กำลังดำเนินการ...' : 'ยืนยันการสั่งซื้อ'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}