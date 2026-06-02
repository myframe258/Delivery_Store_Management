'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Megaphone, Plus, Edit2, Trash2, X, Image as ImageIcon, UploadCloud, Link as LinkIcon, AlertCircle, CheckCircle, Loader2, Store, Globe } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import toast from 'react-hot-toast';

type Promotion = {
  id: string;
  title: string;
  image_url: string;
  target_url: string | null;
  branch_id: number | null;
  sort_order: number;
  is_active: boolean;
  branches?: { name: string } | null;
};

type Branch = {
  id: number;
  name: string;
};

export default function SuperAdminPromotionsPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterBranch, setFilterBranch] = useState<string>('all'); // 'all', 'global', or branch_id

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [promotionToDelete, setPromotionToDelete] = useState<Promotion | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    image_url: '',
    target_url: '',
    branch_id: '', // ค่าว่าง = ทุกสาขา
    sort_order: '1',
    is_active: true,
  });

  useEffect(() => {
    fetchPromotions();
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchBranches = async () => {
    const { data } = await supabase.from('branches').select('id, name').order('name');
    if (data) setBranches(data);
  };

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('branch_promotions')
        .select('*, branches(name)')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPromotions(data || []);
    } catch (error: any) {
      console.error('Error fetching promotions:', error.message);
      toast.error('ไม่สามารถดึงข้อมูลโปรโมชันได้');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (promo?: Promotion) => {
    if (promo) {
      setEditingId(promo.id);
      setFormData({
        title: promo.title || '',
        image_url: promo.image_url || '',
        target_url: promo.target_url || '',
        branch_id: promo.branch_id ? String(promo.branch_id) : '',
        sort_order: String(promo.sort_order),
        is_active: promo.is_active !== false,
      });
    } else {
      setEditingId(null);
      setFormData({ title: '', image_url: '', target_url: '', branch_id: '', sort_order: '1', is_active: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('promotions').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('promotions').getPublicUrl(filePath);
      setFormData({ ...formData, image_url: publicUrl });
    } catch (error: any) {
      console.error('Upload error:', error.message);
      toast.error(`เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${error.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const deleteImageFromStorage = async (imageUrl: string | null) => {
    if (!imageUrl) return;
    try {
      const urlParts = imageUrl.split('/public/promotions/');
      if (urlParts.length === 2) {
        const filePath = urlParts[1];
        await supabase.storage.from('promotions').remove([filePath]);
      }
    } catch (err) {
      console.error('Error removing image:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        title: formData.title,
        image_url: formData.image_url,
        target_url: formData.target_url || null,
        branch_id: formData.branch_id ? parseInt(formData.branch_id, 10) : null,
        sort_order: parseInt(formData.sort_order, 10) || 1,
        is_active: formData.is_active,
      };

      if (editingId) {
        const existingPromo = promotions.find(p => p.id === editingId);
        const { error } = await supabase.from('branch_promotions').update(payload).eq('id', editingId);
        if (error) throw error;

        // ลบรูปเก่าทิ้งถ้ามีการเปลี่ยนรูป
        if (existingPromo?.image_url && existingPromo.image_url !== payload.image_url) {
          await deleteImageFromStorage(existingPromo.image_url);
        }
        toast.success('อัปเดตแบนเนอร์โปรโมชันสำเร็จ');
      } else {
        const { error } = await supabase.from('branch_promotions').insert([payload]);
        if (error) throw error;
        toast.success('เพิ่มแบนเนอร์โปรโมชันใหม่สำเร็จ');
      }

      closeModal();
      fetchPromotions();
    } catch (error: any) {
      console.error('Error saving promotion:', error.message);
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!promotionToDelete) return;
    try {
      const { error } = await supabase.from('branch_promotions').delete().eq('id', promotionToDelete.id);
      if (error) throw error;
      
      // ลบรูปภาพออกจาก Storage ด้วย
      await deleteImageFromStorage(promotionToDelete.image_url);

      toast.success('ลบแบนเนอร์สำเร็จ');
      setPromotions(promotions.filter(p => p.id !== promotionToDelete.id));
    } catch (error: any) {
      console.error('Error deleting promotion:', error.message);
      toast.error(`ไม่สามารถลบได้: ${error.message}`);
    } finally {
      setPromotionToDelete(null);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: nextStatus } : p));
    try {
      const { error } = await supabase.from('branch_promotions').update({ is_active: nextStatus }).eq('id', id);
      if (error) throw error;
      toast.success(nextStatus ? 'เปิดแสดงแบนเนอร์แล้ว' : 'ซ่อนแบนเนอร์แล้ว');
    } catch (error: any) {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
      fetchPromotions();
    }
  };

  const filteredPromotions = promotions.filter(p => {
    if (filterBranch === 'all') return true;
    if (filterBranch === 'global') return p.branch_id === null;
    return p.branch_id === Number(filterBranch);
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-blue-600" />
            จัดการแบนเนอร์โปรโมชัน
          </h1>
          <p className="text-gray-500 mt-1">เพิ่ม แก้ไข หรือลบแบนเนอร์สไลด์ที่แสดงในหน้าร้านของลูกค้า</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-sm active:scale-95 w-full md:w-auto justify-center"
        >
          <Plus className="w-5 h-5" /> เพิ่มแบนเนอร์ใหม่
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <Store className="w-5 h-5 text-gray-400" />
          <span className="font-medium text-sm text-gray-700">ตัวกรอง:</span>
        </div>
        <select
          value={filterBranch}
          title="เลือกสาขาเพื่อกรองแบนเนอร์"
          onChange={(e) => setFilterBranch(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="all">แสดงทั้งหมด</option>
          <option value="global">🌐 เฉพาะแบนเนอร์รวม (ทุกสาขา)</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>📍 เฉพาะสาขา: {b.name}</option>
          ))}
        </select>
      </div>

      {/* Promotions Grid */}
      {loading ? (
        <div className="text-center py-20 text-gray-500 animate-pulse">กำลังโหลดข้อมูลแบนเนอร์...</div>
      ) : filteredPromotions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">ยังไม่มีแบนเนอร์โปรโมชัน</h3>
          <p className="text-gray-500 mt-2">คลิก "เพิ่มแบนเนอร์ใหม่" เพื่ออัปโหลดแบนเนอร์แรกของคุณ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromotions.map((promo) => (
            <div key={promo.id} className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all flex flex-col ${promo.is_active ? 'border-gray-200 hover:shadow-md' : 'border-gray-200 opacity-75'}`}>
              {/* Image Preview (Aspect Ratio 21:9 or 16:9 equivalent) */}
              <div className="w-full aspect-[21/9] bg-gray-100 relative group overflow-hidden border-b border-gray-100">
                <img src={promo.image_url} alt={promo.title} className={`w-full h-full object-cover transition-transform duration-500 ${!promo.is_active ? 'grayscale' : 'group-hover:scale-105'}`} />
                <div className="absolute top-2 right-2">
                  <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md shadow-sm ${promo.branch_id ? 'bg-blue-600/90 text-white backdrop-blur-sm' : 'bg-emerald-600/90 text-white backdrop-blur-sm'}`}>
                    {promo.branch_id ? `📍 ${promo.branches?.name}` : '🌐 แสดงทุกสาขา'}
                  </span>
                </div>
              </div>
              
              <div className="p-5 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-bold text-gray-800 line-clamp-1">{promo.title}</h3>
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded shrink-0">ลำดับ: {promo.sort_order}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-5 line-clamp-1">
                  <LinkIcon className="w-4 h-4 shrink-0" />
                  <a href={promo.target_url || '#'} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">{promo.target_url || 'ไม่มีลิงก์ปลายทาง'}</a>
                </div>

                <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                  <label className="flex items-center cursor-pointer gap-2">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={promo.is_active} onChange={() => handleToggleStatus(promo.id, promo.is_active)} />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${promo.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${promo.is_active ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                    <span className={`text-xs font-bold ${promo.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>{promo.is_active ? 'แสดงผลอยู่' : 'ซ่อน'}</span>
                  </label>
                  
                  <div className="flex gap-1.5">
                    <button onClick={() => openModal(promo)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setPromotionToDelete(promo)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'แก้ไขแบนเนอร์' : 'เพิ่มแบนเนอร์ใหม่'}</h2>
              <button 
                onClick={closeModal} 
                title="ปิดหน้าต่าง"
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-grow flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ/หัวข้อโปรโมชัน <span className="text-red-500">*</span></label>
                <input required type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น ลดกระหน่ำกลางปี 2024" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพแบนเนอร์ <span className="text-red-500">*</span></label>
                <div className="flex gap-2">
                  <input required type="url" value={formData.image_url} onChange={(e) => setFormData({...formData, image_url: e.target.value})} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="https://... หรือคลิกอัปโหลด" />
                  <label className={`flex items-center justify-center px-4 py-2 bg-slate-100 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors ${isUploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploadingImage ? <Loader2 className="w-5 h-5 animate-spin text-slate-500" /> : <UploadCloud className="w-5 h-5 text-slate-600" />}
                    <span className="ml-2 text-sm font-medium text-slate-700 hidden sm:inline-block">อัปโหลด</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                  </label>
                </div>
                {formData.image_url && (
                  <div className="mt-3 w-full aspect-[21/9] rounded-lg border border-gray-200 overflow-hidden relative bg-gray-50 flex items-center justify-center shadow-inner">
                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1.5">แนะนำรูปภาพแนวนอน อัตราส่วนประมาณ 21:9 หรือ 16:9</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ลิงก์ปลายทาง (Target URL)</label>
                <input type="url" value={formData.target_url} onChange={(e) => setFormData({...formData, target_url: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น https://line.me/ti/p/... (ใส่หรือไม่ใส่ก็ได้)" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เลือกสาขาที่จะแสดงผล</label>
                  <select 
                    value={formData.branch_id} 
                    title="เลือกสาขาที่จะแสดงผล"
                    onChange={(e) => setFormData({...formData, branch_id: e.target.value})} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="">🌐 แสดงทุกสาขา (Global)</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>📍 เฉพาะสาขา: {b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับการแสดงผล</label>
                  <input type="number" min="1" value={formData.sort_order} onChange={(e) => setFormData({...formData, sort_order: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1" />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} disabled={isSaving} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">ยกเลิก</button>
                <button type="submit" disabled={isSaving || !formData.title || !formData.image_url} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center gap-2">
                  {isSaving ? <><Loader2 className="w-4 h-4 animate-spin"/> กำลังบันทึก...</> : 'บันทึกแบนเนอร์'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!promotionToDelete}
        title="ยืนยันการลบแบนเนอร์"
        message={`คุณแน่ใจหรือไม่ว่าต้องการลบแบนเนอร์ "${promotionToDelete?.title}" ?\nรูปภาพและข้อมูลจะถูกลบออกจากระบบทันที`}
        onConfirm={handleDelete}
        onCancel={() => setPromotionToDelete(null)}
        confirmText="ลบแบนเนอร์"
        isDestructive
      />
    </div>
  );
}