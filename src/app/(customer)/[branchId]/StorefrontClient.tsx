'use client';

import { useState } from 'react';
import { Package } from 'lucide-react';
import AddToCartButton from '@/components/ui/AddToCartButton';

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

  // กรองสินค้าแบบเรียลไทม์ (ถ้าเลือก 'ทั้งหมด' หรือ id เป็น null ให้แสดงทั้งหมด)
  const filteredProducts = selectedCategory
    ? products.filter(p => p.category_id === selectedCategory)
    : products;

  return (
    <div className="w-full flex flex-col space-y-8">
      {/* Category Navigation Tabs (Horizontal Scrollable) */}
      {categories && categories.length > 0 && (
        <div className="w-full overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-center gap-3 w-max pb-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold transition-colors duration-200 border ${
                selectedCategory === null
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              ทั้งหมด
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex-shrink-0 whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-semibold transition-colors duration-200 border ${
                  selectedCategory === cat.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product Grid */}
      {filteredProducts.length === 0 ? (
        <div className="w-full text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
          <Package className="w-16 h-16 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg font-medium">ขออภัย ไม่มีสินค้าในหมวดหมู่นี้</p>
        </div>
      ) : (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300 h-full">
              
              {/* Image Container with strict Aspect Ratio */}
              <div className="w-full aspect-[4/3] bg-slate-50 relative flex-shrink-0 overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                    <Package className="w-10 h-10 mb-2 opacity-50" />
                    <span className="text-xs font-medium">ไม่มีรูปภาพ</span>
                  </div>
                )}
              </div>
              
              {/* Content Container */}
              <div className="p-5 flex flex-col flex-1">
                <h2 className="font-semibold text-lg text-slate-800 mb-1 line-clamp-1">{product.name}</h2>
                <p className="text-sm text-slate-500 mb-5 line-clamp-2 leading-relaxed flex-1">{product.description || '-'}</p>
                
                <div className="mt-auto flex items-center justify-between mb-4">
                  <span className="font-bold text-xl text-blue-600">฿{product.price.toLocaleString()}</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">เหลือ: {product.stock_count}</span>
                </div>
                
                <div className="w-full">
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
    </div>
  );
}