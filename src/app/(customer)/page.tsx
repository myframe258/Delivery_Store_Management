import { supabase } from '../../lib/supabase';
import DynamicBranchLocatorMap from '../../components/maps/DynamicBranchLocatorMap';

// ปิดการ Cache เพื่อให้ดึงข้อมูลใหม่จาก Database ทุกครั้งที่มีการเข้าหน้านี้
export const revalidate = 0;

export default async function CustomerHomePage() {
  // ดึงข้อมูลสาขาจากตาราง branches
  const { data: branches, error } = await supabase
    .from('branches')
    .select('*');

  if (error) {
    return <div className="p-10 text-red-500">Error: {error.message}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900">เลือกร้านค้าสาขาใกล้คุณ</h1>
        <p className="text-gray-500 mt-2">เพื่อตรวจสอบสินค้าและบริการจัดส่งในพื้นที่ของคุณ</p>
      </header>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm h-[600px] relative z-0">
        <DynamicBranchLocatorMap branches={branches || []} />
      </div>
    </div>
  );
}
