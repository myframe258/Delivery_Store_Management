import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // รองรับทั้งพารามิเตอร์ returnTo (จากหน้า Checkout) และ next
  const returnTo = searchParams.get('returnTo');
  const nextParam = searchParams.get('next');
  const next = returnTo || nextParam || '/';

  if (code) {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // จับ Error เมื่อทำงานบน Server Component
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.user) {
      // ค้นหาข้อมูล Identity ของ LINE 
      const lineIdentity = data.user.identities?.find((id) => id.provider === 'line');
      const lineUserId = lineIdentity?.id;

      // บันทึกหรืออัปเดตข้อมูลผู้ใช้และ line_user_id ลงในตาราง public.users
      await supabase.from('users').upsert({
        id: data.user.id, // ใช้ UUID เดียวกับ auth.users
        email: data.user.email,
        name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'ผู้ใช้งาน',
        line_user_id: lineUserId || null,
        avatar_url: data.user.user_metadata?.avatar_url || null, // เก็บรูปโปรไฟล์เผื่อนำไปแสดงผล
        role: 'customer' // บังคับให้ผู้ที่ล็อกอินผ่านช่องทางนี้เป็นลูกค้าทั่วไป
      }, { 
        onConflict: 'id' // ถ้าเคยล็อกอินแล้ว ให้อัปเดตข้อมูลล่าสุดแทน
      });

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // หากเกิด Error จะถูกส่งกลับไปหน้า login
  return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
}
