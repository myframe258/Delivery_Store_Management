import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import BranchGuard from '@/components/utilities/BranchGuard';
import StorefrontClient from './StorefrontClient';
import { MapPin, Phone, ShoppingBag, CheckCircle2, Megaphone, Image as ImageIcon } from 'lucide-react';

export const dynamic = 'force-dynamic'; // เพิ่มบรรทัดนี้เพื่อบังคับให้ Next.js ดึงข้อมูลใหม่เสมอ ไม่จำ Cache โบราณ

type ProductRecord = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category_id: string | null;
  is_track_stock?: boolean;
  product_units?: {
    name: string;
    step_value: number;
    min_value: number;
  } | any;
};

type InventoryRecord = {
  stock_count: number;
  status: number;
  products: ProductRecord | ProductRecord[] | null;
};

export default async function BranchStorefrontPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const supabase = await createClient();

  // 1. ดึงข้อมูลสาขา เพื่อใช้แสดงหัวเว็บ
  const { data: branch, error: branchError } = await supabase
    .from('branches')
    .select('id, name, address, phone')
    .eq('id', branchId)
    .single();

  if (branchError || !branch) {
    // หากไม่พบสาขา ให้แสดงหน้า 404 Not Found
    notFound();
  }

  // 2. ดึงสินค้าที่มีในสต็อกของสาขานี้ (JOIN branch_inventory กับ products)
  const { data: inventory, error: inventoryError } = await supabase
    .from('branch_inventory')
    .select(`
      stock_count,
      status,
      products!inner (
        id,
        name,
        description,
        price,
        image_url,
        category_id,
        is_track_stock,
        product_units (
          name,
          step_value,
          min_value
        )
      )
    `)
    .eq('branch_id', branchId)
    .neq('status', 0); // ดึงเฉพาะสินค้าที่สถานะไม่ใช่ out_of_stock

  // 3. ดึงข้อมูลประเภทสินค้า (Categories) เพื่อสร้าง Tabs เมนู
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, parent_id')
    .order('sort_order', { ascending: true });

  // แปลงข้อมูลให้อ่านง่ายขึ้น
  const products = (inventory as InventoryRecord[] | null)?.map((item) => {
    const prod = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!prod) return null;
    
    // กรองสินค้าที่ต้องนับสต็อกแต่สต็อกหมดทิ้งไป (ถ้าไม่ต้องนับสต็อก แม้สต็อกเป็น 0 ก็ให้ผ่านได้)
    if (prod.is_track_stock !== false && item.stock_count <= 0) {
      return null;
    }

    const unit = Array.isArray(prod.product_units) ? prod.product_units[0] : prod.product_units;

    return {
      id: prod.id,
      name: prod.name || '',
      description: prod.description || '',
      price: prod.price,
      image_url: prod.image_url,
      category_id: prod.category_id || null,
      stock_count: item.stock_count,
      is_track_stock: prod.is_track_stock !== false,
      unit_name: unit?.name,
      step_value: unit?.step_value ? Number(unit.step_value) : undefined,
      min_value: unit?.min_value ? Number(unit.min_value) : undefined,
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null) || [];

  return (
    <>
      <BranchGuard />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header ของสาขา */}
          <header className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 mt-2 md:mt-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="pl-2 md:pl-4">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{branch.name}</h1>
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="w-4 h-4" /> เปิดให้บริการ
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm text-gray-500 mt-4">
                  <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-500" /> {branch.address}</div>
                  {branch.phone && <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-blue-500" /> {branch.phone}</div>}
                </div>
              </div>
              <Link
                href={`/checkout?branchId=${branch.id}`}
                className="group relative flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-[0.98] w-full md:w-auto overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                <ShoppingBag className="w-5 h-5 relative z-10" /> 
                <span className="relative z-10">ดำเนินการชำระเงิน</span>
              </Link>
            </div>
          </header>

          {/* ----------------------------------------------------- */}
          {/* ส่วนพื้นที่โฆษณา / โปรโมชัน (Ad Banner Placeholder) */}
          {/* ----------------------------------------------------- */}
          <section className="mb-8 relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-white border border-slate-200 shadow-sm aspect-[16/7] md:aspect-[24/7] lg:aspect-[28/7] flex items-center justify-center group cursor-pointer hover:shadow-md transition-shadow">
            
            {/* พื้นหลังตกแต่ง UI (Graphic Decoration) */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 -translate-x-1/2 translate-y-1/2"></div>

            <div className="text-center p-6 md:p-8 relative z-10 bg-white/70 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 mx-4 md:mx-auto max-w-xs md:max-w-md">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white/90 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-sm text-blue-600 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                <Megaphone className="w-6 h-6 md:w-8 md:h-8" />
              </div>
              <h3 className="text-lg md:text-2xl font-bold text-slate-800 mb-1 md:mb-2">พื้นที่โฆษณาและโปรโมชัน</h3>
              <p className="text-xs md:text-sm text-slate-600 flex items-center justify-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> เตรียมพร้อมสำหรับเชื่อมต่อระบบจัดการแบนเนอร์
              </p>
            </div>

            {/* Mockup Carousel Indicators ด้านล่าง */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              <div className="w-6 h-1.5 bg-blue-600 rounded-full shadow-sm transition-all duration-300"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full shadow-sm hover:bg-slate-400 transition-all duration-300"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full shadow-sm hover:bg-slate-400 transition-all duration-300"></div>
            </div>
          </section>

          {/* Client Component จัดการแถบเมนูแยกหมวดหมู่และ Grid สินค้า */}
          <StorefrontClient products={products} categories={categories || []} branchId={branchId} />

        </div>
      </div>
    </>
  );
}