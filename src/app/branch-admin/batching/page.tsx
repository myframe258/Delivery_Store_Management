import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BatchingClient from './BatchingClient';

export default async function BranchAdminBatchingPage() {
  const supabase = await createClient();

  // 1. ตรวจสอบผู้ใช้ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  // 2. ดึงข้อมูล Branch ID ของ Admin (สมมติว่าอิงจากตาราง users)
  const { data: userData } = await supabase
    .from('users')
    .select('branch_id')
    .eq('id', user.id)
    .single();

  const branchId = userData?.branch_id;
  if (!branchId) return <div className="p-8 text-center text-red-500">คุณยังไม่ได้ถูกระบุให้สังกัดสาขาใดๆ</div>;

  // 3. ดึงออเดอร์ของสาขานี้ที่มีสถานะ pending
  const { data: orders } = await supabase
    .from('orders')
    .select('id, lat, lng, total_price, customer_info')
    .eq('branch_id', branchId)
    .eq('status', 'pending');

  // 4. ดึงพิกัดสาขาเพื่อใช้เป็นจุด Center ของแผนที่
  const { data: branchData } = await supabase
    .from('branches')
    .select('lat, lng')
    .eq('id', branchId)
    .single();

  const branchLocation = {
    lat: Number(branchData?.lat || 13.7563),
    lng: Number(branchData?.lng || 100.5018),
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">จัดรอบการจัดส่ง (Batching)</h1>
          <p className="text-gray-500 mt-1">คลิกเลือกออเดอร์บนแผนที่หรือในรายการ เพื่อจัดกลุ่มให้คนขับวิ่งส่งในรอบเดียวกัน</p>
        </div>
        
        <BatchingClient orders={orders || []} branchId={branchId} branchLocation={branchLocation} />
      </div>
    </div>
  );
}
