'use client';

import { useState, useMemo, useEffect } from 'react';
import { Package, Search, LayoutGrid, AlertCircle, ChevronDown, ShoppingCart } from 'lucide-react';
import AddToCartButton from '@/components/ui/AddToCartButton';
import Link from 'next/link';
import { useCartStore } from '@/store/cartStore';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  stock_count: number;
}

interface Category {
  id: string;
  name: string;
}

interface StorefrontClientProps {
  products: Product[];
  categories: Category[];
  branchId: string;
}

export default function StorefrontClient({ products, categories, branchId }: StorefrontClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [isMounted, setIsMounted] = useState(false);

  // ดึงข้อมูลตะกร้าสินค้าจาก Zustand Store
  const cartItems = useCartStore((state: any) => state.items || []);
  const branchCartItems = cartItems.filter((item: any) => item.branchId === branchId);
  const totalItems = branchCartItems.reduce((sum: number, item: any) => sum + item.quantity, 0);
  const totalPrice = branchCartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

  // รีเซ็ตจำนวนที่แสดงผลเมื่อเปลี่ยนหมวดหมู่หรือค้นหา
  useEffect(() => {
    setVisibleCount(20);
  }, [selectedCategory, searchQuery]);

  // ป้องกันหน้าเว็บกระตุก (Hydration Mismatch) ระหว่าง Server กับ Client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // กรองสินค้าแบบเรียลไทม์
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = selectedCategory ? p.category_id === selectedCategory : true;
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // สินค้าที่จะแสดงตามจำนวน Load More
  const visibleProducts = filteredProducts.slice(0, visibleCount);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 20);
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-8 items-start relative">
      
      {/* --- Mobile: Sticky Tab & Search --- */}
      <div className="lg:hidden sticky top-14 md:top-16 z-30 bg-gray-50 pt-2 pb-4 -mx-6 px-6 w-[calc(100%+3rem)] space-y-3 shadow-sm border-b border-gray-200/60">
        {/* Mobile Search */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาสินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>
        
        {/* Mobile Category */}
        {categories && categories.length > 0 && (
          <div className="overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex items-center gap-2 w-max pb-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`flex-shrink-0 whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === null
                    ? 'bg-slate-800 text-white shadow-md border border-slate-800'
                    : 'bg-white text-slate-600 border border-slate-200 active:scale-95'
                }`}
              >
                หมวดหมู่ทั้งหมด
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex-shrink-0 whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-md border border-blue-600'
                      : 'bg-white text-slate-600 border border-slate-200 active:scale-95'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* --- Desktop: Sticky Sidebar --- */}
      <aside className="hidden lg:flex flex-col w-64 flex-shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto pr-4 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
        {/* Desktop Search */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Search className="w-5 h-5" /> ค้นหาสินค้า
          </h3>
          <div className="relative">
            <input
              type="text"
              placeholder="ชื่อสินค้า..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            />
          </div>
        </div>

        {/* Desktop Category */}
        <div className="space-y-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" /> หมวดหมู่
          </h3>
          <div className="flex flex-col space-y-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                selectedCategory === null
                  ? 'bg-slate-800 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              ทั้งหมด
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-200/50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* --- Main Content: Product Grid --- */}
      {/* หากมีของในตะกร้า จะเพิ่ม Padding ด้านล่าง (pb-28) ป้องกันปุ่มลอยบังปุ่มโหลดเพิ่มเติมบนมือถือ */}
      <main className={`flex-1 w-full min-w-0 flex flex-col ${isMounted && totalItems > 0 ? 'pb-28 lg:pb-8' : 'pb-8'}`}>
        
        {/* Meta info */}
        <div className="hidden lg:flex justify-between items-center mb-6 text-sm text-slate-500">
          <p>
            พบสินค้า <strong>{filteredProducts.length}</strong> รายการ
            {searchQuery && <span> สำหรับ "{searchQuery}"</span>}
          </p>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="w-full text-center py-20 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-slate-300" />
            </div>
            <p className="text-slate-500 text-lg font-medium">ไม่พบสินค้าที่คุณค้นหา</p>
            <button 
              onClick={() => { setSearchQuery(''); setSelectedCategory(null); }}
              className="mt-4 px-6 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              ล้างการค้นหา
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {visibleProducts.map((product) => (
              <div 
                key={product.id} 
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-lg hover:border-blue-300 hover:-translate-y-1 transition-all duration-300 h-full group"
              >
                <div className="w-full h-40 sm:h-48 bg-slate-50 relative flex-shrink-0 overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                      <Package className="w-8 h-8 mb-2 opacity-50" />
                      <span className="text-xs font-medium">ไม่มีรูปภาพ</span>
                    </div>
                  )}
                </div>
                
                <div className="p-3 sm:p-5 flex flex-col flex-grow">
                  <h2 className="font-semibold text-sm sm:text-lg text-slate-800 mb-1 line-clamp-2 leading-tight" title={product.name}>
                    {product.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed flex-grow">
                    {product.description || '-'}
                  </p>
                  
                  <div className="mt-3 sm:mt-4 flex items-end justify-between mb-3 sm:mb-4">
                    <span className="font-bold text-base sm:text-xl text-blue-600">฿{product.price.toLocaleString()}</span>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">
                      คงเหลือ {product.stock_count}
                    </span>
                  </div>
                  
                  <div className="w-full mt-auto">
                    <AddToCartButton 
                      product={{
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        image_url: product.image_url ?? undefined
                      }} 
                      branchId={branchId} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {visibleCount < filteredProducts.length && (
          <div className="w-full flex justify-center mt-10">
            <button 
              onClick={handleLoadMore} 
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-8 py-3 rounded-full font-medium hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm active:scale-95"
            >
              โหลดสินค้าเพิ่มเติม <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* --- Floating Cart Button (Mobile & Tablet) --- */}
      {isMounted && totalItems > 0 && (
        // ใช้ pointer-events-none ที่ container เพื่อให้กดทะลุพื้นที่ว่างได้ แต่ใช้ auto กับตัว Link
        <div className="lg:hidden fixed bottom-6 left-0 right-0 px-4 sm:px-6 z-50 pointer-events-none">
          <Link href={`/checkout`} className="pointer-events-auto block max-w-md mx-auto">
            <div className="bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-600/40 p-4 flex items-center justify-between active:scale-95 transition-transform duration-200">
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <ShoppingCart className="w-6 h-6" />
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {totalItems}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-sm">ดูตะกร้าสินค้า</span>
                </div>
              </div>
              <div className="font-bold text-lg">
                ฿{totalPrice.toLocaleString()}
              </div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}