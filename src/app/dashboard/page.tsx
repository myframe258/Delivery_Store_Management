import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // หากเข้ามาหน้านี้โดยไม่มี session ให้ส่งกลับไปหน้า login
    return redirect('/login');
  }

  // ตรวจสอบ role จาก app_metadata หรือ user_metadata
  const role = user.app_metadata?.role || user.user_metadata?.role;

  // ทำการ Redirect ตาม Role
  switch (role) {
    case 'super_admin':
      return redirect('/super-admin/branches');
    case 'branch_admin':
      return redirect('/branch-admin/batching');
    case 'rider':
      return redirect('/rider/batches');
    case 'picker':
      return redirect('/picker/dashboard');
    default:
      return redirect('/'); // สำหรับลูกค้าหรือผู้ใช้ที่ไม่มี role
  }
}
