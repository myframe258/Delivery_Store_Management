import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import InventoryClient from './InventoryClient';

export default async function BranchInventoryPage() {
  const supabase = await createClient();

  // 1. ตรวจสอบผู้ใช้ปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  // 2. ดึงข้อมูลพนักงานและตรวจสอบ Branch ID
  const { data: userData } = await supabase
    .from('users')
    .select('branch_id, role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'branch_admin' || !userData?.branch_id) {
    return redirect('/dashboard');
  }

  const branchId = userData.branch_id;

  // 3. ดึงข้อมูลสต็อกของสาขานี้ พร้อมข้อมูลสินค้า (Products)
  const { data: inventory, error } = await supabase
    .from('branch_inventory')
    .select(`
      id,
      stock_count,
      status,
      products (
        id,
        name,
        price,
        image_url
      )
    `)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Breadcrumbs />
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">จัดการสต็อกสินค้า</h1>
          <p className="text-gray-500 mt-1">อัปเดตจำนวนสินค้าคงเหลือ และเปิด-ปิดการแสดงผลหน้าร้านของสาขาคุณ</p>
        </div>

        {/* เรียกใช้งาน Client Component พร้อมส่งข้อมูลเบื้องต้นไปให้ */}
        <InventoryClient initialInventory={(inventory as any) || []} branchId={branchId} />
      </div>
    </div>
  );
}
