'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Search, Tag, Save, AlertCircle, Loader2, Image as ImageIcon, Store, Package } from 'lucide-react';
import toast from 'react-hot-toast';

type Branch = {
  id: number;
  name: string;
};

type Product = {
  id: string;
  sku: string | null;
  name: string;
  price: number;
  image_url: string | null;
  is_track_stock: boolean;
};

type InventoryItem = {
  stock_count: number;
  id: string; // branch_inventory id
  product_id: string;
  discount_price: number | null;
  discount_end_date: string | null;
  status: number;
};

export default function BranchDiscountsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Record<string, InventoryItem>>({});
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // State สำหรับเก็บข้อมูลการแก้ไข (product_id -> discount_price)
  const [edits, setEdits] = useState<Record<string, number | null>>({});
  const [editsDate, setEditsDate] = useState<Record<string, string | null>>({});
  const [editsStock, setEditsStock] = useState<Record<string, number | null>>({});
  const [editsStatus, setEditsStatus] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchBranchesAndProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranchesAndProducts = async () => {
    setLoading(true);
    try {
      const [branchesRes, productsRes] = await Promise.all([
        supabase.from('branches').select('id, name').order('name'),
        supabase.from('products').select('id, sku, name, price, image_url, is_track_stock').eq('is_active', true).order('name')
      ]);

      if (branchesRes.error) throw branchesRes.error;
      if (productsRes.error) throw productsRes.error;

      setBranches(branchesRes.data || []);
      setProducts(productsRes.data || []);
      
      if (branchesRes.data && branchesRes.data.length > 0) {
        handleSelectBranch(branchesRes.data[0].id);
      } else {
        setLoading(false);
      }
    } catch (error: any) {
      toast.error('โหลดข้อมูลไม่สำเร็จ: ' + error.message);
      setLoading(false);
    }
  };

  const handleSelectBranch = async (branchId: number) => {
    setSelectedBranch(branchId);
    setLoading(true);
    setEdits({}); // เคลียร์ค่าที่ค้างแก้ไขออกเมื่อเปลี่ยนสาขา
    setEditsDate({});
    setEditsStock({});
    setEditsStatus({});
    try {
      const { data, error } = await supabase
        .from('branch_inventory')
        .select('id, product_id, discount_price, discount_end_date, status, stock_count')
        .eq('branch_id', branchId);

      if (error) throw error;

      const invMap: Record<string, InventoryItem> = {};
      data.forEach(item => {
        invMap[item.product_id] = item;
      });
      setInventory(invMap);
    } catch (error: any) {
      toast.error('ดึงข้อมูลสาขาไม่สำเร็จ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (productId: string, value: string) => {
    setEditsDate(prev => ({ ...prev, [productId]: value || null }));
  };

  const handlePriceChange = (productId: string, value: string) => {
    if (value === '') {
      setEdits(prev => ({ ...prev, [productId]: null }));
    } else {
      setEdits(prev => ({ ...prev, [productId]: Number(value) }));
    }
  };

  const handleStockChange = (productId: string, value: string) => {
    setEditsStock(prev => ({ ...prev, [productId]: value === '' ? null : Number(value) }));
  };

  const handleStatusToggle = (productId: string, currentStatus: number) => {
    setEditsStatus(prev => ({ ...prev, [productId]: currentStatus === 1 ? 0 : 1 }));
  };

  const handleSave = async () => {
    if (!selectedBranch) return;
    setSaving(true);
    
    try {
      const modifiedProductIds = Array.from(new Set([...Object.keys(edits), ...Object.keys(editsDate), ...Object.keys(editsStock), ...Object.keys(editsStatus)]));
      const updates = modifiedProductIds.map((productId) => {
        const inv = inventory[productId];
        const discountPrice = edits[productId] !== undefined ? edits[productId] : (inv?.discount_price ?? null);
        const discountEndDate = editsDate[productId] !== undefined ? editsDate[productId] : (inv?.discount_end_date ?? null);
        const stockCount = editsStock[productId] !== undefined ? editsStock[productId] : (inv?.stock_count ?? 0);
        const statusVal = editsStatus[productId] !== undefined ? editsStatus[productId] : (inv?.status ?? 0);

        if (inv) {
          // หากมีในสต็อกอยู่แล้ว ให้อัปเดตราคา
          return supabase
            .from('branch_inventory')
            .update({ 
              discount_price: discountPrice, 
              discount_end_date: discountEndDate,
              stock_count: stockCount === null ? 0 : stockCount,
              status: statusVal
            })
            .eq('id', inv.id);
        } else {
          // หากยังไม่มีในสต็อก ให้เพิ่มเข้าไป (โดยยังตั้งสถานะปิดการขายและสต็อกเป็น 0 ก่อน)
          return supabase
            .from('branch_inventory')
            .insert({
              branch_id: selectedBranch,
              product_id: productId,
              discount_price: discountPrice,
              discount_end_date: discountEndDate,
              stock_count: stockCount,
              status: statusVal
            });
        }
      });

      await Promise.all(updates);
      
      toast.success('บันทึกการเปลี่ยนแปลงสำเร็จ');
      await handleSelectBranch(selectedBranch); // โหลดตารางใหม่
    } catch (error: any) {
      toast.error('บันทึกข้อมูลไม่สำเร็จ: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const processedProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
  }, [products, searchQuery]);

  const hasChanges = Object.keys(edits).length > 0 || Object.keys(editsDate).length > 0 || Object.keys(editsStock).length > 0 || Object.keys(editsStatus).length > 0;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" />
            จัดการสต็อกและโปรโมชันรายสาขา
          </h1>
          <p className="text-sm text-gray-500 mt-1">จัดการจำนวนสต็อก เปิด-ปิดการขาย และกำหนดราคาโปรโมชันแยกตามสาขา (Super Admin)</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} บันทึกการเปลี่ยนแปลง
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/3 relative">
          <Store className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            title="เลือกสาขาที่ต้องการตั้งค่าราคาลดพิเศษ"
            value={selectedBranch || ''}
            onChange={(e) => handleSelectBranch(Number(e.target.value))}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer font-medium text-gray-700"
            disabled={loading}
          >
            <option value="" disabled>-- เลือกสาขา --</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อสินค้า, รหัส SKU..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-20 text-center">รูปภาพ</th>
                <th className="px-6 py-4">ข้อมูลสินค้า</th>
                <th className="px-6 py-4 text-right w-32">ราคาปกติ</th>
                <th className="px-6 py-4 w-32 text-center">สต็อก & สถานะ</th>
                <th className="px-6 py-4 w-48">ราคาลดพิเศษ (฿)</th>
                <th className="px-6 py-4 w-56">สิ้นสุดโปรโมชั่น</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : processedProducts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">ไม่พบข้อมูลสินค้า</td>
                </tr>
              ) : (
                processedProducts.map(product => {
                  const inv = inventory[product.id];
                  const currentVal = edits[product.id] !== undefined ? edits[product.id] : (inv?.discount_price ?? null);
                  const hasDiscount = currentVal !== null;
                  const currentStockVal = editsStock[product.id] !== undefined ? editsStock[product.id] : (inv?.stock_count ?? 0);
                  const currentStatusVal = editsStatus[product.id] !== undefined ? editsStatus[product.id] : (inv?.status ?? 0);
                  const currentEndDateVal = editsDate[product.id] !== undefined ? editsDate[product.id] : (inv?.discount_end_date ?? null);
                  const isError = hasDiscount && currentVal >= product.price;

                  return (
                    <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 text-center">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center mx-auto">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{product.name}</p>
                        {product.sku && <p className="text-xs text-blue-600 font-mono mt-0.5">รหัส: {product.sku}</p>}
                        {currentStatusVal === 0 && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold rounded-full">ปิดการขาย</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-600">
                        {hasDiscount ? (
                          <span className="line-through opacity-50">฿{product.price.toLocaleString()}</span>
                        ) : (
                          <span>฿{product.price.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {product.is_track_stock ? (
                          <input
                            type="number"
                            min="0"
                            value={currentStockVal === null ? '' : currentStockVal}
                            onChange={(e) => handleStockChange(product.id, e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-blue-500 outline-none text-center font-semibold text-gray-700"
                            placeholder="สต็อก"
                          />
                        ) : (
                          <div className="text-[10px] text-gray-500 mb-2 px-2 py-2 bg-gray-100 rounded-lg text-center font-medium border border-gray-200">ไม่ต้องนับสต็อก</div>
                        )}
                        <label className="flex items-center justify-center cursor-pointer gap-2" title="เปิด/ปิดการขายสำหรับสาขานี้">
                          <div className="relative">
                            <input 
                              type="checkbox" 
                              className="sr-only" 
                              checked={currentStatusVal === 1} 
                              onChange={() => handleStatusToggle(product.id, currentStatusVal)} 
                              aria-label={`เปิด/ปิดการขาย ${product.name}`}
                            />
                            <div className={`block w-9 h-5 rounded-full transition-colors ${currentStatusVal === 1 ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-3 h-3 rounded-full transition-transform ${currentStatusVal === 1 ? 'transform translate-x-4' : ''}`}></div>
                          </div>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">฿</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="ราคาปกติ"
                            value={currentVal === null ? '' : currentVal}
                            onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            className={`w-full pl-8 pr-4 py-2 border rounded-lg outline-none transition focus:ring-2 ${
                              hasDiscount && !isError
                                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-200 text-emerald-700 bg-emerald-50 font-bold' 
                                : isError
                                ? 'border-red-300 focus:border-red-500 focus:ring-red-200 text-red-700 bg-red-50'
                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                            }`}
                          />
                        </div>
                        {isError && <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> ลดราคาต้องถูกกว่าราคาปกติ</p>}
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="datetime-local"
                          title="วันเวลาที่สิ้นสุดโปรโมชั่น"
                          placeholder="เลือกวันเวลาที่สิ้นสุด"
                          value={currentEndDateVal ? new Date(new Date(currentEndDateVal).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                          onChange={(e) => handleDateChange(product.id, e.target.value ? new Date(e.target.value).toISOString() : '')}
                          className={`w-full px-3 py-2 border rounded-lg outline-none transition focus:ring-2 ${hasDiscount && !currentEndDateVal ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-200 bg-amber-50' : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'}`}
                        />
                        {hasDiscount && !currentEndDateVal && <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> ควรระบุเวลาสิ้นสุด</p>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}