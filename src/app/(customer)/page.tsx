import { supabase } from '../../lib/supabase';

// ปิดการ Cache เพื่อให้ดึงข้อมูลใหม่จาก Database ทุกครั้งที่มีการเข้าหน้านี้
export const revalidate = 0;

export default async function StorefrontPage() {
  // ดึงข้อมูลจากตาราง products
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return <div className="p-10 text-red-500">Error: {error.message}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900">ร้านค้าของเรา</h1>
        <p className="text-gray-500 mt-2">เลือกสินค้าที่ต้องการ แล้วเราจะไปส่งให้ถึงที่</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {products?.map((product) => (
          <div key={product.id} className="bg-white border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="h-56 bg-gray-100 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="object-cover h-full w-full" />
              ) : (
                <span className="text-gray-400">ไม่มีรูปภาพ</span>
              )}
            </div>
            <div className="p-5">
              <h2 className="text-xl font-bold text-gray-800">{product.name}</h2>
              <p className="text-gray-600 mt-2 line-clamp-2">{product.description}</p>
              <div className="mt-5 flex justify-between items-center">
                <span className="text-2xl font-bold text-blue-600">฿{Number(product.price).toLocaleString()}</span>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors">
                  ใส่รถเข็น
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {products?.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          ยังไม่มีสินค้าในระบบ กรุณาเพิ่มข้อมูลใน Supabase
        </div>
      )}
    </div>
  );
}
