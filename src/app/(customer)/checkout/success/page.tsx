import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, MapPin, Receipt } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  // ดึง orderId จาก URL Parameter (ถ้ามี)
  const { orderId } = await searchParams;

  let orderData = null;

  // ดึงข้อมูลออเดอร์จาก Database เพื่อแสดงยอดสรุป
  if (orderId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('orders')
      .select('total_price, customer_info, created_at')
      .eq('id', orderId)
      .single();
      
    if (data) {
      orderData = data;
    }
  }

  const customerInfo = orderData?.customer_info as any;
  const deliveryFee = customerInfo?.delivery_fee || 0;
  const distanceKm = customerInfo?.distance_km || 0;
  const subtotal = orderData ? orderData.total_price - deliveryFee : 0;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center p-4 py-12">
      <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-sm border border-gray-200 max-w-lg w-full text-center relative overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Background Decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-40 bg-gradient-to-b from-green-50 to-transparent opacity-70"></div>
        
        <div className="relative z-10">
          {/* Success Icon */}
          <div className="w-20 h-20 md:w-24 md:h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm ring-8 ring-green-50">
            <CheckCircle className="w-12 h-12" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-800 mb-3">สั่งซื้อสำเร็จ!</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            ขอบคุณที่ใช้บริการ ระบบได้รับคำสั่งซื้อของคุณเรียบร้อยแล้ว <br />
            และกำลังรอการจัดสรรคนขับเพื่อนำส่งโดยสาขาที่ใกล้ที่สุด
          </p>

          {/* Order ID Box */}
          {orderId && (
            <>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 border-dashed">
                <p className="text-sm text-slate-500 mb-1 font-medium">หมายเลขคำสั่งซื้อของคุณ</p>
                <p className="text-2xl font-mono font-bold text-blue-600 tracking-wider">
                  {orderId.slice(0, 8).toUpperCase()}
                </p>
              </div>

              {/* Order Summary */}
              {orderData && (
                <div className="text-left bg-white border border-gray-100 shadow-sm rounded-2xl p-5 mb-8 space-y-3">
                  <div className="flex items-center gap-2 text-slate-800 font-bold mb-4 pb-3 border-b border-gray-100">
                    <Receipt className="w-5 h-5 text-blue-600" /> สรุปยอดชำระเงิน
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>ค่าสินค้า</span>
                    <span>฿{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>ค่าจัดส่ง (ระยะทาง {distanceKm.toFixed(1)} กม.)</span>
                    <span>฿{deliveryFee.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-blue-700 pt-3 border-t border-gray-100 mt-2">
                    <span>ยอดรวมทั้งสิ้น</span>
                    <span>฿{orderData.total_price.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action Buttons */}
          <div className="space-y-3 mt-4">
            <Link 
              href="/" 
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 px-4 rounded-xl font-semibold transition-colors shadow-sm"
            >
              <MapPin className="w-5 h-5" />
              ค้นหาสาขาอื่นเพิ่มเติม
            </Link>
            
            <Link 
              href="/orders" 
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-slate-700 py-3.5 px-4 rounded-xl font-semibold transition-colors shadow-sm"
            >
              <Package className="w-5 h-5 text-gray-400" />
              ดูประวัติการสั่งซื้อ
              <ArrowRight className="w-4 h-4 text-gray-400 ml-auto" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
