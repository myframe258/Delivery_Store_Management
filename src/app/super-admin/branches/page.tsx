'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, Edit2, Trash2, MapPin, Phone, Building2, X, AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import toast from 'react-hot-toast';

type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  service_radius?: number;
  is_active?: boolean;
};


export default function SuperAdminBranchesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: '',
    lat: '',
    lng: '',
    service_radius: '15', // ค่าเริ่มต้น 15 กม.
    is_active: true,
  });

  useEffect(() => {
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (error) throw error;
      setBranches(data || []);
    } catch (error: any) {
      console.error('Error fetching branches:', error.message);
      toast.error('ไม่สามารถดึงข้อมูลสาขาได้');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (branch?: Branch) => {
    setModalError(null);
    if (branch) {
      setEditingId(branch.id);
      setFormData({
        name: branch.name || '',
        address: branch.address || '',
        phone: branch.phone || '',
        lat: branch.lat ? String(branch.lat) : '',
        lng: branch.lng ? String(branch.lng) : '',
        service_radius: branch.service_radius ? String(branch.service_radius) : '15',
        is_active: branch.is_active !== false,
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', address: '', phone: '', lat: '', lng: '', service_radius: '15', is_active: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setModalError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setModalError(null);
    
    try {
      const payload = {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        lat: parseFloat(formData.lat),
        lng: parseFloat(formData.lng),
        service_radius: parseInt(formData.service_radius, 10) || 15,
        is_active: formData.is_active,
      };

      if (editingId) {
        // Update
        const { error } = await supabase
          .from('branches')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('อัปเดตข้อมูลสาขาสำเร็จ');
      } else {
        // Insert
        const { data: newBranch, error } = await supabase
          .from('branches')
          .insert([payload])
          .select('id')
          .single();
          
        if (error) throw error;
        
        // ดึงรายการสินค้าทั้งหมดที่มีอยู่ในระบบ เพื่อนำไปสร้างสต็อกเริ่มต้นให้สาขาใหม่
        if (newBranch) {
          const { data: products } = await supabase.from('products').select('id');
          
          if (products && products.length > 0) {
            const inventoryPayload = products.map((p) => ({
              branch_id: newBranch.id,
              product_id: p.id,
              stock_count: 0,
              status: 0 // ค่าเริ่มต้นให้ปิดการขายไว้ก่อน (0)
            }));
            const { error: invError } = await supabase.from('branch_inventory').insert(inventoryPayload);
            if (invError) console.error('Error inserting initial inventory:', invError.message);
          }
        }
        
        toast.success('เพิ่มสาขาใหม่และเตรียมข้อมูลสินค้าสำเร็จ');
      }

      closeModal();
      fetchBranches();
    } catch (error: any) {
      console.error('Error saving branch:', error.message);
      setModalError(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    
    // Optimistic Update: อัปเดต UI ทันทีไม่ต้องรอโหลด
    setBranches(prev => prev.map(b => b.id === id ? { ...b, is_active: nextStatus } : b));
    
    try {
      const { error } = await supabase.from('branches').update({ is_active: nextStatus }).eq('id', id);
      if (error) throw error;
      
      toast.success(nextStatus ? 'เปิดให้บริการสาขานี้แล้ว' : 'ปิดการให้บริการสาขานี้ชั่วคราว');
    } catch (error: any) {
      console.error('Error toggling branch status:', error);
      toast.error(`ไม่สามารถเปลี่ยนสถานะได้: ${error.message}`);
      fetchBranches(); // Rollback กลับถ้าเซฟไม่สำเร็จ
    }
  };

  const handleDeleteRequest = (branch: Branch) => {
    setBranchToDelete(branch);
  };

  const handleDelete = async () => {
    if (!branchToDelete) return;
    try {
      // 1. ตรวจสอบว่ามีพนักงานผูกอยู่หรือไม่
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchToDelete.id);
        
      if (userCount && userCount > 0) {
        toast.error(`ไม่สามารถลบได้ เนื่องจากมีพนักงานสังกัดสาขานี้ ${userCount} คน`);
        setBranchToDelete(null);
        return;
      }

      // 2. ตรวจสอบว่ามีคำสั่งซื้อผูกอยู่หรือไม่
      const { count: orderCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchToDelete.id);

      if (orderCount && orderCount > 0) {
        toast.error(`ไม่สามารถลบได้ เนื่องจากมีคำสั่งซื้อของสาขานี้ ${orderCount} รายการ`);
        setBranchToDelete(null);
        return;
      }

      // 3. ลบสต็อกสินค้าของสาขานี้ออกก่อน (แก้ปัญหา Foreign Key Constraint)
      const { error: invError } = await supabase
        .from('branch_inventory')
        .delete()
        .eq('branch_id', branchToDelete.id);
      if (invError) throw invError;

      // 4. ลบสาขา
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', branchToDelete.id);
        
      if (error) throw error;
      
      toast.success('ลบสาขาสำเร็จ');
      setBranches(branches.filter(b => b.id !== branchToDelete.id));
    } catch (error: any) {
      console.error('Error deleting branch:', error.message);
      toast.error(`ไม่สามารถลบสาขาได้: ${error.message}`);
    } finally {
      setBranchToDelete(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-8 h-8 text-blue-600" />
            จัดการข้อมูลสาขา
          </h1>
          <p className="text-gray-500 mt-1">เพิ่ม แก้ไข หรือลบสาขาในระบบ (Super Admin)</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5" />
          เพิ่มสาขาใหม่
        </button>
      </div>

      {/* Branch List */}
      {loading ? (
        <div className="text-center py-20 text-gray-500 animate-pulse">กำลังโหลดข้อมูลสาขา...</div>
      ) : branches.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">ยังไม่มีข้อมูลสาขา</h3>
          <p className="text-gray-500 mt-2">คลิก "เพิ่มสาขาใหม่" เพื่อเริ่มต้นตั้งค่าระบบ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div key={branch.id} className={`bg-white rounded-2xl p-6 shadow-sm border ${branch.is_active === false ? 'border-gray-200 opacity-75' : 'border-gray-100'} hover:shadow-md transition-all flex flex-col`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1 pr-2">
                  <h2 className="text-xl font-bold text-gray-800 line-clamp-1">{branch.name}</h2>
                  <div className="mt-2">
                    <label className="inline-flex items-center cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={branch.is_active !== false} onChange={() => handleToggleStatus(branch.id, branch.is_active !== false)} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${branch.is_active !== false ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${branch.is_active !== false ? 'transform translate-x-4' : ''}`}></div>
                      </div>
                      <span className={`ml-2 text-xs font-bold ${branch.is_active !== false ? 'text-emerald-600' : 'text-gray-500'}`}>
                        {branch.is_active !== false ? 'เปิดให้บริการ' : 'ปิดชั่วคราว'}
                      </span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => openModal(branch)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไขสาขา">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteRequest(branch)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบสาขา">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="space-y-3 text-sm text-gray-600 flex-grow">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{branch.address || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{branch.phone || '-'}</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Lat: {branch.lat ? Number(branch.lat).toFixed(4) : '-'} | Lng: {branch.lng ? Number(branch.lng).toFixed(4) : '-'}</span>
                <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">รัศมี: {branch.service_radius || 15} กม.</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {branchToDelete && (
        <ConfirmModal
          isOpen={!!branchToDelete}
          title="ยืนยันการลบสาขา"
          message={`คุณแน่ใจหรือไม่ว่าต้องการลบสาขา "${branchToDelete.name}"?\nข้อมูลออเดอร์และสต็อกที่ผูกกับสาขานี้อาจได้รับผลกระทบ`}
          onConfirm={handleDelete}
          onCancel={() => setBranchToDelete(null)}
          confirmText="ลบ"
          isDestructive
        />
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? 'แก้ไขข้อมูลสาขา' : 'เพิ่มสาขาใหม่'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors" title="ปิดหน้าต่าง">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-grow flex flex-col gap-4">
              {modalError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  <span>{modalError}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสาขา <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="เช่น สาขาเชียงใหม่" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รัศมีการให้บริการ (กิโลเมตร) <span className="text-red-500">*</span></label>
                <input required type="number" min="1" value={formData.service_radius} onChange={(e) => setFormData({...formData, service_radius: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="15" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่ <span className="text-red-500">*</span></label>
                <textarea required value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none" placeholder="รายละเอียดที่อยู่..." />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="02-xxx-xxxx" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ละติจูด (Latitude) <span className="text-red-500">*</span></label>
                  <input required type="number" step="any" value={formData.lat} onChange={(e) => setFormData({...formData, lat: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="18.7883" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ลองจิจูด (Longitude) <span className="text-red-500">*</span></label>
                  <input required type="number" step="any" value={formData.lng} onChange={(e) => setFormData({...formData, lng: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" placeholder="98.9853" />
                </div>
              </div>
              
              <div>
                <label className="flex items-center cursor-pointer gap-2 mt-2">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={formData.is_active} onChange={(e) => setFormData({...formData, is_active: e.target.checked})} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${formData.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formData.is_active ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-800">สถานะเปิดให้บริการ</span>
                    <span className="text-xs text-gray-500">หากปิด สาขานี้จะไม่แสดงให้ลูกค้าเลือกใช้งานในหน้าร้าน</span>
                  </div>
                </label>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} disabled={isSaving} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">
                  ยกเลิก
                </button>
                <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors shadow-sm">
                  {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}