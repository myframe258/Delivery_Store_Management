import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role || user?.user_metadata?.role;
  const path = request.nextUrl.pathname;

  // อนุญาตให้ผ่านได้เสมอสำหรับ API และไฟล์ Assets ต่างๆ
  if (path.startsWith('/api') || path.startsWith('/_next') || path.includes('.')) {
    return supabaseResponse;
  }

  // 1. Guard สำหรับ Customer: หากเป็น Admin/Rider จะเข้าหน้า Customer (หน้าแรก หรือ Checkout) ไม่ได้
  const isCustomerPage = path === '/' || path.startsWith('/checkout');
  if (isCustomerPage && role && role !== 'customer') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. Guard สำหรับ Role อื่นๆ
  if (path.startsWith('/branch-admin') && role !== 'branch_admin') { return NextResponse.redirect(new URL(role ? '/dashboard' : '/login', request.url)); }
  if (path.startsWith('/rider') && role !== 'rider') { return NextResponse.redirect(new URL(role ? '/dashboard' : '/login', request.url)); }
  if (path.startsWith('/super-admin') && role !== 'super_admin') { return NextResponse.redirect(new URL(role ? '/dashboard' : '/login', request.url)); }
  if (path.startsWith('/picker') && role !== 'picker') { return NextResponse.redirect(new URL(role ? '/dashboard' : '/login', request.url)); }


  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};