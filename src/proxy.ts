import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  // 1. สร้าง Response พื้นฐาน
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. สร้าง Supabase Client (มาตรฐานใหม่ @supabase/ssr)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. ตรวจสอบข้อมูลผู้ใช้
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // --- Logic การตรวจสอบสิทธิ์ตาม Role ---

  // กรณีไม่ได้ Login และพยายามเข้าหน้าที่ต้องใช้สิทธิ์
  const protectedPaths = ['/super-admin', '/branch-admin', '/rider']
  const isProtectedPath = protectedPaths.some(p => path.startsWith(p))

  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const role = user.user_metadata?.role || 'customer'

    // เช็คสิทธิ์ Super Admin
    if (path.startsWith('/super-admin') && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // เช็คสิทธิ์ Branch Admin (Super Admin เข้าได้)
    if (path.startsWith('/branch-admin') && role !== 'branch_admin' && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // เช็คสิทธิ์ Rider (Super Admin เข้าได้)
    if (path.startsWith('/rider') && role !== 'rider' && role !== 'super_admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return response
}

// 3. กำหนดค่า Matcher เพื่อให้ทำงานในหน้าที่จำเป็น
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - และไฟล์รูปภาพต่างๆ
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}