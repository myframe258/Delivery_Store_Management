'use client';

import { useEffect, useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/client';

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    // อ่านค่า returnTo จาก URL เพื่อให้กลับไปหน้าเดิม (เช่น หน้า Checkout)
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo') || '/dashboard';

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || session) {
        const role = session?.user?.app_metadata?.role || session?.user?.user_metadata?.role;
        
        if (session?.user && !role) {
          await supabase.auth.updateUser({
            data: { role: 'customer' }
          });
        }

        router.push(returnTo);
        router.refresh(); 
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  // ฟังก์ชันสำหรับล็อกอินด้วย Custom API (LINE)
  const signInWithLine = () => {
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo') || '/';
    
    // กลับไปใช้ API Route เดิมที่ระบบมีอยู่แล้ว
    window.location.href = `/api/auth/line/login?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        <div>
          <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
            เข้าสู่ระบบ
          </h2>
        </div>
        
        {/* ปุ่ม LINE Custom Button */}
        <button
          onClick={signInWithLine}
          type="button"
          className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-[#00C300] hover:bg-[#00B300] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00C300] transition-colors"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
            <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 3.961 8.905 9.479 9.605.372.079.873.242.999.554.113.279.073.716.035 1.008-.005.042-.046.29-.22.846-.211.666 1.01.597 1.543.276.533-.321 2.871-1.696 3.964-2.913C21.439 17.067 24 13.918 24 10.304z"/>
          </svg>
          เข้าสู่ระบบด้วย LINE
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">หรือ</span>
          </div>
        </div>
        
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb', 
                  brandAccent: '#1d4ed8',
                }
              }
            }
          }}
          providers={[]} // กำหนดเป็น array ว่างเพื่อซ่อนปุ่ม Social Login (เช่น Github) ทั้งหมด
        />
      </div>
    </div>
  );
}