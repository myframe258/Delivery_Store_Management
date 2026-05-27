import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 1. เพิ่ม async หน้าฟังก์ชัน
export async function createClient() {
  // 2. เพิ่ม await หน้า cookies()
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // ตอนนี้ cookieStore จะมีฟังก์ชัน getAll แล้ว
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // เซตใน Server Component ไม่ได้ (แต่ Middleware จะช่วยจัดการ)
          }
        },
      },
    }
  )
}