'use client';

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/client';

export default function LoginPage() {
  const router = useRouter();
  // สร้าง instance ของ Supabase client แบบใช้งานฝั่ง Client
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // ติดตามสถานะ (Session) ของผู้ใช้
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || session) {
        router.push('/dashboard');
        router.refresh(); // บังคับให้ Next.js โหลด Middleware เพื่ออัปเดตสิทธิ์การเข้าถึงใหม่
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            เข้าสู่ระบบ
          </h2>
          <p className="mt-2 text-center text-sm text-gray-500">
            สำหรับผู้ดูแลระบบและพนักงานจัดส่ง
          </p>
        </div>
        
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb', // สีฟ้า Tailwind blue-600
                  brandAccent: '#1d4ed8', // สีฟ้า Tailwind blue-700
                }
              }
            }
          }}
          providers={[]} // ปิดการใช้ Social Login
        />
      </div>
    </div>
  );
}