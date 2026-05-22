import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import BranchGuard from '@/components/utilities/BranchGuard';
import StorefrontClient from './StorefrontClient';

export const dynamic = 'force-dynamic'; // เพิ่มบรรทัดนี้เพื่อบังคับให้ Next.js ดึงข้อมูลใหม่เสมอ ไม่จำ Cache โบราณ

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
      products (
        id,
        name,
        description,
        price,
        image_url,
        category_id
      )
    `)
    .eq('branch_id', branchId)
    .gt('stock_count', 0) // ดึงเฉพาะสินค้าที่มีสต็อกมากกว่า 0
    .neq('status', 0); // ดึงเฉพาะสินค้าที่สถานะไม่ใช่ out_of_stock

  // 3. ดึงข้อมูลประเภทสินค้า (Categories) เพื่อสร้าง Tabs เมนู
  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
    .order('created_at');

  // แปลงข้อมูลให้อ่านง่ายขึ้น
  const products = inventory?.map((item: any) => {
    const prod = Array.isArray(item.products) ? item.products[0] : item.products;
    return {
      id: prod?.id,
      name: prod?.name,
      description: prod?.description,
      price: prod?.price,
      image_url: prod?.image_url,
      category_id: prod?.category_id || null, // ตรวจสอบให้แน่ใจว่าดึง category_id มาใช้งานแล้ว
      stock_count: item.stock_count,
    };
  }) || [];

  return (
    <>
      <BranchGuard />
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header ของสาขา */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{branch.name}</h1>
            <p className="text-gray-500 mt-1">{branch.address}</p>
          </div>
          <Link
            href={`/checkout?branchId=${branch.id}`}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition flex items-center shadow-sm"
          >
            ดำเนินการชำระเงิน
          </Link>
        </header>

        {/* Client Component จัดการแถบเมนูแยกหมวดหมู่และ Grid สินค้า */}
        <StorefrontClient products={products} categories={categories || []} branchId={branchId} />

      </div>
    </div>
    </>
  );
}
