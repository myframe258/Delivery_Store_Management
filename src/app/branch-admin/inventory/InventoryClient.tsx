'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import { Search, Edit2, PackageX, Check, X, Image as ImageIcon } from 'lucide-react';

interface InventoryItem {
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  stock_count: number;
  status: number;
}

interface InventoryClientProps {
  initialInventory: InventoryItem[];
  branch: { id: number; name: string } | null;
}

export default function InventoryClient({ initialInventory, branch }: InventoryClientProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [editingProduct, setEditingProduct] = useState<InventoryItem | null>(null);
  const [editStockValue, setEditStockValue] = useState<number>(0);
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
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
      // คืนค่า UI กลับถ้าอัปเดตไม่สำเร็จ
      setInventory((prev) => 
        prev.map((item) => item.product_id === productId ? { ...item, status: currentStatus } : item)
      );
    }
  };

  // บันทึกจำนวนสต็อกจาก Modal
  const handleSaveStock = async () => {
    if (!branch?.id || !editingProduct) return;
    setIsUpdating(true);
    const productId = editingProduct.product_id;
    const currentStatus = editingProduct.status;

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
          .update({ stock_count: editStockValue })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('branch_inventory')
          .insert({
            branch_id: branch.id,
            product_id: productId,
            stock_count: editStockValue,
            status: currentStatus
          });
        if (error) throw error;
      }

      // อัปเดต UI เมื่อสำเร็จ
      setInventory((prev) => ({ ...prev, [productId]: { ...editingProduct, stock_count: editStockValue } }));
      setInventory((prev) => prev.map(item => item.product_id === productId ? { ...item, stock_count: editStockValue } : item));
      setEditingProduct(null);
    } catch (error: any) {
      console.error('Save error:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตสต็อก: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // กรองรายการสินค้าตามคำค้นหา
  const filteredInventory = inventory.filter((item) => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Toolbar */}
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="ค้นหาสินค้า..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
        </div>
        <div className="text-sm text-gray-500 font-medium">
          สินค้าในระบบ: {inventory.length} รายการ
        </div>
      </div>

      {/* Inventory List (Responsive Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
        {filteredInventory.map((item) => {
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
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-blue-600">฿{item.price.toLocaleString()}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOutOfStock ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {isOutOfStock ? 'สินค้าหมด' : `คงเหลือ: ${item.stock_count}`}
                    </span>
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
                <button onClick={() => { setEditingProduct(item); setEditStockValue(item.stock_count); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition">
                  <Edit2 className="w-4 h-4" /> แก้ไขสต็อก
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Stock Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">แก้ไขจำนวนสต็อก</h3>
              <button onClick={() => setEditingProduct(null)} className="text-gray-400 hover:text-gray-600 transition" title="ปิดหน้าต่าง"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4 line-clamp-1">สินค้า: <span className="font-semibold text-slate-700">{editingProduct.name}</span></p>
              <label htmlFor="stock-input" className="block text-sm font-medium text-gray-700 mb-1">จำนวนสต็อกคงเหลือ</label>
              <input 
                id="stock-input"
                type="number" 
                min="0" 
                value={editStockValue} 
                onChange={(e) => setEditStockValue(Number(e.target.value))} 
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                placeholder="ระบุจำนวนสินค้า"
                title="ระบุจำนวนสต็อกคงเหลือ"
              />
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
