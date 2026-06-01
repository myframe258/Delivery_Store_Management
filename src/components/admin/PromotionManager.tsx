'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, Edit2, Trash2, Image as ImageIcon, Save, X, Loader2, AlertCircle, Link as LinkIcon, UploadCloud } from 'lucide-react';
import Image from 'next/image';

// Types
export interface Promotion {
  id: string;
  branch_id: string;
  image_url: string;
  title: string;
  target_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface PromotionManagerProps {
  branchId: string;
}

// ฟังก์ชันสำหรับบีบอัดและปรับขนาดรูปภาพ (Client-side)
const compressImage = (file: File, maxWidth: number = 1200): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image(); // ใช้ window.Image ป้องกันการซ้ำซ้อนกับ next/image
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // คำนวณสัดส่วนใหม่ถ้าความกว้างเกินกำหนด
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // แปลงกลับเป็นไฟล์ JPEG คุณภาพ 80%
        canvas.toBlob((blob) => {
          if (blob) {
            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            resolve(new File([blob], newFileName, { type: 'image/jpeg', lastModified: Date.now() }));
          } else reject(new Error('การบีบอัดรูปภาพล้มเหลว'));
        }, 'image/jpeg', 0.8); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export default function PromotionManager({ branchId }: PromotionManagerProps) {
  // Supabase Client สำหรับ Next.js App Router
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // States
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form States
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    target_url: '',
    sort_order: 1,
    is_active: true,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Fetch Data เมื่อคอมโพเนนต์โหลดหรือเปลี่ยนสาขา
  useEffect(() => {
    if (branchId) {
      fetchPromotions();
    }
  }, [branchId]);

  const fetchPromotions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('branch_promotions')
        .select('*')
        .eq('branch_id', branchId)
        .order('sort_order', { ascending: true });

      if (fetchError) throw fetchError;
      setPromotions(data || []);
    } catch (err: any) {
      console.error('Error fetching promotions:', err);
      setError('ไม่สามารถโหลดข้อมูลโปรโมชันได้: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // จัดการเมื่อผู้ใช้เลือกไฟล์รูปภาพ
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        // บีบอัดรูปให้ความกว้างไม่เกิน 1200px ก่อนเก็บลง State
        const compressedFile = await compressImage(file, 1200);
        setImageFile(compressedFile);
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(compressedFile);
      } catch (err) {
        console.error("Image compression error:", err);
        setError("ไม่สามารถประมวลผลรูปภาพได้ ลองเปลี่ยนไฟล์รูปภาพใหม่");
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      target_url: '',
      // แนะนำลำดับถัดไปโดยอัตโนมัติ
      sort_order: promotions.length > 0 ? Math.max(...promotions.map(p => p.sort_order)) + 1 : 1,
      is_active: true,
    });
    setImageFile(null);
    setImagePreview(null);
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (promo: Promotion) => {
    setFormData({
      title: promo.title,
      target_url: promo.target_url || '',
      sort_order: promo.sort_order,
      is_active: promo.is_active,
    });
    setImageFile(null);
    setImagePreview(promo.image_url); // แสดงรูปเดิมที่เคยอัปโหลด
    setEditingId(promo.id);
    setShowForm(true);
  };

  // ฟังก์ชันช่วยสกัด Path ของไฟล์จาก URL ของ Supabase เพื่อใช้ตอนลบไฟล์
  const extractFilePath = (url: string) => {
    const baseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/promotions/`;
    if (url.startsWith(baseUrl)) {
      return url.replace(baseUrl, '');
    }
    return null;
  };

  // บันทึกข้อมูล (เพิ่ม/แก้ไข)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) {
      setError('กรุณากรอกชื่อแคมเปญ');
      return;
    }
    // ถ้าสร้างใหม่ ต้องมีไฟล์รูป
    if (!editingId && !imageFile) {
      setError('กรุณาอัปโหลดรูปภาพแบนเนอร์');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      
      let finalImageUrl = imagePreview; // ค่าตั้งต้นคือรูปเดิม (ถ้าไม่ได้อัปใหม่ตอนแก้ไข)

      // 1. อัปโหลดรูปภาพใหม่ (ถ้ามีการเลือกไฟล์)
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        // สร้างชื่อไฟล์ไม่ให้ซ้ำกัน โดยแยกโฟลเดอร์ตามสาขา
        const fileName = `${branchId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('promotions')
          .upload(fileName, imageFile);

        if (uploadError) throw uploadError;

        // ดึง URL ที่เป็นสาธารณะมาใช้งาน
        const { data: publicUrlData } = supabase.storage
          .from('promotions')
          .getPublicUrl(fileName);
          
        finalImageUrl = publicUrlData.publicUrl;

        // (ออปชันเสริม) ถ้าเป็นการแก้ไขและอัปโหลดรูปใหม่ ให้ลบรูปเก่าออกจาก Storage เพื่อประหยัดพื้นที่
        if (editingId) {
           const oldPromo = promotions.find(p => p.id === editingId);
           if (oldPromo && oldPromo.image_url) {
             const oldPath = extractFilePath(oldPromo.image_url);
             if (oldPath) {
               await supabase.storage.from('promotions').remove([oldPath]);
             }
           }
        }
      }

      const payload = {
        branch_id: branchId,
        title: formData.title,
        target_url: formData.target_url || null,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
        image_url: finalImageUrl,
      };

      // 2. บันทึกลงฐานข้อมูล (Update หรือ Insert)
      if (editingId) {
        const { error: updateError } = await supabase
          .from('branch_promotions')
          .update(payload)
          .eq('id', editingId);
        
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('branch_promotions')
          .insert([payload]);
          
        if (insertError) throw insertError;
      }

      await fetchPromotions();
      resetForm();
    } catch (err: any) {
      console.error('Error saving promotion:', err);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ลบข้อมูลแบนเนอร์
  const handleDelete = async (promo: Promotion) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ที่จะลบแบนเนอร์ "${promo.title}"?\n(การกระทำนี้ไม่สามารถกู้คืนได้)`)) return;

    try {
      setIsLoading(true);
      
      // 1. ลบจากฐานข้อมูล
      const { error: deleteError } = await supabase
        .from('branch_promotions')
        .delete()
        .eq('id', promo.id);
        
      if (deleteError) throw deleteError;

      // 2. ลบไฟล์รูปออกจาก Storage
      const filePath = extractFilePath(promo.image_url);
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('promotions')
          .remove([filePath]);
          
        if (storageError) {
          console.warn('Could not delete image from storage:', storageError);
          // ไม่ต้อง Throw Error ให้แสดงผลลบสำเร็จไปเลย เพราะหลักๆ ลบใน Database ไปแล้ว
        }
      }

      await fetchPromotions();
    } catch (err: any) {
      console.error('Error deleting promotion:', err);
      setError('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">จัดการแบนเนอร์โปรโมชัน</h2>
          <p className="text-sm text-slate-500 mt-1">ตั้งค่าแบนเนอร์โฆษณาที่จะแสดงผลบนหน้าร้านของสาขานี้</p>
        </div>
        {!showForm && (
          <button 
            onClick={openAddForm}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" /> เพิ่มแบนเนอร์ใหม่
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* ส่วนจัดการฟอร์ม (Form Area) */}
      {showForm && (
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-800">{editingId ? 'แก้ไขโปรโมชัน' : 'เพิ่มโปรโมชันใหม่'}</h3>
              <button type="button" onClick={resetForm} className="text-slate-400 hover:text-slate-600 p-1" title="ปิดฟอร์ม">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* พื้นที่อัปโหลดรูป (Image Upload Area) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">รูปภาพแบนเนอร์ <span className="text-red-500">*</span></label>
                <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden group aspect-[21/9] flex items-center justify-center cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*"
                    title="อัปโหลดรูปภาพแบนเนอร์"
                    placeholder="เลือกไฟล์รูปภาพ"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {imagePreview ? (
                    <>
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-0">
                        <span className="text-white flex items-center gap-2 font-medium bg-black/50 px-3 py-1.5 rounded-lg"><UploadCloud className="w-4 h-4" /> เปลี่ยนรูปภาพ</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <UploadCloud className="w-8 h-8 mb-2 text-slate-300 group-hover:text-blue-500 transition-colors" />
                      <span className="text-sm font-medium text-slate-600">คลิกหรือลากไฟล์มาวางที่นี่</span>
                      <span className="text-xs mt-1">แนะนำสัดส่วน 21:9 (แนวนอน)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ฟิลด์ข้อมูล (Form Fields) */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อแคมเปญ / โฆษณา <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="เช่น โค้ดลด 50% ต้อนรับปีใหม่"
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ลิงก์ปลายทาง (เมื่อคลิก)</label>
                  <input 
                    type="url" 
                    value={formData.target_url}
                    onChange={(e) => setFormData({...formData, target_url: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">ลำดับแสดงผล</label>
                    <input 
                      type="number" 
                      min="1"
                      title="ลำดับการแสดงผล"
                      placeholder="1"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 1})}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">สถานะ</label>
                    <label className="relative inline-flex items-center cursor-pointer mt-1">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-3 text-sm font-medium text-slate-700">{formData.is_active ? 'เปิดใช้งาน' : 'ซ่อนไว้'}</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                type="button" 
                onClick={resetForm}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 active:scale-95"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ส่วนแสดงรายการ (List Area) */}
      <div className="p-6">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-blue-500" />
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : promotions.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm">
              <ImageIcon className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-1">ยังไม่มีแบนเนอร์โปรโมชัน</h3>
            <p className="text-slate-500 mb-6 text-sm">เพิ่มแบนเนอร์เพื่อประชาสัมพันธ์สินค้าหรือแคมเปญให้ลูกค้าทราบ</p>
            <button 
              onClick={openAddForm}
              className="bg-white border border-slate-300 text-slate-700 px-5 py-2 rounded-xl font-medium hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 transition-colors shadow-sm"
            >
              เพิ่มแบนเนอร์แรก
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500 bg-slate-50/50">
                  <th className="font-semibold py-3 px-4 rounded-tl-xl w-32">รูปภาพ</th>
                  <th className="font-semibold py-3 px-4">ข้อมูลแคมเปญ</th>
                  <th className="font-semibold py-3 px-4 w-24 text-center">ลำดับ</th>
                  <th className="font-semibold py-3 px-4 w-32 text-center">สถานะ</th>
                  <th className="font-semibold py-3 px-4 w-24 text-right rounded-tr-xl">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {promotions.map((promo) => (
                  <tr key={promo.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="relative w-28 h-12 bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                        {promo.image_url ? (
                          <Image src={promo.image_url} alt={promo.title} fill className="object-cover" />
                        ) : (
                          <ImageIcon className="absolute inset-0 m-auto w-5 h-5 text-slate-300" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-800 text-sm">{promo.title}</p>
                      {promo.target_url && (
                        <a href={promo.target_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5">
                          <LinkIcon className="w-3 h-3" /> ลิงก์ปลายทาง
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                        {promo.sort_order}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {promo.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> เปิดใช้งาน
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> ซ่อนไว้
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 md:opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditForm(promo)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(promo)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}