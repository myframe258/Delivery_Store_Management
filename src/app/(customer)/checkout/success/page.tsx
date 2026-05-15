import Link from 'next/link';
import { CheckCircle, Home } from 'lucide-react';

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-sm border border-gray-200 max-w-lg w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-3">สั่งซื้อสินค้าสำเร็จ!</h1>
        
        <p className="text-gray-500 mb-8 leading-relaxed">
          ขอบคุณที่ไว้วางใจใช้บริการของเรา<br />
          คำสั่งซื้อของคุณถูกส่งไปยังสาขาเรียบร้อยแล้ว<br />
          ระบบกำลังรอผู้จัดการสาขาจัดรอบเพื่อนำส่งสินค้าให้คุณ
        </p>
        
        <Link
          href="/"
          className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 text-white py-3 px-4 rounded-xl font-medium hover:bg-blue-700 transition shadow-sm"
        >
          <Home className="w-5 h-5" />
          กลับสู่หน้าหลัก
        </Link>
      </div>
    </div>
  );
}
