'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useCartStore } from '@/store/cartStore';
import { useBranchStore } from '@/store/branchStore';
import { ShoppingCart, LogOut, User, Package, Map as MapIcon, Truck, MapPin, Home, Store, LogIn, Megaphone, ChevronDown, Settings, List, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Zustand Stores
  const items = useCartStore((state) => state.items);
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const activeBranchId = useBranchStore((state) => state.activeBranchId);

  // 🌟 ตั้งค่าแบรนด์ของลูกค้า (โลโก้ และ สี) ตรงนี้เพื่อให้เปลี่ยนง่ายๆ สำหรับแต่ละโปรเจกต์
  const BRAND_CONFIG = {
    name: 'Batch_Delivery', // เปลี่ยนชื่อร้านที่นี่
    colorClass: '',   // ใช้สีหลักที่กำหนดใน tailwind.config.ts
    Icon: MapPin,                  // เปลี่ยนไอคอนที่นี่ (จาก lucide-react)
    logoImageUrl: '/logo.png'   // [ตัวเลือกเสริม] หากมีไฟล์รูปโลโก้ สามารถนำมาใช้แทน Icon ได้
  };

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

  // Close mobile menu on route change (for browser back/forward)
  useEffect(() => {
    if (isMobileMenuOpen) setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  // ฟังก์ชันแปลชื่อ Role เป็นภาษาไทยให้แสดงผลสวยงาม
  const getRoleDisplay = (r: string | null) => {
    if (r === 'super_admin') return 'ผู้ดูแลระบบสูงสุด';
    if (r === 'branch_admin') return 'ผู้จัดการสาขา';
    if (r === 'rider') return 'พนักงานขับรถ';
    if (r === 'picker') return 'พนักงานจัดของ';
    if (r === 'customer') return 'ลูกค้า';
    return 'ลูกค้าทั่วไป';
  };

  return (
    <nav className="fixed top-0 left-0 w-full bg-white border-b border-gray-200 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 flex justify-between items-center text-slate-800 h-16">

        {/* Logo / หน้าหลัก */}
        <Link href="/" className={`flex items-center gap-2 font-bold text-xl ${BRAND_CONFIG.colorClass} hover:opacity-80 transition`}>
          {BRAND_CONFIG.logoImageUrl ? (
            <img src={BRAND_CONFIG.logoImageUrl} alt={BRAND_CONFIG.name} className="h-12 w-auto object-contain" />
          ) : (
            <BRAND_CONFIG.Icon className="w-8 h-8" />
          )}
          <span className="hidden sm:inline-block">{BRAND_CONFIG.name}</span>
        </Link>

        {/* เมนูตรงกลาง (แสดงตาม Role) */}
        <div className="hidden md:flex items-center gap-6 font-medium text-sm">
          <Link href="/" className="hover:text-blue-600 transition">หน้าหลัก (ค้นหาสาขา)</Link>

          {role === 'super_admin' && (
            <div className="relative group h-full flex items-center">
              <button className="flex items-center gap-1 hover:text-blue-600 transition py-2">
                <Settings className="w-4 h-4" /> จัดการระบบ <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute top-full left-0 mt-0 w-64 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden flex flex-col py-2 z-50">

                <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">ร้านค้าและพนักงาน</div>
                <Link href="/super-admin/branches" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Store className="w-4 h-4" /> ข้อมูลสาขา
                </Link>
                <Link href="/super-admin/users" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <User className="w-4 h-4" /> สิทธิ์ผู้ใช้งาน
                </Link>

                <div className="w-full h-px bg-gray-100 my-1"></div>
                <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">สินค้าและโปรโมชัน</div>
                <Link href="/super-admin/products" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Package className="w-4 h-4" /> ฐานข้อมูลสินค้า (Master)
                </Link>
                <Link href="/super-admin/branch-discounts" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Store className="w-4 h-4" /> สต็อกรายสาขา
                </Link>
                <Link href="/super-admin/promotions" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Megaphone className="w-4 h-4" /> แบนเนอร์โปรโมชัน
                </Link>

                <div className="w-full h-px bg-gray-100 my-1"></div>
                <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">ตั้งค่าพื้นฐาน</div>
                <Link href="/super-admin/categories" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <List className="w-4 h-4" /> หมวดหมู่สินค้า
                </Link>
                <Link href="/super-admin/units" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Package className="w-4 h-4" /> หน่วยนับสินค้า
                </Link>
                <Link href="/super-admin/delivery-slots" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Truck className="w-4 h-4" /> รอบจัดส่ง
                </Link>
              </div>
            </div>
          )}

          {role === 'branch_admin' && (
            <div className="relative group h-full flex items-center">
              <button className="flex items-center gap-1 hover:text-blue-600 transition py-2">
                <Store className="w-4 h-4" /> จัดการสาขา <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute top-full left-0 mt-0 w-56 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden flex flex-col py-2 z-50">

                <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">คลังสินค้า</div>
                <Link href="/branch-admin/inventory" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Package className="w-4 h-4" /> จัดการสต็อกสินค้า
                </Link>

                <div className="w-full h-px bg-gray-100 my-1"></div>
                <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">จัดการออเดอร์</div>
                <Link href="/picker/dashboard" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Package className="w-4 h-4" /> งานจัดของ
                </Link>
                <Link href="/branch-admin/batching" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <MapIcon className="w-4 h-4" /> จัดรอบส่งสินค้า
                </Link>

                <div className="w-full h-px bg-gray-100 my-1"></div>
                <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">พนักงานจัดส่ง / นัดรับ</div>
                <Link href="/picker/pickups" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Store className="w-4 h-4" /> ออเดอร์นัดรับที่ร้าน
                </Link>
                <Link href="/rider/batches" className="px-4 py-2.5 hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-700 transition-colors">
                  <Truck className="w-4 h-4" /> หน้าจอคนขับ (Rider)
                </Link>
              </div>
            </div>
          )}

          {role === 'picker' && (
            <>
              <Link href="/picker/dashboard" className="flex items-center gap-1 hover:text-blue-600 transition">
                <Package className="w-4 h-4" /> งานจัดของ
              </Link>
              <Link href="/picker/pickups" className="flex items-center gap-1 hover:text-blue-600 transition">
                <Store className="w-4 h-4" /> ออเดอร์รับที่ร้าน
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
        <div className="flex items-center gap-2 sm:gap-4">

          {/* ตะกร้าสินค้า */}
          {/* <Link href="/checkout" className="relative p-2 hover:bg-slate-50 rounded-full transition">
            <ShoppingCart className="w-6 h-6 text-slate-700" />
            {cartItemCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                {cartItemCount}
              </span>
            )}
          </Link> */}

          {/* <div className="w-px h-6 bg-gray-300 hidden sm:block"></div> */}

          {/* Login / Logout Section */}
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link href="/profile" className="flex items-center gap-2 bg-slate-50 hover:bg-blue-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-gray-100 hover:border-blue-200 transition group" title="จัดการโปรไฟล์">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Profile" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover border border-white shadow-sm" />
                ) : (
                  <User className="w-5 h-5 text-slate-500 group-hover:text-blue-600 transition" />
                )}
                <div className="hidden sm:flex flex-col items-start justify-center">
                  <span className="text-xs font-medium text-slate-700 max-w-[100px] truncate leading-none group-hover:text-blue-700">
                    {user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[9px] font-bold text-blue-600 mt-1 leading-none">{getRoleDisplay(role)}</span>
                </div>
              </Link>
              <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition" title="ออกจากระบบ">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition shadow-sm">
              เข้าสู่ระบบ
            </Link>
          )}

          {/* Hamburger Menu Button (Mobile) */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200" id="mobile-menu">
          <div className="px-4 pt-2 pb-4 space-y-1">
            <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">หน้าหลัก (ค้นหาสาขา)</Link>

            {role === 'super_admin' && (
                <>
                    <div className="pt-3 pb-1 px-3 text-xs font-semibold text-gray-500 uppercase">จัดการระบบ</div>
                    <Link href="/super-admin/branches" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">ข้อมูลสาขา</Link>
                    <Link href="/super-admin/users" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">สิทธิ์ผู้ใช้งาน</Link>
                    <Link href="/super-admin/products" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">ฐานข้อมูลสินค้า (Master)</Link>
                    <Link href="/super-admin/branch-discounts" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">สต็อกรายสาขา</Link>
                    <Link href="/super-admin/promotions" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">แบนเนอร์โปรโมชัน</Link>
                    <Link href="/super-admin/categories" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">หมวดหมู่สินค้า</Link>
                    <Link href="/super-admin/units" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">หน่วยนับสินค้า</Link>
                    <Link href="/super-admin/delivery-slots" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">รอบจัดส่ง</Link>
                </>
            )}

            {role === 'branch_admin' && (
                <>
                    <div className="pt-3 pb-1 px-3 text-xs font-semibold text-gray-500 uppercase">จัดการสาขา</div>
                    <Link href="/branch-admin/inventory" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">จัดการสต็อกสินค้า</Link>
                    <Link href="/picker/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">งานจัดของ</Link>
                    <Link href="/branch-admin/batching" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">จัดรอบส่งสินค้า</Link>
                    <Link href="/picker/pickups" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">ออเดอร์นัดรับที่ร้าน</Link>
                    <Link href="/rider/batches" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">หน้าจอคนขับ (Rider)</Link>
                </>
            )}

            {role === 'picker' && (
                <>
                    <Link href="/picker/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">งานจัดของ</Link>
                    <Link href="/picker/pickups" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">ออเดอร์รับที่ร้าน</Link>
                </>
            )}

            {role === 'rider' && (
                <Link href="/rider/batches" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">งานส่งของ</Link>
            )}

            {(role === 'customer' || !role) && (
                <Link href="/orders" onClick={() => setIsMobileMenuOpen(false)} className="block rounded-md px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600">การสั่งซื้อของฉัน</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}