'use client';

import { useState, useEffect, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Search, Edit, Save, XCircle, Package } from 'lucide-react';

// A type for the combined data, easy to replace with Supabase generated types later
type InventoryItem = {
  branch_id: string;
  product_id: string;
  stock_count: number;
  status: 'available' | 'unavailable';
  products: {
    id: string;
    name: string;
    description: string;
    image_url: string;
    price: number;
  } | null;
};

export default function InventoryPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRow, setEditingRow] = useState<string | null>(null); // product_id of the row being edited
  const [currentStock, setCurrentStock] = useState(0);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('branch_id')
        .eq('id', session.user.id)
        .single();

      if (!userProfile?.branch_id) {
        setLoading(false);
        return;
      }
      setBranchId(userProfile.branch_id);

      const { data, error } = await supabase
        .from('branch_inventory')
        .select('*, products(*)')
        .eq('branch_id', userProfile.branch_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInventory(data as InventoryItem[]);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (productId: string) => {
    if (!branchId) return;

    try {
      const { error } = await supabase
        .from('branch_inventory')
        .update({ stock_count: currentStock })
        .match({ branch_id: branchId, product_id: productId });

      if (error) throw error;

      // Update local state to reflect change immediately
      setInventory(prev =>
        prev.map(item =>
          item.product_id === productId ? { ...item, stock_count: currentStock } : item
        )
      );
      setEditingRow(null); // Exit editing mode
      alert('อัปเดตสต็อกเรียบร้อย');
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const handleToggleStatus = async (productId: string, currentStatus: 'available' | 'unavailable') => {
    if (!branchId) return;

    const newStatus = currentStatus === 'available' ? 'unavailable' : 'available';

    try {
      const { error } = await supabase
        .from('branch_inventory')
        .update({ status: newStatus })
        .match({ branch_id: branchId, product_id: productId });

      if (error) throw error;

      // Update local state
      setInventory(prev =>
        prev.map(item =>
          item.product_id === productId ? { ...item, status: newStatus } : item
        )
      );
    } catch (error: any) {
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  };

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventory;
    return inventory.filter(item =>
      item.products?.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [inventory, searchTerm]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูลสต็อกสินค้า...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">จัดการสต็อกสินค้า</h1>
        <div className="relative w-full md:w-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ค้นหาสินค้า..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full md:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 w-[40%]">สินค้า</th>
                <th scope="col" className="px-6 py-3 text-center">สถานะ</th>
                <th scope="col" className="px-6 py-3 text-center">จำนวนในสต็อก</th>
                <th scope="col" className="px-6 py-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.length > 0 ? (
                filteredInventory.map((item) => (
                  <tr key={item.product_id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex items-center gap-4">
                        <img
                          src={item.products?.image_url || 'https://via.placeholder.com/64'}
                          alt={item.products?.name}
                          className="w-16 h-16 object-cover rounded-md bg-gray-100"
                        />
                        <div>
                          <p className="font-semibold">{item.products?.name}</p>
                          <p className="text-xs text-gray-500">฿{item.products?.price.toLocaleString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(item.product_id, item.status)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          item.status === 'available'
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {item.status === 'available' ? 'เปิดขาย' : 'ปิดขาย'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingRow === item.product_id ? (
                        <input
                          type="number"
                          value={currentStock}
                          onChange={(e) => setCurrentStock(Number(e.target.value))}
                          className="w-20 text-center border border-gray-300 rounded-md py-1"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-lg">{item.stock_count}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {editingRow === item.product_id ? (
                        <div className="flex justify-center items-center gap-2">
                          <button
                            onClick={() => handleUpdateStock(item.product_id)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-full"
                            title="บันทึก"
                          >
                            <Save className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setEditingRow(null)}
                            className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                            title="ยกเลิก"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingRow(item.product_id);
                            setCurrentStock(item.stock_count);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-full"
                          title="แก้ไขสต็อก"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="w-12 h-12 text-gray-300" />
                      <span>ไม่พบสินค้าในสต็อกของสาขานี้</span>
                      {searchTerm && <span className="text-sm">สำหรับคำค้นหา: "{searchTerm}"</span>}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}