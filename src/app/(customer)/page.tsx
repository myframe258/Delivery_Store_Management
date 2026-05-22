import { createClient } from '@/lib/supabase/server';
import BranchMapWrapper from '@/components/maps/BranchMapWrapper';
import BranchList from './BranchList';

// ปิดการ Cache เพื่อให้ได้ข้อมูลสาขาล่าสุดเสมอ
export const revalidate = 0;

export default async function CustomerHomePage() {
  const supabase = await createClient();

  // ดึงข้อมูลสาขาจาก DB (ทำงานบน Server)
  const { data: branches, error } = await supabase
    .from('branches')
    .select('id, name, lat, lng, address');

  if (error) {
    console.error('Error fetching branches:', error);
  }

  const hasBranches = branches && branches.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-10">

        {/* Header Section */}
        <div className="text-center space-y-4 pt-4 md:pt-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            เลือกร้านสาขาที่ใกล้คุณ
          </h1>
          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto">
            กรุณาเลือกสาขาบนแผนที่หรือจากรายการด้านล่าง เพื่อเข้าชมรายการสินค้าและบริการจัดส่งในพื้นที่ของคุณ
          </p>
        </div>

        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-600 shadow-sm">
            <p className="text-xl font-medium">ขออภัย ไม่สามารถโหลดข้อมูลสาขาได้ในขณะนี้</p>
            <p className="text-base mt-2 opacity-80">กรุณาลองใหม่อีกครั้งในภายหลัง</p>
          </div>
        ) : !hasBranches ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 shadow-sm">
            <p className="text-xl font-medium mb-2">ยังไม่มีสาขาที่เปิดให้บริการ</p>
            <p>กรุณาติดตามการอัปเดตสาขาใหม่เร็วๆ นี้</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* ส่วนแสดงแผนที่ผ่าน Wrapper */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-slate-800 px-2">ค้นหาจากแผนที่</h2>
              <div className="bg-white p-2 md:p-4 rounded-3xl shadow-lg border border-slate-200/60 ring-1 ring-slate-100">
                <BranchMapWrapper branches={branches} />
              </div>
            </div>

            {/* ส่วนแสดงรายชื่อสาขาแบบการ์ด */}
            <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-2xl font-bold text-slate-800">สาขาทั้งหมด ({branches.length})</h2>
              </div>
              <BranchList branches={branches} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}