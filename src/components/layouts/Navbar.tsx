'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useCartStore } from '@/store/cartStore';
import { ShoppingCart, LogOut, User, Package, Map as MapIcon, Truck, MapPin } from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const router = useRouter();
  
  // ดึงจำนวนสินค้าจาก Cart Store
  const items = useCartStore((state) => state.items);
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    // 1. ตรวจสอบ Session ตอนโหลดครั้งแรก
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      setRole(session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || null);
    };
    getSession();

    // 2. ดักจับการเปลี่ยนแปลงสถานะ Login แบบ Real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setRole(session?.user?.app_metadata?.role || session?.user?.user_metadata?.role || null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-white border-b border-gray-200 z-50 shadow-sm h-16 flex items-center">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 flex justify-between items-center text-slate-800">
        
        {/* Logo / หน้าหลัก */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 hover:opacity-80 transition">
          <MapPin className="w-6 h-6" />
          <span className="hidden sm:inline-block">BatchDelivery</span>
        </Link>

        {/* เมนูตรงกลาง (แสดงตาม Role) */}
        <div className="hidden md:flex items-center gap-6 font-medium text-sm">
          <Link href="/" className="hover:text-blue-600 transition">หน้าหลัก (ค้นหาสาขา)</Link>
          
          {role === 'branch_admin' && (
            <>
              <Link href="/branch-admin/inventory" className="flex items-center gap-1 hover:text-blue-600 transition">
                <Package className="w-4 h-4" /> จัดการสต็อก
              </Link>
              <Link href="/branch-admin/batching" className="flex items-center gap-1 hover:text-blue-600 transition">
                <MapIcon className="w-4 h-4" /> จัดรอบส่ง
              </Link>
            </>
          )}
          
          {role === 'rider' && (
            <Link href="/rider/batches" className="flex items-center gap-1 hover:text-blue-600 transition">
              <Truck className="w-4 h-4" /> งานส่งของ
            </Link>
          )}
        </div>

        {/* ส่วนขวา (ตะกร้า และ Auth) */}
        <div className="flex items-center gap-4">
          
          {/* ตะกร้าสินค้า */}
          <Link href="/checkout" className="relative p-2 hover:bg-slate-50 rounded-full transition">
            <ShoppingCart className="w-6 h-6 text-slate-700" />
            {cartItemCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {cartItemCount}
              </span>
            )}
          </Link>

          <div className="w-px h-6 bg-gray-300 hidden sm:block"></div>

          {/* Login / Logout Section */}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-gray-100">
                <User className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 truncate max-w-[120px]">{user.email?.split('@')[0]}</span>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition" title="ออกจากระบบ">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
              เข้าสู่ระบบ
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}