import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import UserCreationForm from '@/components/admin/UserCreationForm';

export default async function SuperAdminUsersPage() {
    const supabase = createSupabaseServerClient();

    // 1. Security Check: ตรวจสอบสิทธิ์ซ้ำในระดับ Component
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return redirect('/login');
    }

    const role = user.app_metadata?.role || user.user_metadata?.role;
    if (role !== 'super_admin') {
        // หากไม่ใช่ Super Admin ให้ส่งกลับไปที่ Dashboard เพื่อให้ระบบ Redirect ไปหน้าของตัวเอง
        return redirect('/dashboard');
    }

    // 2. ดึงข้อมูลสาขามาเพื่อใช้ในฟอร์ม
    const { data: branches } = await supabase.from('branches').select('id, name');

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6 text-slate-800">สร้างบัญชีผู้ใช้ใหม่</h1>
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-200">
                <UserCreationForm branches={branches || []} />
            </div>
        </div>
    );
}
