import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AddToCartButton from '@/components/ui/AddToCartButton';
import BranchGuard from '@/components/utilities/BranchGuard';

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
        image_url
      )
    `)
    .eq('branch_id', branchId)
    .gt('stock_count', 0) // ดึงเฉพาะสินค้าที่มีสต็อกมากกว่า 0
    .neq('status', 0); // ดึงเฉพาะสินค้าที่สถานะไม่ใช่ out_of_stock

  // แปลงข้อมูลให้อ่านง่ายขึ้น
  const products = inventory?.map((item: any) => ({
    ...item.products,
    stock_count: item.stock_count,
  })) || [];

  return (


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

        {/* Product Grid */}
        {products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-lg">ขออภัย ไม่มีสินค้าพร้อมจำหน่ายในสาขานี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition">
                <div className="h-48 bg-gray-100 w-full relative">
                  {/* ถ้ามี image_url สามารถใส่ <img src={product.image_url} /> ได้ตรงนี้ */}
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                    {product.name} Image
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-grow">
                  <h2 className="font-semibold text-lg text-gray-800 mb-1 line-clamp-1">{product.name}</h2>
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">{product.description}</p>
                  <div className="mt-auto flex items-center justify-between mb-3">
                    <span className="font-bold text-lg text-blue-600">฿{product.price.toLocaleString()}</span>
                    <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">เหลือ: {product.stock_count}</span>
                  </div>
                  <AddToCartButton product={product} branchId={branchId} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
