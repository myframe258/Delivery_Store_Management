import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import PromotionManager from '@/components/admin/PromotionManager';
import { AlertCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function BranchPromotionsPage() {
  const supabase = await createClient();

  // 1. ตรวจสอบการเข้าสู่ระบบ
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login?returnTo=/branch-admin/promotions');
  }

  // 2. ดึงข้อมูล Profile เพื่อเช็ค Role และ Branch ID
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('role, branch_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return (
      <div className="p-8 flex justify-center text-red-500">
        <AlertCircle className="w-6 h-6 mr-2" /> ไม่พบข้อมูลผู้ใช้งานของคุณในระบบ
      </div>
    );
  }

  // 3. ป้องกันไม่ให้ Role อื่นที่ไม่มีสาขาเข้ามาใช้งาน
  if (profile.role !== 'branch_admin') {
    // หรือจัดการแสดงผลสำหรับ Super Admin กรณีที่จะให้เข้ามาดูได้
    return (
      <div className="p-8 flex justify-center text-orange-500">
        <AlertCircle className="w-6 h-6 mr-2" /> หน้านี้สงวนสิทธิ์เฉพาะผู้จัดการสาขา (Branch Admin) เท่านั้น
      </div>
    );
  }

  if (!profile.branch_id) {
    return (
      <div className="p-8 flex justify-center text-orange-500">
        <AlertCircle className="w-6 h-6 mr-2" /> บัญชีของคุณยังไม่ได้ถูกผูกกับสาขาใดๆ กรุณาติดต่อผู้ดูแลระบบ
      </div>
    );
  }

  // 4. ส่ง branchId ไปยัง Client Component (PromotionManager)
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">ระบบจัดการโปรโมชันสาขา</h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base">
            อัปโหลดและจัดการแบนเนอร์โฆษณาที่จะแสดงผลบนหน้าร้านของสาขาคุณ
          </p>
        </div>

        {/* เรียกใช้ Client Component เพื่อจัดการ UI แบบ Interactive */}
        <PromotionManager branchId={profile.branch_id.toString()} />
      </div>
    </div>
  );
}