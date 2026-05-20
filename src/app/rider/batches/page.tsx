import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import RiderBatchClient from './RiderBatchClient';

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
  const { data: batches } = await supabase
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

  return (
    <div className="bg-gray-50 h-full">
      {/* ส่งต่อข้อมูลให้ Client Component จัดการ UI Interactive */}
      <RiderBatchClient initialBatches={batches || []} />
    </div>
  );
}
