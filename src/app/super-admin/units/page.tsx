'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, Edit2, Trash2, X, AlertCircle, Info, Scale } from 'lucide-react';

interface Unit {
  id: string;
  name: string;
  step_value: number;
  min_value: number;
}

export default function UnitsManagementPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentUnitId, setCurrentUnitId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({ name: '', step_value: 1, min_value: 1 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchUnits = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('product_units')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching units:', error);
    } else {
      setUnits(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUnits();
  }, []);

  const openModal = (unit?: Unit) => {
    setError(null);
    if (unit) {
      setIsEditMode(true);
      setCurrentUnitId(unit.id);
      setFormData({ name: unit.name, step_value: unit.step_value, min_value: unit.min_value });
    } else {
      setIsEditMode(false);
      setCurrentUnitId(null);
      setFormData({ name: '', step_value: 1, min_value: 1 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditMode && currentUnitId) {
        const { error } = await supabase
          .from('product_units')
          .update(formData)
          .eq('id', currentUnitId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('product_units')
          .insert([formData]);
        if (error) throw error;
      }
      
      await fetchUnits();
      closeModal();
    } catch (err: any) {
      // ดักจับ Error กรณีตั้งชื่อซ้ำ (UNIQUE Constraint)
      if (err.code === '23505') {
        setError('ชื่อหน่วยนับนี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`คุณต้องการลบหน่วยนับ "${name}" ใช่หรือไม่?`)) return;

    try {
      // 1. ตรวจสอบว่ามีสินค้าใช้งานหน่วยนี้อยู่หรือไม่ (Pre-check)
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('unit_id', id);

      if (countError) throw countError;

      if (count && count > 0) {
        alert(`ไม่สามารถลบได้ เนื่องจากมีสินค้าใช้งานหน่วยนับนี้อยู่จำนวน ${count} รายการ\nกรุณาเปลี่ยนหน่วยนับของสินค้าเหล่านั้นก่อนทำการลบ`);
        return;
      }

      // 2. ถ้าไม่มีสินค้าใช้งาน ให้ทำการลบได้
      const { error } = await supabase.from('product_units').delete().eq('id', id);
      if (error) throw error;

      await fetchUnits();
    } catch (err: any) {
      console.error('Error deleting unit:', err);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Scale className="w-6 h-6 text-blue-600" /> จัดการหน่วยนับสินค้า
            </h1>
            <p className="text-gray-500 text-sm mt-1">กำหนดหน่วยนับส่วนกลาง เพื่อใช้ในการสร้างและจัดการสินค้า</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> เพิ่มหน่วยนับ
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-slate-600 text-sm">
                  <th className="p-4 font-medium">ชื่อหน่วยนับ</th>
                  <th className="p-4 font-medium">Step Value (การเพิ่ม/ลด)</th>
                  <th className="p-4 font-medium">Min Value (สั่งซื้อขั้นต่ำ)</th>
                  <th className="p-4 font-medium text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">กำลังโหลดข้อมูล...</td>
                  </tr>
                ) : units.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">ยังไม่มีข้อมูลหน่วยนับ</td>
                  </tr>
                ) : (
                  units.map((unit) => (
                    <tr key={unit.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition last:border-0">
                      <td className="p-4">
                        <span className="font-semibold text-slate-800">{unit.name}</span>
                      </td>
                      <td className="p-4 text-slate-600">{unit.step_value}</td>
                      <td className="p-4 text-slate-600">{unit.min_value}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openModal(unit)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="แก้ไข">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(unit.id, unit.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="ลบ">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-5 border-b border-gray-100">
                <h3 className="text-lg font-bold text-slate-800">{isEditMode ? 'แก้ไขหน่วยนับ' : 'เพิ่มหน่วยนับใหม่'}</h3>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition" title="ปิด"><X className="w-5 h-5" /></button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                {error && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm flex gap-2 items-start">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหน่วยนับ</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="เช่น ชิ้น, กิโลกรัม, แพ็ค" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Step Value</label>
                    <input type="number" step="0.01" required min="0.01" value={formData.step_value} onChange={(e) => setFormData({ ...formData, step_value: parseFloat(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" title="Step Value" placeholder="0.01" />
                    <p className="text-xs text-gray-500 mt-1">สเต็ปเวลาเพิ่ม/ลดในตะกร้า</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Value</label>
                    <input type="number" step="0.01" required min="0.01" value={formData.min_value} onChange={(e) => setFormData({ ...formData, min_value: parseFloat(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" title="Min Value" placeholder="0.01" />
                     <p className="text-xs text-gray-500 mt-1">จำนวนสั่งซื้อขั้นต่ำ</p>
                  </div>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl text-xs text-blue-800 flex items-start gap-2 mt-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p><strong>ตัวอย่าง:</strong> หากขายเนื้อสัตว์เป็นกิโลกรัม และให้ลูกค้ากดเพิ่มทีละ 2 ขีด (0.2 กก.) ให้ตั้งค่า Step = 0.2 และ Min = 0.2</p>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">ยกเลิก</button>
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-70 disabled:cursor-not-allowed shadow-sm">
                    {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}