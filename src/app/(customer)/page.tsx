import { createClient } from '@/lib/supabase/server';
import BranchMapWrapper from '@/components/maps/BranchMapWrapper';

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


  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">
            เลือกร้านสาขาที่ใกล้คุณ
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            กรุณาเลือกสาขาบนแผนที่เพื่อเข้าชมรายการสินค้าและบริการจัดส่งในพื้นที่ของคุณ
          </p>
        </div>

        {/* ส่วนแสดงแผนที่ผ่าน Wrapper */}
        <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200">
          <BranchMapWrapper branches={branches || []} />
        </div>

        {/* ส่วนแสดงรายชื่อสาขาแบบการ์ด (กรณีแผนที่โหลดไม่ได้หรือดูแบบรายการ) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {branches?.map((branch) => (
            <div key={branch.id} className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-800">{branch.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-1">{branch.address || 'ไม่มีข้อมูลที่อยู่'}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}