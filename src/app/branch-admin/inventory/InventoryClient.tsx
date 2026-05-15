'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Package, Edit2, Search, Image as ImageIcon, X, Check } from 'lucide-react';

interface InventoryItem {
  id: string;
  stock_count: number;
  status: number;
  products: {
    id: string;
    name: string;
    price: number;
    image_url: string | null;
  };
}

interface InventoryClientProps {
  initialInventory: InventoryItem[];
  branchId: number;
}

export default function InventoryClient({ initialInventory, branchId }: InventoryClientProps) {
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal States
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newStock, setNewStock] = useState<number>(0);
  const [isUpdating, setIsUpdating] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // ฟังก์ชันสลับสถานะเปิด-ปิดการขาย (Toggle Status)
  const handleToggleStatus = async (id: string, currentStatus: number) => {
    const nextStatus = currentStatus === 1 ? 0 : 1;
    
    // อัปเดต UI ทันทีเพื่อให้ดูรวดเร็ว (Optimistic UI)
    setInventory((prev) => 
      prev.map((item) => item.id === id ? { ...item, status: nextStatus } : item)
    );

    try {
      const { error } = await supabase
        .from('branch_inventory')
        .update({ status: nextStatus })
        .eq('id', id);
      if (error) throw error;
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
      // คืนค่า UI กลับถ้าอัปเดตไม่สำเร็จ
      setInventory((prev) => 
        prev.map((item) => item.id === id ? { ...item, status: currentStatus } : item)
      );
    }
  };

  // ฟังก์ชันเปิด Modal แก้ไขสต็อก
  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setNewStock(item.stock_count);
  };

  // ฟังก์ชันบันทึกสต็อกใหม่ลง Database
  const handleSaveStock = async () => {
    if (!editingItem) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('branch_inventory')
        .update({ stock_count: newStock })
        .eq('id', editingItem.id);

      if (error) throw error;

      // อัปเดต State หน้าจอ
      setInventory((prev) =>
        prev.map((item) => item.id === editingItem.id ? { ...item, stock_count: newStock } : item)
      );
      
      setEditingItem(null); // ปิด Modal
    } catch (error: any) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสต็อก: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // กรองรายการสินค้าตามคำค้นหา
  const filteredInventory = inventory.filter((item) => 
    item.products?.name.toLowerCase().includes(searchQuery.toLowerCase())
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
            <div key={item.id} className={`p-4 rounded-xl border transition-all ${isActive ? 'border-gray-200 hover:shadow-md bg-white' : 'border-gray-200 bg-gray-50 opacity-75'}`}>
              <div className="flex gap-4 items-start">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200 overflow-hidden">
                  {item.products.image_url ? (
                    <img src={item.products.image_url} alt={item.products.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm line-clamp-1 mb-1">{item.products.name}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-bold text-blue-600">฿{item.products.price.toLocaleString()}</span>
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
                    <input type="checkbox" className="sr-only" checked={isActive} onChange={() => handleToggleStatus(item.id, item.status)} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isActive ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-xs font-medium text-gray-500">{isActive ? 'เปิดขาย' : 'ปิดการขาย'}</span>
                </label>
                <button onClick={() => openEditModal(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition">
                  <Edit2 className="w-4 h-4" /> แก้ไขสต็อก
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Stock Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">แก้ไขจำนวนสต็อก</h3>
              <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600 transition" title="ปิดหน้าต่าง"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-500 mb-4 line-clamp-1">สินค้า: <span className="font-semibold text-slate-700">{editingItem.products.name}</span></p>
              <label htmlFor="stock-input" className="block text-sm font-medium text-gray-700 mb-1">จำนวนสต็อกคงเหลือ</label>
              <input 
                id="stock-input"
                type="number" 
                min="0" 
                value={newStock} 
                onChange={(e) => setNewStock(Number(e.target.value))} 
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                placeholder="ระบุจำนวนสินค้า"
                title="ระบุจำนวนสต็อกคงเหลือ"
              />
            </div>
            <div className="p-5 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition">ยกเลิก</button>
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
