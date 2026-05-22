import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RiderBatchClient from './RiderBatchClient';

// บังคับให้หน้านี้ประมวลผลใหม่และดึงข้อมูลจาก Database เสมอ (ห้าม Cache)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function RiderBatchesPage() {
  const supabase = await createClient();

  // 1. ตรวจสอบผู้ใช้ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  // 2. ดึงข้อมูล User (เพื่อให้รู้ว่าเป็น Rider สาขาไหน)
  const { data: userData } = await supabase
    .from('users')
    .select('branch_id, role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'rider') {
    return <div className="p-8 text-center text-red-500 font-medium">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะคนขับเท่านั้น)</div>;
  }

  // 3. ดึง Delivery Batches เฉพาะงานที่ Assign ให้คนขับคนนี้ และยังวิ่งไม่เสร็จ
  const { data: batches, error } = await supabase
    .from('delivery_batches')
    .select(`
      id,
      batch_status,
      created_at,
      batch_items (
        id,
        sequence_no,
        delivery_status,
        orders (
          id,
          lat,
          lng,
          total_price,
          customer_info,
          status
        )
      )
    `)
    .eq('branch_id', userData.branch_id)
    .eq('driver_id', user.id) // <--- เพิ่มตัวกรองให้ดึงเฉพาะงานของ Rider คนปัจจุบัน
    .in('batch_status', ['assigned', 'in_progress']) // <--- เอา pending ออก เพราะยังไม่มีคนรับงาน
    .order('created_at', { ascending: false });

  // ดักจับ Error หากดึงข้อมูลล้มเหลว
  if (error) {
    console.error('Fetch Batches Error:', error);
    return <div className="p-8 text-center text-red-500 font-medium">เกิดข้อผิดพลาดในการดึงข้อมูล Database: {error.message}</div>;
  }

  return (
    <div className="bg-gray-50 h-full">
      {/* ส่งต่อข้อมูลให้ Client Component จัดการ UI Interactive */}
      <RiderBatchClient initialBatches={batches || []} />
      {(!batches || batches.length === 0) && <div className="p-4 text-xs text-gray-400 text-center">Debug: UserID={user.id} | Batches=0 (อาจติด RLS หรือ Cache)</div>}
    </div>
  );
}
