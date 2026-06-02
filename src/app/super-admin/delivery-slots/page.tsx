'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Clock, Plus, Edit, Trash2, CheckCircle2, XCircle, AlertCircle, Save, X } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';

type DeliverySlot = {
  id: string;
  name: string;
  time_range: string;
  cut_off_hour: number;
  is_active: boolean;
  sort_order: number;
  slot_type: string;
};

export default function DeliverySlotsPage() {
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [slotToDelete, setSlotToDelete] = useState<DeliverySlot | null>(null);

  // State สำหรับฟอร์ม
  const [formData, setFormData] = useState({
    name: '',
    time_range: '',
    cut_off_hour: 0,
    sort_order: 1,
    is_active: true,
    slot_type: 'both',
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_slots')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSlots(data || []);
    } catch (error: any) {
      console.error('Error fetching slots:', error);
      alert('ไม่สามารถโหลดข้อมูลรอบจัดส่งได้: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // เปิด Modal เพื่อเพิ่มข้อมูลใหม่
  const handleAddNew = () => {
    setEditingId(null);
    setModalError(null);
    setFormData({
      name: '',
      time_range: '',
      cut_off_hour: 12, // ค่าเริ่มต้น
      sort_order: slots.length > 0 ? Math.max(...slots.map(s => s.sort_order)) + 1 : 1,
      is_active: true,
      slot_type: 'both',
    });
    setIsModalOpen(true);
  };

  // เปิด Modal เพื่อแก้ไขข้อมูลเดิม
  const handleEdit = (slot: DeliverySlot) => {
    setEditingId(slot.id);
    setModalError(null);
    setFormData({
      name: slot.name,
      time_range: slot.time_range,
      cut_off_hour: slot.cut_off_hour,
      sort_order: slot.sort_order,
      is_active: slot.is_active,
      slot_type: slot.slot_type || 'both',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setModalError(null);
  };

  // บันทึกข้อมูล (แยก Insert กับ Update)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setModalError(null);
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .from('delivery_slots')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
        alert('อัปเดตข้อมูลสำเร็จ');
      } else {
        // Insert
        const { error } = await supabase
          .from('delivery_slots')
          .insert([formData]);
        if (error) throw error;
        alert('เพิ่มรอบจัดส่งใหม่สำเร็จ');
      }
      
      closeModal();
      fetchSlots();
    } catch (error: any) {
      setModalError('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = (slot: DeliverySlot) => {
    setSlotToDelete(slot);
  };

  // ลบข้อมูล
  const handleDelete = async () => {
    if (!slotToDelete) return;
    try {
      const { error } = await supabase.from('delivery_slots').delete().eq('id', slotToDelete.id);
      if (error) throw error;
      alert('ลบข้อมูลสำเร็จ');
      fetchSlots();
    } catch (error: any) {
      alert('ลบข้อมูลไม่สำเร็จ: ' + error.message);
    } finally {
      setSlotToDelete(null);
    }
  };

  // สลับสถานะเปิด/ปิดใช้งานอย่างรวดเร็ว
  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      setSlots(slots.map(s => s.id === id ? { ...s, is_active: !currentStatus } : s)); // Optimistic UI
      const { error } = await supabase
        .from('delivery_slots')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      alert('เปลี่ยนสถานะไม่สำเร็จ');
      fetchSlots(); // Rollback UI if error
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-8 h-8 text-blue-600" />
              จัดการรอบการจัดส่ง
            </h1>
            <p className="text-gray-500 mt-1">กำหนดรอบเวลาและเงื่อนไขเวลาตัดรอบ (Cut-off) สำหรับให้ลูกค้าเลือกในหน้าชำระเงิน</p>
          </div>
          <button
            onClick={handleAddNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-5 h-5" /> เพิ่มรอบจัดส่งใหม่
          </button>
        </div>

        {/* Table / List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-700">
                <tr>
                  <th className="px-6 py-4 font-semibold w-16 text-center">ลำดับ</th>
                  <th className="px-6 py-4 font-semibold">ชื่อรอบจัดส่ง</th>
                  <th className="px-6 py-4 font-semibold">ช่วงเวลา</th>
                  <th className="px-6 py-4 font-semibold text-center">ประเภท</th>
                  <th className="px-6 py-4 font-semibold text-center">เวลาตัดรอบ (Cut-off)</th>
                  <th className="px-6 py-4 font-semibold text-center">สถานะ</th>
                  <th className="px-6 py-4 font-semibold text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-gray-400">ยังไม่มีข้อมูลรอบการจัดส่ง</td>
                  </tr>
                ) : (
                  slots.map((slot) => (
                    <tr key={slot.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-center font-medium text-gray-900">{slot.sort_order}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900">{slot.name}</td>
                      <td className="px-6 py-4 text-blue-600 font-medium">{slot.time_range}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 text-xs rounded-md font-medium ${!slot.slot_type || slot.slot_type === 'both' ? 'bg-purple-100 text-purple-700' : slot.slot_type === 'delivery' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {!slot.slot_type || slot.slot_type === 'both' ? 'ทั้งหมด' : slot.slot_type === 'delivery' ? 'เฉพาะจัดส่ง' : 'เฉพาะรับที่ร้าน'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {slot.cut_off_hour === 0 ? 'สั่งล่วงหน้าข้ามวันเท่านั้น' : `${slot.cut_off_hour.toString().padStart(2, '0')}:00 น.`}
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => toggleActive(slot.id, slot.is_active)}
                          className={`flex items-center gap-1.5 mx-auto px-3 py-1 rounded-full text-xs font-semibold border transition ${slot.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                        >
                          {slot.is_active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {slot.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button onClick={() => handleEdit(slot)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="แก้ไข">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteRequest(slot)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="ลบ">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {slotToDelete && (
        <ConfirmModal
          isOpen={!!slotToDelete}
          title="ยืนยันการลบรอบจัดส่ง"
          message={`คุณแน่ใจหรือไม่ว่าต้องการลบ "${slotToDelete.name}"?\n(หากมีออเดอร์ที่ใช้รอบนี้ไปแล้ว อาจทำให้การแสดงผลผิดพลาด แนะนำให้ใช้วิธี 'ปิดใช้งาน' แทน)`}
          onConfirm={handleDelete}
          onCancel={() => setSlotToDelete(null)}
          confirmText="ลบ"
          isDestructive
        />
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'แก้ไขรอบจัดส่ง' : 'เพิ่มรอบจัดส่งใหม่'}</h2>
              <button 
                onClick={closeModal} 
                className="text-gray-400 hover:text-gray-600 transition"
                title="ปิดหน้าต่าง"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-5">
              {modalError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อรอบจัดส่ง <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น รอบเช้า, รอบดึก" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงเวลา (แสดงให้ลูกค้าเห็น) <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.time_range} onChange={(e) => setFormData({...formData, time_range: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น 08:00 - 09:00" />
              </div>
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl">
                <label className="block text-sm font-bold text-orange-800 mb-1 flex items-center gap-1.5"><AlertCircle className="w-4 h-4"/> เวลาตัดรอบ (Cut-off Hour)</label>
                <p className="text-xs text-orange-600 mb-3 leading-relaxed">หากลูกค้าสั่งซื้อหลังจากชั่วโมงนี้ ระบบจะไม่อนุญาตให้เลือกรอบนี้สำหรับ "วันนี้" (เช่น ใส่ 12 หมายถึง สั่งหลังเที่ยงจะไม่สามารถเลือกรอบนี้เพื่อรับของวันนี้ได้)</p>
                <input required type="number" min="0" max="24" value={formData.cut_off_hour} onChange={(e) => setFormData({...formData, cut_off_hour: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0-24" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทการใช้งาน <span className="text-red-500">*</span></label>
                <select title="ประเภทการใช้งาน" value={formData.slot_type} onChange={(e) => setFormData({...formData, slot_type: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="both">ใช้ได้ทั้ง 2 แบบ (จัดส่ง & รับที่ร้าน)</option>
                  <option value="delivery">เฉพาะจัดส่งตามรอบ (Delivery)</option>
                  <option value="pickup">เฉพาะรับที่ร้าน (Store Pickup)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">ใช้แยกตัวเลือกระหว่างรอบจัดส่งปกติ และเวลานัดรับที่ร้าน</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับการแสดงผล</label>
                  <input required type="number" min="1" value={formData.sort_order} onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1" title="ลำดับการแสดงผล" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">สถานะ</label>
                  <label className="flex items-center cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} />
                      <div className={`block w-14 h-8 rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.is_active ? 'transform translate-x-6' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-medium text-gray-700">{formData.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">ยกเลิก</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition flex items-center gap-2 disabled:bg-blue-400">
                  <Save className="w-4 h-4" /> {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
