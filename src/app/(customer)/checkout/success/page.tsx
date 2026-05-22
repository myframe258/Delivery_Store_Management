import Link from 'next/link';
import { CheckCircle, Package, ArrowRight, MapPin } from 'lucide-react';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  // ดึง orderId จาก URL Parameter (ถ้ามี)
  const { orderId } = await searchParams;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-gray-200 max-w-lg w-full text-center relative overflow-hidden animate-in fade-in zoom-in duration-500">
        
        {/* Background Decoration */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-40 bg-gradient-to-b from-green-50 to-transparent opacity-70"></div>
        
        <div className="relative z-10">
          {/* Success Icon */}
          <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm ring-8 ring-green-50">
            <CheckCircle className="w-12 h-12" />
          </div>
          
          <h1 className="text-3xl font-bold text-slate-800 mb-3">สั่งซื้อสำเร็จ!</h1>
          <p className="text-slate-500 mb-8 leading-relaxed">
            ขอบคุณที่ใช้บริการ ระบบได้รับคำสั่งซื้อของคุณเรียบร้อยแล้ว <br />
            และกำลังรอการจัดสรรคนขับเพื่อนำส่งโดยสาขาที่ใกล้ที่สุด
          </p>

          {/* Order ID Box */}
          {orderId && (
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8 border-dashed">
              <p className="text-sm text-slate-500 mb-1 font-medium">หมายเลขคำสั่งซื้อของคุณ</p>
              <p className="text-2xl font-mono font-bold text-blue-600 tracking-wider">
                {orderId.slice(0, 8).toUpperCase()}
              </p>
            </div>
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
