import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // 1. ตรวจสอบสิทธิ์ว่าผู้เรียก API นี้เป็น 'super_admin' หรือไม่
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session || session.user.user_metadata?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: สิทธิ์การเข้าถึงถูกปฏิเสธ (ต้องเป็น Super Admin เท่านั้น)' }, { status: 403 });
    }

    // 2. รับค่าจาก Request Body
    const body = await request.json();
    const { email, password, role, branch_id } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน (ต้องการ email, password, role)' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'ไม่พบการตั้งค่า SUPABASE_SERVICE_ROLE_KEY ในระบบ' }, { status: 500 });
    }

    // 3. สร้าง Supabase Admin Client โดยใช้ Service Role Key (เพื่อให้มีสิทธิ์สร้าง User และข้าม RLS)
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 4. สร้างผู้ใช้ใหม่ใน Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // ยืนยันอีเมลให้อัตโนมัติ (ไม่ต้องรอผู้ใช้กดลิงก์)
      user_metadata: { role } // บันทึก Role ลงใน Metadata
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 5. บันทึกข้อมูลลงในตาราง public.users เพื่อให้ใช้งาน Foreign Key และเชื่อมสาขาได้
    if (authData.user) {
      const { error: dbError } = await supabaseAdmin.from('users').insert({
        id: authData.user.id,
        email: email,
        role: role,
        branch_id: branch_id || null // อาจเป็น null ได้ถ้าเป็น super_admin ด้วยกันเอง
      });

      if (dbError) {
        console.error('พบข้อผิดพลาดในการเพิ่มข้อมูลลงตาราง users:', dbError);
      }
    }

    return NextResponse.json({ message: 'สร้างบัญชีผู้ใช้สำเร็จ', user: authData.user }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}