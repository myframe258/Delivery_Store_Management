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

        router.push('/dashboard');
        router.refresh(); 
      }
    });

    return () => subscription.unsubscribe();
  }, [router, supabase]);

  // ฟังก์ชันสำหรับล็อกอินด้วย Custom Provider (LINE)
  const signInWithLine = () => {
    // นำทางผู้ใช้ไปยัง Route ของเราเพื่อขอ Authorization Code จาก LINE
    window.location.href = '/api/auth/line/login';
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
          className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#00C300] hover:bg-[#00B300] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00C300] transition-colors"
        >
          {/* สามารถใส่ Icon ของ LINE ตรงนี้ได้ถ้ามี */}
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
          // ⚠️ เอา providers={['line']} ออก เพื่อให้เหลือแค่การใช้ Email อย่างเดียว
        />
      </div>
    </div>
  );
}