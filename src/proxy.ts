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

  // จัดกลุ่ม Path ที่ต้องการป้องกัน (รองรับทั้ง /driver, /admin ตามระบุ และโครงสร้างเดิม)
  const isDriverPath = path.startsWith('/driver') || path.startsWith('/rider')
  const isAdminPath = path.startsWith('/admin') || path.startsWith('/super-admin') || path.startsWith('/branch-admin')
  const isProtectedPath = isDriverPath || isAdminPath

  // 1. ถ้าไม่มี Session ให้เตะไปหน้า /login
  if (!user && isProtectedPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // 2. ถ้ามี Session ให้เช็ค user.app_metadata.role หรือ user.user_metadata.role
    const role = user.app_metadata?.role || user.user_metadata?.role || 'customer'

    // กำหนดหน้าแรกของแต่ละ Role สำหรับ Redirect กลับไปเมื่อเข้าผิดหน้า
    const getRoleHome = (currentRole: string) => {
      if (currentRole === 'rider') return '/rider' // หรือเปลี่ยนเป็น '/driver' ถ้าย้ายโฟลเดอร์แล้ว
      if (currentRole === 'super_admin') return '/super-admin/branches' // หน้าแรกของ Super Admin
      if (currentRole === 'branch_admin') return '/branch-admin/inventory' // หน้าแรกของ Branch Admin
      return '/' // สำหรับ Customer หรือ Role ที่ไม่รู้จัก
    }

    // 3. ถ้า Role เป็น 'rider' ให้เข้าได้เฉพาะหน้า Driver (ถ้าเป็น Role อื่นพยายามเข้า ให้เตะกลับไปหน้าตัวเอง)
    if (isDriverPath && role !== 'rider') {
      return NextResponse.redirect(new URL(getRoleHome(role), request.url))
    }

    // 4. ถ้า Role เป็น Admin ให้เข้าหน้า Admin ได้ (ถ้าเป็น Role อื่นพยายามเข้า ให้เตะกลับไปหน้าตัวเอง)
    if (isAdminPath && role !== 'branch_admin' && role !== 'super_admin') {
      return NextResponse.redirect(new URL(getRoleHome(role), request.url))
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