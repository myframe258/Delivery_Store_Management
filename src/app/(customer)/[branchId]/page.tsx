import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import BranchGuard from '@/components/utilities/BranchGuard';
import StorefrontClient from './StorefrontClient';
import { MapPin, Phone, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { unstable_cache } from 'next/cache';

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
  discount_price?: number | null;
  discount_end_date?: string | null;
  products: ProductRecord | ProductRecord[] | null;
};

// --- Caching Functions ---

// 1. Cache ข้อมูลสาขา (3600 วินาที / 1 ชั่วโมง)
const getCachedBranch = unstable_cache(
  async (branchId: string) => {
    const supabase = await createClient();
    return await supabase
      .from('branches')
      .select('id, name, address, phone')
      .eq('id', branchId)
      .single();
  },
  ['branch-data'], 
  { revalidate: 3600, tags: ['branches'] }
);

// 2. Cache ข้อมูลหมวดหมู่สินค้า (3600 วินาที / 1 ชั่วโมง)
const getCachedCategories = unstable_cache(
  async () => {
    const supabase = await createClient();
    return await supabase
      .from('categories')
      .select('id, name, parent_id')
      .order('sort_order', { ascending: true });
  },
  ['categories-data'],
  { revalidate: 3600, tags: ['categories'] }
);

// 3. Cache ข้อมูลโปรโมชัน (3600 วินาที / 1 ชั่วโมง)
const getCachedPromotions = unstable_cache(
  async (branchId: string) => {
    const supabase = await createClient();
    return await supabase
      .from('branch_promotions')
      .select('id, title, image_url, target_url')
      .or(`branch_id.eq.${branchId},branch_id.is.null`)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
  },
  ['promotions-data'],
  { revalidate: 3600, tags: ['promotions'] }
);

// 4. Cache สต็อกสินค้าและรายละเอียดสินค้า (60 วินาที / เพื่ออัปเดตสต็อกใกล้เคียง Real-time แต่ไม่ให้ DB พัง)
const getCachedInventory = unstable_cache(
  async (branchId: string) => {
    const supabase = await createClient();
    return await supabase
      .from('branch_inventory')
      .select(`
        stock_count,
        status,
        discount_price,
        discount_end_date,
        products!inner (
          id, name, description, price, image_url, category_id, is_track_stock,
          product_units (name, step_value, min_value)
        )
      `)
      .eq('branch_id', branchId)
      .neq('status', 0);
  },
  ['inventory-data'],
  { revalidate: 60, tags: ['inventory'] }
);

export default async function BranchStorefrontPage({
  params,
}: {
  params: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await params;
  const branchId = resolvedParams.branchId as string;

  // 1. ดึงข้อมูลสาขา เพื่อใช้แสดงหัวเว็บ
  const { data: branch, error: branchError } = await getCachedBranch(branchId);

  if (branchError || !branch) {
    // หากไม่พบสาขา ให้แสดงหน้า 404 Not Found
    notFound();
  }

  // 2. ดึงสินค้าที่มีในสต็อกของสาขานี้ (JOIN branch_inventory กับ products)
  const { data: inventory } = await getCachedInventory(branchId);

  // 3. ดึงข้อมูลประเภทสินค้า (Categories) เพื่อสร้าง Tabs เมนู
  const { data: categories } = await getCachedCategories();

  // 4. ดึงข้อมูลแบนเนอร์โปรโมชัน (is_active = true)
  const { data: promotions } = await getCachedPromotions(branchId);

  // แปลงข้อมูลให้อ่านง่ายขึ้น
  const products = (inventory as InventoryRecord[] | null)?.map((item) => {
    const prod = Array.isArray(item.products) ? item.products[0] : item.products;
    if (!prod) return null;
    
    const unit = Array.isArray(prod.product_units) ? prod.product_units[0] : prod.product_units;
    
    // ตรวจสอบว่าโปรโมชั่นหมดเวลาหรือยัง (ถ้าหมดแล้วให้ยกเลิกราคาลด)
    const isExpired = item.discount_end_date && new Date(item.discount_end_date).getTime() < new Date().getTime();

    return {
      id: prod.id,
      name: prod.name || '',
      description: prod.description || '',
      price: prod.price,
      image_url: prod.image_url,
      category_id: prod.category_id || null,
      stock_count: item.stock_count,
      discount_price: isExpired ? null : (item.discount_price || null),
      discount_end_date: isExpired ? null : (item.discount_end_date || null),
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

          {/* Client Component จัดการแถบเมนูแยกหมวดหมู่และ Grid สินค้า */}
          <StorefrontClient products={products} categories={categories || []} branchId={branchId} promotions={promotions || []} />

        </div>
      </div>
    </>
  );
}