'use client';

import React, { useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import { Search, Edit2, PackageX, Check, X, Image as ImageIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface InventoryItem {
  product_id: string;
  sku?: string | null;
  name: string;
  price: number;
  image_url: string | null;
  stock_count: number;
  status: number;
  discount_price?: number | null;
  discount_end_date?: string | null;
  is_track_stock?: boolean;
  category_id?: string | null;
  category_name?: string;
}

interface InventoryClientProps {
  initialInventory: InventoryItem[];
  branch: { id: number; name: string } | null;
}

export default function InventoryClient({ initialInventory, branch }: InventoryClientProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<string>('name_asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  
  // Modal States
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [editStockValue, setEditStockValue] = useState<number | ''>('');
  const [editDiscountValue, setEditDiscountValue] = useState<number | ''>('');
  const [editDiscountDate, setEditDiscountDate] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // จัดการสลับสถานะเปิด-ปิด (Toggle) พร้อมบันทึกลง DB ทันทีแบบ Optimistic UI
  const handleToggleStatus = async (productId: string, currentStatus: number) => {
    if (!branch?.id) return;
    
    const nextStatus = currentStatus === 1 ? 0 : 1;
    
    // อัปเดต UI ทันทีเพื่อให้ดูรวดเร็ว (Optimistic UI)
    setInventory((prev) => 
      prev.map((item) => item.product_id === productId ? { ...item, status: nextStatus } : item)
    );

    try {
      const { data: existing } = await supabase
        .from('branch_inventory')
        .select('id')
        .eq('branch_id', branch.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        await supabase.from('branch_inventory').update({ status: nextStatus }).eq('id', existing.id);
      } else {
        const item = inventory.find(i => i.product_id === productId);
        await supabase.from('branch_inventory').insert({
          branch_id: branch.id, product_id: productId, stock_count: item?.stock_count || 0, status: nextStatus
        });
      }
    } catch (error) {
      console.error('Toggle error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
      // คืนค่า UI กลับถ้าอัปเดตไม่สำเร็จ
      setInventory((prev) => 
        prev.map((item) => item.product_id === productId ? { ...item, status: currentStatus } : item)
      );
      return;
    }
    toast.success(nextStatus === 1 ? 'เปิดการขายสินค้านี้แล้ว' : 'ปิดการขายสินค้านี้ชั่วคราว');
  };
  // บันทึกจำนวนสต็อกจาก Modal
  const handleSaveStock = async () => {
    if (!branch?.id || !editingProduct) return;
    setIsUpdating(true);
    const productId = editingProduct.product_id;
    const currentStatus = editingProduct.status;
    // ถ้าผู้ใช้กดบันทึกทั้งๆ ที่ช่องว่างเปล่า ให้ถือว่าเป็น 0
    const finalStockValue = editStockValue === '' ? 0 : editStockValue;
    const finalDiscountValue = editDiscountValue === '' ? null : editDiscountValue;
    const finalDiscountDate = editDiscountDate === '' ? null : editDiscountDate;

    try {
      const { data: existing } = await supabase
        .from('branch_inventory')
        .select('id')
        .eq('branch_id', branch.id)
        .eq('product_id', productId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('branch_inventory')
          .update({ stock_count: finalStockValue, discount_price: finalDiscountValue, discount_end_date: finalDiscountDate })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branch_inventory')
          .insert({
            branch_id: branch.id,
            product_id: productId,
            stock_count: finalStockValue,
            discount_price: finalDiscountValue,
            discount_end_date: finalDiscountDate,
            status: currentStatus
          });
        if (error) throw error;
      }

      // อัปเดต UI เมื่อสำเร็จ
      setInventory((prev) => prev.map(item => item.product_id === productId ? { ...item, stock_count: finalStockValue, discount_price: finalDiscountValue, discount_end_date: finalDiscountDate } : item));
      setEditingProduct(null);
      toast.success('อัปเดตจำนวนสต็อกเรียบร้อยแล้ว');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสต็อก: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // ดึงรายการหมวดหมู่ทั้งหมดจากสินค้าที่มี (ไม่ซ้ำกัน)
  const categories = Array.from(new Set(inventory.map(item => item.category_name))).filter(Boolean) as string[];

  // กรอง เรียงลำดับ และแบ่งหน้า
  const processedInventory = useMemo(() => {
    let result = inventory;
    if (selectedCategory) result = result.filter(i => i.category_name === selectedCategory);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || (i.sku && i.sku.toLowerCase().includes(q)));
    }
    result.sort((a, b) => {
      if (sortOption === 'name_asc') return a.name.localeCompare(b.name);
      if (sortOption === 'name_desc') return b.name.localeCompare(a.name);
      if (sortOption === 'stock_asc') return a.stock_count - b.stock_count;
      if (sortOption === 'stock_desc') return b.stock_count - a.stock_count;
      if (sortOption === 'price_asc') return a.price - b.price;
      if (sortOption === 'price_desc') return b.price - a.price;
      return 0;
    });
    return result;
  }, [inventory, selectedCategory, searchQuery, sortOption]);

  const totalItems = processedInventory.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInventory = processedInventory.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดการสต็อกสินค้า (Inventory)</h1>
          <p className="text-sm text-gray-500 mt-1">สาขา: {branch?.name || '-'}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Toolbar */}
      <div className="p-5 border-b border-gray-100 bg-slate-50 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อสินค้า, รหัส SKU..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>
          {/* Category Filter */}
          <div className="w-full md:w-56 shrink-0 relative">
            <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={selectedCategory || ''}
              title="เลือกหมวดหมู่สินค้า"
              onChange={(e) => { setSelectedCategory(e.target.value || null); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition appearance-none cursor-pointer"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          {/* Sort Option */}
          <div className="w-full md:w-56 shrink-0 relative">
            <ArrowUpDown className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={sortOption}
              title="เลือกการเรียงลำดับสินค้า"
              onChange={(e) => { setSortOption(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition appearance-none cursor-pointer"
            >
              <option value="name_asc">ชื่อสินค้า (ก - ฮ)</option>
              <option value="name_desc">ชื่อสินค้า (ฮ - ก)</option>
              <option value="stock_asc">สต็อกคงเหลือ (น้อย - มาก)</option>
              <option value="stock_desc">สต็อกคงเหลือ (มาก - น้อย)</option>
              <option value="price_asc">ราคา (น้อย - มาก)</option>
              <option value="price_desc">ราคา (มาก - น้อย)</option>
            </select>
          </div>
        </div>
      </div>
      </div>

      {/* Inventory List (Responsive Grid) */}
      {paginatedInventory.length === 0 ? (
        <div className="p-10 text-center text-gray-500 flex flex-col items-center">
          <PackageX className="w-12 h-12 text-gray-300 mb-3" />
          <p>ไม่พบสินค้าที่ตรงกับเงื่อนไขการค้นหา</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
          {paginatedInventory.map((item) => {
          const isActive = item.status === 1;
          const isOutOfStock = item.stock_count <= 0;

          return (
            <div key={item.product_id} className={`p-4 rounded-xl border transition-all ${isActive ? 'border-gray-200 hover:shadow-md bg-white' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
              <div className="flex gap-4 items-start">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200 overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm line-clamp-1 mb-1">{item.name}</h3>
                  {item.sku && <p className="text-xs text-blue-600 font-mono mb-1">รหัส: {item.sku}</p>}
                  <div className="flex items-center gap-2 mb-2">
                    {item.discount_price ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-red-600">฿{item.discount_price.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 line-through">฿{item.price.toLocaleString()}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-blue-600">฿{item.price.toLocaleString()}</span>
                    )}
                    {item.is_track_stock ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isOutOfStock ? 'สินค้าหมด' : `คงเหลือ: ${item.stock_count}`}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                        ไม่ต้องนับสต็อก
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
                <label className="flex items-center cursor-pointer gap-2">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={isActive} onChange={() => handleToggleStatus(item.product_id, item.status)} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-xs font-medium text-gray-500">{isActive ? 'เปิดขาย' : 'ปิดการขาย'}</span>
                </label>
                <button onClick={() => { setEditingProduct(item); setEditStockValue(item.stock_count); setEditDiscountValue(item.discount_price ?? ''); setEditDiscountDate(item.discount_end_date ?? ''); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition">
                  <Edit2 className="w-4 h-4" /> จัดการ
                </button>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Pagination Footer */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-white gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-sm text-gray-500 w-full sm:w-auto text-center sm:text-left">
            <div className="flex items-center justify-center gap-2">
              <span>แสดง</span>
              <select
                value={itemsPerPage}
                title="จำนวนรายการต่อหน้า"
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-gray-300 rounded-md px-2 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
              <span>รายการต่อหน้า</span>
            </div>
            <span className="hidden sm:inline-block border-l border-gray-300 h-4 mx-1"></span>
            <span>
              แสดง {startIndex + 1} ถึง {Math.min(startIndex + itemsPerPage, totalItems)} จากทั้งหมด {totalItems} รายการ
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าแรก"><ChevronsLeft className="w-5 h-5" /></button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าก่อนหน้า"><ChevronLeft className="w-5 h-5" /></button>
            <span className="px-4 py-1.5 text-sm font-semibold text-gray-700 bg-gray-50 rounded-lg">หน้า {currentPage} / {totalPages}</span>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าถัดไป"><ChevronRight className="w-5 h-5" /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="หน้าสุดท้าย"><ChevronsRight className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">จัดการสต็อกและโปรโมชั่น</h3>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-gray-600 transition" title="ปิดหน้าต่าง"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4 line-clamp-1">สินค้า: <span className="font-semibold text-slate-700">{editingProduct.name}</span></p>
              
              {editingProduct.is_track_stock && (
                <div className="mb-4">
                  <label htmlFor="stock-input" className="block text-sm font-medium text-gray-700 mb-1">จำนวนสต็อกคงเหลือ</label>
                  <input 
                    id="stock-input"
                    type="number" 
                    min="0" 
                    value={editStockValue} 
                    onChange={(e) => setEditStockValue(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                    placeholder="ระบุจำนวนสินค้า"
                    title="ระบุจำนวนสต็อกคงเหลือ"
                  />
                </div>
              )}

              <div>
                <label htmlFor="discount-input" className="block text-sm font-medium text-gray-700 mb-1">ราคาลดพิเศษ (Discount Price)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">฿</span>
                  <input 
                    id="discount-input"
                    type="number" 
                    min="0" 
                    step="0.01"
                    value={editDiscountValue} 
                    onChange={(e) => setEditDiscountValue(e.target.value === '' ? '' : Number(e.target.value))} 
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                    placeholder="ปล่อยว่างหากไม่ต้องการลดราคา"
                    title="ระบุราคาที่ลดแล้ว"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">ราคาปกติ: ฿{editingProduct.price.toLocaleString()}</p>
                <div className="mt-3">
                  <label htmlFor="discount-date-input" className="block text-sm font-medium text-gray-700 mb-1">สิ้นสุดโปรโมชั่น</label>
                  <input 
                    id="discount-date-input"
                    type="datetime-local" 
                    title="ระบุวันเวลาที่สิ้นสุดโปรโมชั่น"
                    placeholder="วันเวลาที่สิ้นสุด"
                    value={editDiscountDate ? new Date(new Date(editDiscountDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditDiscountDate(e.target.value ? new Date(e.target.value).toISOString() : '')} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setEditingProduct(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition">ยกเลิก</button>
              <button onClick={handleSaveStock} disabled={isUpdating} className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-sm flex items-center gap-2">
                {isUpdating ? 'กำลังบันทึก...' : <><Check className="w-4 h-4" /> บันทึกการเปลี่ยนแปลง</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
