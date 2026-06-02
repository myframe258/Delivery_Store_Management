import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';

export const dynamic = 'force-dynamic';

export default async function BranchInventoryPage() {
  const supabase = await createClient();

  // 1. ตรวจสอบ session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirect('/login');

  // 2. หา branch_id ของ User
  const { data: userProfile } = await supabase
    .from('users')
    .select('branch_id, role')
    .eq('id', user.id)
    .single();

  if (!userProfile?.branch_id || userProfile.role !== 'branch_admin') {
    return <div className="p-8 text-center text-red-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ (เฉพาะแอดมินสาขา)</div>;
  }

  const branchId = userProfile.branch_id;

  // 3. ดึงข้อมูลสาขา
  const { data: branchData } = await supabase
    .from('branches')
    .select('id, name')
    .eq('id', branchId)
    .single();

  // 4. ดึงสินค้าทั้งหมดจากส่วนกลาง (Master)
  const { data: productsData } = await supabase
    .from('products')
    .select('id, sku, name, price, image_url, is_track_stock, category_id, categories(name)')
    .order('name');

  // 5. ดึงสต็อกสินค้าเฉพาะของสาขานี้
  const { data: inventoryData } = await supabase
    .from('branch_inventory')
    .select('product_id, stock_count, status, discount_price')
    .eq('branch_id', branchId);

  // 6. แปลงและรวมข้อมูลให้ฝั่ง Client ใช้งานได้สะดวก
  const mergedInventory = productsData?.map(product => {
    const inv = inventoryData?.find(i => i.product_id === product.id);
    const category = Array.isArray(product.categories) ? product.categories[0] : product.categories;
    return {
      product_id: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      image_url: product.image_url,
      stock_count: inv?.stock_count || 0,
      status: inv?.status || 0, // 1 = เปิดขาย, 0 = ปิดขาย
      discount_price: inv?.discount_price || null,
      is_track_stock: product.is_track_stock !== false,
      category_id: product.category_id,
      category_name: category?.name || 'ไม่มีหมวดหมู่'
    };
  }) || [];

  return (
    <InventoryClient 
      initialInventory={mergedInventory} 
      branch={branchData} 
    />
  );
}