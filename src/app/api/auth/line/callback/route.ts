import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  try {
    const safeOrigin = origin.includes('0.0.0.0') ? origin.replace('0.0.0.0', 'localhost') : origin;

    // 1. นำ Code ไปแลกเป็น Access Token จาก LINE
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${safeOrigin}/api/auth/line/callback`,
        client_id: process.env.NEXT_PUBLIC_LINE_CLIENT_ID!,
        client_secret: process.env.LINE_CLIENT_SECRET!
      })
    });
    const tokenData = await tokenResponse.json();

    if (tokenData.error) throw new Error(tokenData.error_description);

    // 2. ดึงข้อมูลโปรไฟล์ผู้ใช้จาก LINE
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const profile = await profileResponse.json();

    // 3. จำลองอีเมลและรหัสผ่านที่เดาไม่ได้ เพื่อใช้สมัคร/ล็อกอิน Supabase Auth
    const email = `${profile.userId}@line.me`; 
    const password = `${profile.userId}-${process.env.LINE_CLIENT_SECRET}`; 

    const cookieStore = await cookies();
    
    // ดึงค่า returnTo ออกมาจาก Cookie
    const returnTo = cookieStore.get('returnTo')?.value || '/dashboard';
    // ลบ Cookie ทิ้งเมื่อใช้งานเสร็จแล้ว
    cookieStore.delete('returnTo');
    
    // Client สำหรับดึง Session ลงเบราว์เซอร์ผู้ใช้
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
            } catch (error) {}
          },
        },
      }
    );

    // 4. พยายามเข้าสู่ระบบ
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    // 5. หากเข้าสู่ระบบไม่ได้ (แปลว่าผู้ใช้ใหม่) ให้สร้างบัญชี
    if (signInError && signInError.message.includes('Invalid login credentials')) {
      // ใช้ Service Role ข้ามกฎความปลอดภัย เพื่อบังคับสร้างบัญชี
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: profile.displayName,
          avatar_url: profile.pictureUrl,
          line_id: profile.userId,
          role: 'customer'
        }
      });
      if (createError) throw createError;

      // เข้าสู่ระบบใหม่อีกครั้ง
      await supabase.auth.signInWithPassword({ email, password });
    }

    return NextResponse.redirect(`${safeOrigin}${returnTo}`);
  } catch (error) {
    console.error('LINE Auth Error:', error);
    return NextResponse.redirect(`${origin}/login?error=auth-callback-failed`);
  }
}