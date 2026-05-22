'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useCartStore } from '@/store/cartStore';
import { useBranchStore } from '@/store/branchStore';
import { ShoppingCart, LogOut, User, Package, Map as MapIcon, Truck, MapPin, Home, Store, LogIn } from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Zustand Stores
  const items = useCartStore((state) => state.items);
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const activeBranchId = useBranchStore((state) => state.activeBranchId);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    setIsMounted(true); // ป้องกัน Hydration Mismatch จาก LocalStorage

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

  // ฟังก์ชันแปลชื่อ Role เป็นภาษาไทยให้แสดงผลสวยงาม
  const getRoleDisplay = (r: string | null) => {
    if (r === 'super_admin') return 'ผู้ดูแลระบบสูงสุด';
    if (r === 'branch_admin') return 'ผู้จัดการสาขา';
    if (r === 'rider') return 'พนักงานขับรถ';
    if (r === 'customer') return 'ลูกค้า';
    return 'ลูกค้าทั่วไป';
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

          {role === 'super_admin' && (
            <>
              <Link href="/super-admin/branches" className="flex items-center gap-1 hover:text-blue-600 transition">
                <Store className="w-4 h-4" /> จัดการสาขา
              </Link>
              <Link href="/super-admin/products" className="flex items-center gap-1 hover:text-blue-600 transition">
                <Package className="w-4 h-4" /> จัดการสินค้า
              </Link>
              <Link href="/super-admin/users" className="flex items-center gap-1 hover:text-blue-600 transition">
                <User className="w-4 h-4" /> จัดการสิทธิ์
              </Link>
              <Link href="/super-admin/categories" className="flex items-center gap-1 hover:text-blue-600 transition">
                <MapIcon className="w-4 h-4" /> จัดการหมวดหมู่
              </Link>
            </>
          )}

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

          {(role === 'customer' || !role) && (
            <Link href="/orders" className="flex items-center gap-1 hover:text-blue-600 transition">
              <Package className="w-4 h-4" /> การสั่งซื้อของฉัน
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
                <div className="flex flex-col items-start justify-center">
                  <span className="text-xs font-medium text-slate-700 max-w-[80px] truncate leading-none">{user.email?.split('@')[0]}</span>
                  <span className="text-[9px] font-bold text-blue-600 mt-1 leading-none">{getRoleDisplay(role)}</span>
                </div>
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