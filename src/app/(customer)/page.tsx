import { createClient } from '@/lib/supabase/server';
import BranchMapWrapper from '@/components/maps/BranchMapWrapper';
import BranchList from './BranchList';
import Link from 'next/link';
import { MapPin, Store, ArrowRight, ShoppingBag, Truck, ShieldCheck } from 'lucide-react';

// ปิดการ Cache เพื่อให้ได้ข้อมูลสาขาล่าสุดเสมอ
export const revalidate = 0;

export default async function CustomerHomePage() {
  const supabase = await createClient();

  // ดึงข้อมูลสาขาจาก DB (ทำงานบน Server)
  const { data: branches, error } = await supabase
    .from('branches')
    .select('id, name, lat, lng, address');

  const hasBranches = branches && branches.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-16">
      
      {/* 1. Hero Section - แปลงโฉมให้เป็น E-Commerce Gateway */}
      <div className="relative overflow-hidden bg-slate-900 text-white pt-20 pb-24 px-4 md:px-8">
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-blue-600 rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-96 h-96 bg-emerald-600 rounded-full blur-3xl opacity-15 pointer-events-none" />

        <div className="max-w-6xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-4 py-1.5 rounded-full text-xs md:text-sm text-emerald-400 font-medium shadow-inner">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            ระบบจัดส่งเป็นรอบ (Batch Delivery) เปิดให้บริการแล้ววันนี้
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight max-w-4xl mx-auto bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            ช้อปสินค้าจากสาขาใกล้บ้าน <br className="hidden md:block"/>
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">จัดส่งตรงถึงหน้าบ้านคุณ</span>
          </h1>
          <p className="text-base md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            สัมผัสประสบการณ์การสั่งซื้อสินค้าที่รวดเร็วและคุ้มค่าที่สุด กรุณาเลือกสาขาในพื้นที่ของคุณเพื่อเข้าชมสินค้าและราคาพิเศษประจำสาขา
          </p>
        </div>
      </div>

      {/* 2. Value Propositions - จุดเด่นที่สอดคล้องกับ PRD */}
      <div className="max-w-6xl mx-auto -mt-10 px-4 md:px-8 relative z-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-start gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">สต็อกแม่นยำรายสาขา</h3>
              <p className="text-sm text-slate-500 mt-1">สินค้าตรงจากคลังของสาขาที่คุณเลือก มั่นใจได้ว่าได้รับของแน่นอน 100%</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">จัดส่งเป็นรอบสุดคุ้ม</h3>
              <p className="text-sm text-slate-500 mt-1">ระบบ Route Optimization คำนวณเส้นทางช่วยให้ค่าส่งประหยัดขึ้น</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-start gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">สั่งง่ายไม่ต้องใช้แอป</h3>
              <p className="text-sm text-slate-500 mt-1">ทำงานรูปแบบ PWA ช้อปได้ทันทีในฐานะ Guest บังคับล็อกอินตอนจ่ายเงิน</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content - ส่วนของการเลือกสาขา */}
      <div className="max-w-6xl mx-auto mt-12 px-4 md:px-8 space-y-12">
        
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center text-red-600 shadow-sm max-w-2xl mx-auto">
            <p className="text-xl font-semibold">ขออภัย ไม่สามารถโหลดข้อมูลสาขาได้ในขณะนี้</p>
            <p className="text-sm mt-2 opacity-80">ระบบฐานข้อมูลขัดข้อง กรุณาลองใหม่อีกครั้งในภายหลัง</p>
          </div>
        ) : !hasBranches ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-500 shadow-sm max-w-2xl mx-auto">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-xl font-bold text-slate-700 mb-2">ยังไม่มีสาขาที่เปิดให้บริการในขณะนี้</p>
            <p className="text-slate-400">เรากำลังเร่งขยายสาขาเพื่อให้บริการคุณอย่างครอบคลุม เร็ว ๆ นี้!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* ฝั่งซ้าย: แผนที่ค้นหา (สัดส่วน 7 คอลัมน์บนจอใหญ่) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 px-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-extrabold text-slate-800">ค้นหาสาขาใกล้บ้านคุณผ่านแผนที่</h2>
              </div>
              <div className="bg-white p-3 rounded-3xl shadow-xl border border-slate-200/60 ring-1 ring-slate-100 overflow-hidden sticky top-4">
                {/* กำหนดกรอบความสูงแผนที่ให้เสถียร */}
                <div className="h-[400px] md:h-[500px] rounded-2xl overflow-hidden relative">
                  <BranchMapWrapper branches={branches} />
                </div>
              </div>
            </div>

            {/* ฝั่งขวา: รายชื่อสาขาในรูปแบบการ์ดร้านค้า (สัดส่วน 5 คอลัมน์บนจอใหญ่) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-slate-700" />
                  <h2 className="text-xl font-extrabold text-slate-800">รายชื่อสาขาทั้งหมด</h2>
                </div>
                <span className="bg-slate-200 text-slate-700 text-xs font-bold px-2.5 py-1 rounded-full shadow-inner">
                  {branches.length} สาขา
                </span>
              </div>
              
              {/* รายชื่อสาขา */}
              <div className="space-y-4 max-h-[535px] overflow-y-auto pr-1">
                {branches.map((branch) => (
                  <div 
                    key={branch.id}
                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">
                          {branch.name}
                        </h3>
                        <span className="bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-md font-medium border border-emerald-100">
                          เปิดให้บริการ
                        </span>
                      </div>
                      <p className="text-slate-500 text-sm mt-2 line-clamp-2">
                        {branch.address || "ไม่มีข้อมูลที่อยู่สาขา"}
                      </p>
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-slate-400" /> รองรับจัดส่งเป็นรอบ
                      </span>
                      <Link 
                        href={`/${branch.id}`}
                        className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-200 hover:shadow-lg active:scale-95"
                      >
                        เข้าสู่หน้าร้านค้า
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {/* Component เพิ่มเติมในกรณีที่ต้องการใช้ร่วมกับ BranchList ตัวเดิม */}
              <div className="hidden">
                <BranchList branches={branches} />
              </div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}