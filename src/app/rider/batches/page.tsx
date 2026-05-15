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

  // 3. ดึง Delivery Batches ของสาขานี้ ที่ยังไม่เสร็จสมบูรณ์
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
    .in('batch_status', ['pending', 'assigned', 'in_progress']) // ดึงรอบที่แอดมินเพิ่งสร้างมาแสดงด้วยเพื่อการเทส MVP
    .order('created_at', { ascending: false });

  return (
    <div className="bg-gray-50 h-full">
      {/* ส่งต่อข้อมูลให้ Client Component จัดการ UI Interactive */}
      <RiderBatchClient initialBatches={batches || []} />
    </div>
  );
}
