'use client';

import { useState, useMemo, useEffect, useDeferredValue } from 'react';
import { Package, Search, LayoutGrid, AlertCircle, ChevronDown, ShoppingCart, Plus, Minus, X } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useCartStore } from '@/store/cartStore';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category_id: string | null;
  stock_count: number;
  discount_price?: number | null;
  discount_end_date?: string | null;
  is_track_stock?: boolean;
  unit_name?: string;
  step_value?: number;
  min_value?: number;
}

interface Category {
  id: string;
  name: string;
  parent_id?: string | null;
}

interface Promotion {
  id: string;
  title: string;
  image_url: string;
  target_url: string | null;
}

interface StorefrontClientProps {
  products: Product[];
  categories: Category[];
  branchId: string;
  promotions?: Promotion[];
}

export default function StorefrontClient({ products, categories, branchId, promotions = [] }: StorefrontClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [isMounted, setIsMounted] = useState(false);
  const [cartAnimation, setCartAnimation] = useState(false);
  const [prevItemCount, setPrevItemCount] = useState(0);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [hasActiveTimer, setHasActiveTimer] = useState(false);

  // ดึงข้อมูลตะกร้าสินค้าจาก Zustand Store
  const cartItems = useCartStore((state) => state.items || []);
  const addItem = useCartStore((state: any) => state.addItem || state.addToCart);
  const updateQuantity = useCartStore((state: any) => state.updateQuantity || state.updateItem);
  const removeItem = useCartStore((state: any) => state.removeItem || state.removeFromCart);
  const branchCartItems = cartItems.filter((item: any) => item.branchId === branchId);
  
  // คำนวณราคาปัจจุบันของสินค้าในตะกร้าเทียบกับฐานข้อมูลล่าสุด (ป้องกันกรณีหยิบตอน Sale แล้วราคาเปลี่ยน)
  const effectiveCartItems = useMemo(() => {
    return branchCartItems.map((cartItem: any) => {
      const liveProduct = products.find(p => p.id === cartItem.id);
      // ถ้าระบบอัปเดตว่ายังมีราคาลด ให้ใช้ลด ถ้าไม่มีแล้วให้กลับไปใช้ราคาเต็ม
      const currentPrice = liveProduct ? (liveProduct.discount_price ?? liveProduct.price) : cartItem.price;
      return {
        ...cartItem,
        currentPrice,
        originalPrice: liveProduct?.price || cartItem.price,
        isDiscounted: liveProduct ? !!liveProduct.discount_price : false
      };
    });
  }, [branchCartItems, products]);

  // จัดการปัญหาทศนิยม (Floating Point Issue) ด้วยการปัดเศษ
  const totalItems = Number(effectiveCartItems.reduce((sum, item) => sum + item.quantity, 0).toFixed(2));
  const totalPrice = Number(effectiveCartItems.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0).toFixed(2));
  const formatNumber = (num: number) => Number.isInteger(num) ? num.toString() : num.toFixed(2).replace(/\.?0+$/, '');

  // จัดกลุ่มหมวดหมู่หลักและหมวดหมู่ย่อยให้อยู่ติดกัน
  const rootCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  // หา Root Category ID ปัจจุบัน (เพื่อให้รู้ว่าควรเปิด Subcategories ของหมวดหมู่ไหน)
  const activeCatObj = categories.find(c => c.id === selectedCategory);
  const activeRootCategoryId = activeCatObj?.parent_id ? activeCatObj.parent_id : activeCatObj?.id || null;

  // รีเซ็ตจำนวนที่แสดงผลเมื่อเปลี่ยนหมวดหมู่หรือค้นหา
  useEffect(() => {
    setVisibleCount(20);
  }, [selectedCategory, searchQuery]);

  // ป้องกันหน้าเว็บกระตุก (Hydration Mismatch) ระหว่าง Server กับ Client
  useEffect(() => {
    setIsMounted(true);
    setPrevItemCount(totalItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ดักจับเมื่อจำนวนสินค้าเพิ่มขึ้น เพื่อเล่นแอนิเมชัน (เช่น หยิบลงตะกร้า)
  useEffect(() => {
    if (isMounted && totalItems > prevItemCount) {
      setCartAnimation(true);
      // ปิดแอนิเมชันหลังจาก 500ms
      const timer = setTimeout(() => {
        setCartAnimation(false);
      }, 500);
      setPrevItemCount(totalItems);
      return () => clearTimeout(timer);
    } else if (totalItems !== prevItemCount) {
      setPrevItemCount(totalItems);
    }
  }, [totalItems, prevItemCount, isMounted]);

  // ป้องกันการ Scroll หน้าหลักเมื่อเปิดตะกร้า (Slide-over)
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isCartOpen]);

  // ระบบเล่นสไลด์แบนเนอร์อัตโนมัติ (Auto-play Carousel)
  useEffect(() => {
    if (!promotions || promotions.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % promotions.length);
    }, 5000); // เปลี่ยนรูปทุก 5 วินาที
    return () => clearInterval(timer);
  }, [promotions]);

  // กรองเฉพาะสินค้าที่ลดราคา (Flash Sale) และจัดเรียงให้สินค้าหมดไปอยู่ท้ายสุด
  const discountedProducts = useMemo(() => {
    const discounted = products.filter(p => p.discount_price != null);
    return discounted.sort((a, b) => {
      const aOut = a.is_track_stock !== false && a.stock_count <= 0;
      const bOut = b.is_track_stock !== false && b.stock_count <= 0;
      if (aOut === bOut) return 0;
      return aOut ? 1 : -1;
    });
  }, [products]);

  useEffect(() => {
    if (!isMounted) return;
    
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // หาเวลา discount_end_date ที่ใกล้ที่สุดจากสินค้าที่ลดราคา
      const validEndDates = discountedProducts
        .map(p => p.discount_end_date ? new Date(p.discount_end_date).getTime() : 0)
        .filter(time => time > now.getTime());

      if (validEndDates.length > 0) {
        const targetTime = Math.min(...validEndDates);
        const difference = targetTime - now.getTime();
        
        setHasActiveTimer(true);
        setTimeLeft({
          hours: Math.floor(difference / (1000 * 60 * 60)), // ชั่วโมง (อาจเกิน 24 ได้)
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setHasActiveTimer(false);
      }
    };

    calculateTimeLeft(); // คำนวณครั้งแรก
    const timer = setInterval(calculateTimeLeft, 1000); // อัปเดตทุก 1 วินาที
    return () => clearInterval(timer);
  }, [isMounted, discountedProducts]);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  // กรองสินค้าแบบเรียลไทม์
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      let matchCategory = true;
      if (selectedCategory) {
        // หากเลือกหมวดหมู่หลัก ให้ดึงสินค้าของหมวดหมู่ย่อยใต้ตัวมันออกมาแสดงด้วย
        const childIds = categories.filter(c => c.parent_id === selectedCategory).map(c => c.id);
        matchCategory = p.category_id === selectedCategory || (p.category_id !== null && childIds.includes(p.category_id));
      }
      
      const matchSearch =
        p.name.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ||
        (p.description?.toLowerCase().includes(deferredSearchQuery.toLowerCase()) ?? false);
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, deferredSearchQuery]);

  // เรียงลำดับสินค้า ให้สินค้าที่ "หมด" (Out of stock) ไปอยู่ล่างสุด
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      const aOut = a.is_track_stock !== false && a.stock_count <= 0;
      const bOut = b.is_track_stock !== false && b.stock_count <= 0;
      if (aOut === bOut) return 0;
      return aOut ? 1 : -1;
    });
  }, [filteredProducts]);

  // สินค้าที่จะแสดงตามจำนวน Load More
  const visibleProducts = sortedProducts.slice(0, visibleCount);

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 20);
  };

  // Component Card ย่อยสำหรับแสดงการ์ดสินค้า (นำไปใช้ซ้ำได้ทั้งแนวตั้งและแนวนอน)
  const renderProductCard = (product: Product, isHorizontal: boolean = false) => {
    const isOutOfStock = product.is_track_stock !== false && product.stock_count <= 0;
    const cartItem = branchCartItems.find((item: any) => item.id === product.id);
    const quantity = cartItem ? cartItem.quantity : 0;
    const step = product.step_value || 1;
    const min = product.min_value || 1;
    const displayQuantity = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, '');

    return (
      <div 
        key={product.id} 
        className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition-all duration-300 group relative ${isHorizontal ? 'w-40 sm:w-48 shrink-0 snap-start' : 'h-full'} ${isOutOfStock ? 'border-gray-200 opacity-80' : 'border-slate-200 hover:shadow-xl hover:border-blue-300 hover:-translate-y-1'}`}
      >
        {/* Visual Badges (บ่งบอกประเภทหน่วยนับ) */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {step < 1 ? (
            <span className="bg-blue-50/95 backdrop-blur-sm text-blue-600 border border-blue-100/50 text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm">⚖️ ชั่งตามน้ำหนัก</span>
          ) : (
            <span className="bg-slate-50/95 backdrop-blur-sm text-slate-600 border border-slate-100/50 text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm">📦 แพ็ก / ชิ้น</span>
          )}
          {product.discount_price && (
            <span className="bg-red-600/95 backdrop-blur-sm text-white border border-red-500 text-[10px] font-bold px-2.5 py-1 rounded-md shadow-sm flex items-center gap-1">🔥 SALE</span>
          )}
        </div>

        <div className="w-full aspect-[4/3] bg-slate-50 relative flex-shrink-0 overflow-hidden">
          {/* Overlay กรณีสินค้าหมด */}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/10 z-20 flex items-center justify-center backdrop-blur-[2px]">
              <span className="bg-white/95 text-red-600 font-bold px-4 py-1.5 rounded-xl shadow-lg rotate-[-5deg] text-sm sm:text-base border border-red-100">สินค้าหมด</span>
            </div>
          )}
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" className={`object-cover transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-80' : 'group-hover:scale-110'}`} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300"><Package className="w-8 h-8 mb-2 opacity-50" /><span className="text-xs font-medium">ไม่มีรูปภาพ</span></div>
          )}
        </div>
        
        <div className="p-3 sm:p-5 flex flex-col flex-grow">
          <h2 className="font-semibold text-sm sm:text-lg text-slate-800 mb-1 line-clamp-2 leading-tight" title={product.name}>{product.name}</h2>
          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed flex-grow">{product.description || '-'}</p>
          
          <div className="mt-auto space-y-3 pt-3">
            <div className="flex items-end justify-between gap-1">
              {product.discount_price ? (
                <div className="flex flex-col">
                  <span className="font-bold text-base sm:text-xl text-red-600 truncate">฿{product.discount_price.toLocaleString()}{product.unit_name ? ` / ${product.unit_name}` : ''}</span>
                  <span className="text-[10px] sm:text-xs text-slate-400 line-through font-medium">฿{product.price.toLocaleString()}{product.unit_name ? ` / ${product.unit_name}` : ''}</span>
                </div>
              ) : (
                <span className="font-bold text-base sm:text-xl text-blue-600 truncate">฿{product.price.toLocaleString()}{product.unit_name ? ` / ${product.unit_name}` : ''}</span>
              )}
            </div>
            
            {/* Interactive UI: สลับสถานะปุ่มสั่งซื้อและจำนวน */}
            {isOutOfStock ? (
              <button disabled className="w-full bg-slate-100 text-slate-400 font-bold py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm cursor-not-allowed border border-slate-200">สินค้าหมด</button>
            ) : quantity > 0 ? (
              <div className="w-full flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl overflow-hidden h-9 sm:h-11 shadow-sm">
                <button onClick={(e) => { e.preventDefault(); const nextQuantity = Number((quantity - step).toFixed(2)); if (nextQuantity >= min) { updateQuantity(product.id, nextQuantity); } else { removeItem(product.id); } }} title="ลดจำนวน" className="w-10 sm:w-12 h-full flex items-center justify-center text-blue-600 hover:bg-blue-200 active:bg-blue-300 transition-colors"><Minus className="w-4 h-4 sm:w-5 sm:h-5" /></button>
                <span className="font-bold text-sm sm:text-base text-blue-800 min-w-[2rem] px-1 text-center select-none">{displayQuantity}</span>
                <button onClick={(e) => { e.preventDefault(); updateQuantity(product.id, Number((quantity + step).toFixed(2))); }} title="เพิ่มจำนวน" className="w-10 sm:w-12 h-full flex items-center justify-center text-blue-600 hover:bg-blue-200 active:bg-blue-300 transition-colors"><Plus className="w-4 h-4 sm:w-5 sm:h-5" /></button>
              </div>
            ) : (
              <button onClick={(e) => { e.preventDefault(); addItem({ ...product, price: product.discount_price || product.price, branchId, quantity: min }); }} className="w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl h-9 sm:h-11 text-xs sm:text-sm font-bold transition-all duration-300 active:scale-95 shadow-sm group">
                <ShoppingCart className="w-4 h-4 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
                <span>เพิ่มลงตะกร้า</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* --- Promotion Banners --- */}
      {promotions.length > 0 && (
        <section className="relative w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shadow-sm aspect-[16/7] md:aspect-[24/7] lg:aspect-[28/7] group">
          {promotions.map((promo, index) => (
            <a
              key={promo.id}
              href={promo.target_url || '#'}
              target={promo.target_url ? "_blank" : "_self"}
              className={`absolute inset-0 transition-opacity duration-1000 ${index === currentBanner ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
              onClick={(e) => { if (!promo.target_url) e.preventDefault(); }}
            >
              <Image src={promo.image_url} alt={promo.title} fill className="object-cover" priority={index === 0} />
            </a>
          ))}

          {/* จุดนำทาง (Carousel Indicators) */}
          {promotions.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
              {promotions.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentBanner(index)}
                  aria-label={`ไปที่แบนเนอร์ที่ ${index + 1}`}
                  className={`h-1.5 rounded-full shadow-sm transition-all duration-300 ${index === currentBanner ? 'w-6 bg-blue-600' : 'w-1.5 bg-white/60 hover:bg-white'}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* --- Flash Sale Section --- */}
      {discountedProducts.length > 0 && (
        <section className="w-full bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl p-4 sm:p-6 border border-red-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
            <h2 className="text-lg sm:text-xl font-bold text-red-700 flex items-center gap-2">
              <span className="animate-bounce">🔥</span> สินค้าโปรโมชัน (Flash Sale)
            </h2>
            {isMounted && hasActiveTimer && (
              <div className="flex items-center gap-2 text-sm font-medium text-red-800 bg-red-100/80 px-3 py-1.5 rounded-lg w-fit border border-red-200/50">
                <span>จบลงใน:</span>
                <div className="flex items-center gap-1 font-bold">
                  <span className="bg-red-600 text-white w-6 h-6 flex items-center justify-center rounded text-xs shadow-sm">{String(timeLeft.hours).padStart(2, '0')}</span>
                  <span className="text-red-600 animate-pulse">:</span>
                  <span className="bg-red-600 text-white w-6 h-6 flex items-center justify-center rounded text-xs shadow-sm">{String(timeLeft.minutes).padStart(2, '0')}</span>
                  <span className="text-red-600 animate-pulse">:</span>
                  <span className="bg-red-600 text-white w-6 h-6 flex items-center justify-center rounded text-xs shadow-sm">{String(timeLeft.seconds).padStart(2, '0')}</span>
                </div>
              </div>
            )}
          </div>
          <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 snap-x [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-red-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {discountedProducts.map((product) => renderProductCard(product, true))}
          </div>
        </section>
      )}

      <div className="w-full flex flex-col lg:flex-row gap-8 items-start relative">
      
      {/* --- Mobile: Sticky Tab & Search --- */}
      <div className="lg:hidden sticky top-14 md:top-16 z-30 bg-gray-50 pt-2 pb-3 -mx-6 px-6 w-[calc(100%+3rem)] space-y-3 shadow-sm border-b border-gray-200/60">
        {/* Mobile Search */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาสินค้า..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              title="ล้างการค้นหา"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Mobile Category */}
        {categories && categories.length > 0 && (
          <div className="flex flex-col gap-2">
            {/* แถวที่ 1: หมวดหมู่หลัก (Root Categories) */}
            <div className="overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex items-center gap-2 w-max pb-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`flex-shrink-0 whitespace-nowrap px-5 py-2 rounded-full text-sm font-medium transition-all ${
                    selectedCategory === null ? 'bg-slate-800 text-white shadow-md border border-slate-800' : 'bg-white text-slate-600 border border-slate-200 active:scale-95'
                  }`}
                >
                  ทั้งหมด
                </button>
                {rootCategories.map((cat) => {
                  const isRootActive = activeRootCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`flex-shrink-0 whitespace-nowrap px-5 py-2 rounded-full text-sm transition-all ${
                        isRootActive ? 'bg-blue-600 text-white shadow-md border border-blue-600 font-bold' : 'bg-white text-slate-800 border border-slate-200 font-medium active:scale-95'
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* แถวที่ 2: หมวดหมู่ย่อย (Sub Categories - แสดงเฉพาะเมื่อเลือกหมวดหมู่หลักที่มีลูก) */}
            {activeRootCategoryId && getChildren(activeRootCategoryId).length > 0 && (
              <div className="overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="flex items-center gap-2 w-max pb-1">
                  <button
                    onClick={() => setSelectedCategory(activeRootCategoryId)}
                    className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-xs transition-all ${
                      selectedCategory === activeRootCategoryId ? 'bg-slate-700 text-white shadow-sm font-bold border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-200 active:scale-95'
                    }`}
                  >
                    รวม {rootCategories.find(c => c.id === activeRootCategoryId)?.name}
                  </button>
                  {getChildren(activeRootCategoryId).map((subCat) => {
                    const isSelected = selectedCategory === subCat.id;
                    return (
                      <button
                        key={subCat.id}
                        onClick={() => setSelectedCategory(subCat.id)}
                        className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-xs transition-all ${
                          isSelected ? 'bg-slate-700 text-white shadow-sm font-bold border border-slate-700' : 'bg-white text-slate-600 border border-slate-200 border-dashed active:scale-95'
                        }`}
                      >
                        {subCat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
              className="w-full pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 shadow-sm transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                title="ล้างการค้นหา"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
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
            {rootCategories.map((rootCat) => {
              const isRootActive = activeRootCategoryId === rootCat.id;
              const isExactlySelected = selectedCategory === rootCat.id;
              const children = getChildren(rootCat.id);
              
              return (
                <div key={rootCat.id} className="flex flex-col space-y-1">
                  <button
                    onClick={() => setSelectedCategory(rootCat.id)}
                    className={`w-full flex justify-between items-center px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isExactlySelected ? 'bg-blue-600 text-white shadow-md' : isRootActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-200/50'
                    }`}
                  >
                    <span>{rootCat.name}</span>
                    {children.length > 0 && <ChevronDown className={`w-4 h-4 transition-transform ${isRootActive ? 'rotate-180' : ''}`} />}
                  </button>
                  
                  {/* แสดง Subcategories เมื่อ Root ถูกเลือกแบบ Accordion */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isRootActive && children.length > 0 ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="pl-4 pr-2 py-1 flex flex-col space-y-1">
                        {children.map((subCat) => (
                          <button
                            key={subCat.id}
                            onClick={() => setSelectedCategory(subCat.id)}
                            className={`w-full text-left px-4 py-2 rounded-lg text-xs font-medium transition-colors relative before:content-[''] before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-1.5 before:rounded-full ${
                              selectedCategory === subCat.id ? 'bg-slate-800 text-white shadow-sm before:bg-white' : 'text-slate-600 hover:bg-slate-100 before:bg-slate-300'
                            }`}
                          >
                            {subCat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
            {visibleProducts.map((product) => renderProductCard(product, false))}
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

      {/* --- Floating Cart Button (All devices) --- */}
      {isMounted && totalItems > 0 && (
        <div className="fixed bottom-6 left-4 right-4 lg:left-auto lg:right-8 z-50 flex justify-center lg:justify-end pointer-events-none">
          <button 
            onClick={() => setIsCartOpen(true)}
            className={`pointer-events-auto w-full max-w-md lg:w-auto lg:min-w-[280px] bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-600/40 p-4 flex items-center justify-between gap-4 active:scale-95 transition-all duration-300 hover:bg-blue-700 ${cartAnimation ? 'scale-105 ring-4 ring-blue-400/40 bg-blue-500' : 'scale-100'}`}
          >
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <ShoppingCart className={`w-6 h-6 ${cartAnimation ? 'animate-bounce' : ''}`} />
                <span className={`absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full border-2 border-white transition-transform duration-300 ${cartAnimation ? 'scale-125' : 'scale-100'}`}>
                  {formatNumber(totalItems)}
                </span>
              </div>
              <div className="flex flex-col items-start text-left">
                <span className="font-semibold text-sm">ดูตะกร้าสินค้า</span>
                <span className="text-xs text-blue-100 hidden lg:block">{formatNumber(totalItems)} รายการ</span>
              </div>
            </div>
            <div className="font-bold text-lg">
              ฿{totalPrice.toLocaleString()}
            </div>
          </button>
        </div>
      )}

      {/* --- Slide-over Cart --- */}
      <div className={`fixed inset-0 z-[100] transition-all duration-300 ${isCartOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isCartOpen ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => setIsCartOpen(false)} 
        />
        
        {/* Panel */}
        <div className={`absolute top-0 right-0 w-full sm:w-[420px] h-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
              ตะกร้าสินค้า
            </h2>
            <button 
              onClick={() => setIsCartOpen(false)} 
              title="ปิดตะกร้าสินค้า"
              className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-50 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
            {branchCartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <ShoppingCart className="w-12 h-12 opacity-20" />
                <p className="font-medium text-slate-500">ไม่มีสินค้าในตะกร้า</p>
              </div>
            ) : (
              effectiveCartItems.map((item: any) => (
                <div key={item.id} className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3 sm:gap-4 items-center group">
                  <div className="relative w-16 h-16 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                    {item.image_url ? (
                      <Image src={item.image_url} alt={item.name} fill sizes="64px" className="object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
                        <Package className="w-6 h-6 opacity-50" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm text-slate-800 truncate" title={item.name}>{item.name}</h4>
                    <div className="font-bold text-sm mt-0.5">
                      {item.isDiscounted ? (
                        <span className="text-red-600">฿{item.currentPrice.toLocaleString()}</span>
                      ) : (
                        <span className="text-blue-600">฿{item.currentPrice.toLocaleString()}</span>
                      )}
                      {item.isDiscounted && <span className="text-xs text-slate-400 line-through font-normal ml-1.5">฿{item.originalPrice.toLocaleString()}</span>}
                      {item.unit_name ? <span className="text-xs text-slate-400 font-normal ml-1">/ {item.unit_name}</span> : ''}
                    </div>
                  </div>
                  
                  {/* Quantity Control */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg overflow-hidden shrink-0">
                    <button 
                      onClick={() => {
                        const step = item.step_value || 1;
                        const min = item.min_value || 1;
                        const next = Number((item.quantity - step).toFixed(2));
                        if (next >= min) updateQuantity(item.id, next);
                        else removeItem(item.id);
                      }}
                      title="ลดจำนวน"
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-blue-600 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold w-6 text-center text-slate-700">
                      {Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(2).replace(/\.?0+$/, '')}
                    </span>
                    <button 
                      onClick={() => {
                        const step = item.step_value || 1;
                        updateQuantity(item.id, Number((item.quantity + step).toFixed(2)));
                      }}
                      title="เพิ่มจำนวน"
                      className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-blue-600 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)]">
            <div className="flex justify-between items-center mb-4 text-slate-600">
              <span className="font-medium">ยอดรวมทั้งหมด</span>
              <span className="text-2xl font-bold text-blue-600">฿{totalPrice.toLocaleString()}</span>
            </div>
            <Link 
              href={`/checkout?branchId=${branchId}`}
              className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md ${effectiveCartItems.length > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-95' : 'bg-slate-100 text-slate-400 shadow-none pointer-events-none'}`}
              onClick={(e) => {
                if (effectiveCartItems.length === 0) e.preventDefault();
              }}
            >
              ดำเนินการชำระเงิน
            </Link>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}