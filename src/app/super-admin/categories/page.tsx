'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Plus, Edit2, Trash2, X, AlertCircle, LayoutGrid } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
}

export default function CategoriesManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({ name: '', parent_id: '', sort_order: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true });
      
    if (error) {
      console.error('Error fetching categories:', error);
    } else {
      setCategories(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openModal = (category?: Category) => {
    setError(null);
    if (category) {
      setIsEditMode(true);
      setCurrentCategoryId(category.id);
      setFormData({ 
        name: category.name, 
        parent_id: category.parent_id || '', 
        sort_order: category.sort_order || 0 
      });
    } else {
      setIsEditMode(false);
      setCurrentCategoryId(null);
      // แนะนำลำดับถัดไปให้อัตโนมัติ (เช่น 10, 20, 30)
      const rootCats = categories.filter(c => !c.parent_id);
      setFormData({ name: '', parent_id: '', sort_order: (rootCats.length + 1) * 10 });
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
      const payload = {
        name: formData.name,
        parent_id: formData.parent_id || null,
        sort_order: formData.sort_order,
      };

      if (isEditMode && currentCategoryId) {
        // ดักไม่ให้เลือกตัวเองเป็น Parent
        if (payload.parent_id === currentCategoryId) {
          throw new Error('ไม่สามารถตั้งหมวดหมู่ตัวเองเป็นหมวดหมู่หลักได้');
        }
        
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', currentCategoryId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([payload]);
        if (error) throw error;
      }
      
      await fetchCategories();
      closeModal();
    } catch (err: any) {
      if (err.code === '23505') {
        setError('ชื่อหมวดหมู่นี้มีอยู่ในระบบแล้ว กรุณาใช้ชื่ออื่น');
      } else {
        setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`คุณต้องการลบหมวดหมู่ "${name}" ใช่หรือไม่?`)) return;

    try {
      // 1. เช็คว่ามีหมวดหมู่ย่อยซ้อนอยู่หรือไม่
      const { count: childCount, error: childError } = await supabase
        .from('categories')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', id);

      if (childError) throw childError;

      if (childCount && childCount > 0) {
        alert(`ไม่สามารถลบได้ เนื่องจากมีหมวดหมู่ย่อยอยู่ภายใต้นี้ ${childCount} รายการ\nกรุณาย้ายหรือลบหมวดหมู่ย่อยออกก่อน`);
        return;
      }

      // 2. เช็คว่ามีสินค้าใช้งานหมวดหมู่นี้หรือไม่
      const { count: prodCount, error: prodError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', id);

      if (prodError) throw prodError;

      if (prodCount && prodCount > 0) {
        alert(`ไม่สามารถลบได้ เนื่องจากมีสินค้าผูกกับหมวดหมู่นี้ ${prodCount} รายการ\nกรุณาเปลี่ยนหมวดหมู่ของสินค้าเหล่านั้นก่อนทำการลบ`);
        return;
      }

      // 3. ทำการลบอย่างปลอดภัย
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      await fetchCategories();
    } catch (err: any) {
      console.error('Error deleting category:', err);
      alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + err.message);
    }
  };

  // จัดกลุ่มและเรียงลำดับ Category หลัก/ย่อย
  const rootCategories = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-blue-600" /> จัดการหมวดหมู่สินค้า
            </h1>
            <p className="text-gray-500 text-sm mt-1">กำหนดโครงสร้างและจัดเรียงลำดับหมวดหมู่สินค้า (รองรับหมวดหมู่ย่อย)</p>
          </div>
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> เพิ่มหมวดหมู่
          </button>
        </div>

        {/* Table/List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-100 text-slate-600 text-sm">
                  <th className="p-4 font-medium">ชื่อหมวดหมู่</th>
                  <th className="p-4 font-medium text-center w-32">ลำดับการแสดงผล</th>
                  <th className="p-4 font-medium text-right w-32">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">กำลังโหลดข้อมูล...</td>
                  </tr>
                ) : categories.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500">ยังไม่มีข้อมูลหมวดหมู่</td>
                  </tr>
                ) : (
                  rootCategories.map((rootCat) => (
                    <React.Fragment key={rootCat.id}>
                      <tr className="border-b border-gray-50 hover:bg-slate-50/50 transition">
                        <td className="p-4">
                          <span className="font-bold text-slate-800">{rootCat.name}</span>
                        </td>
                        <td className="p-4 text-center text-slate-600">{rootCat.sort_order}</td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openModal(rootCat)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="แก้ไข">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(rootCat.id, rootCat.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="ลบ">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Sub Categories (เยื้องขวาเข้าไปเล็กน้อย) */}
                      {getChildren(rootCat.id).map(childCat => (
                        <tr key={childCat.id} className="border-b border-gray-50 hover:bg-slate-50/50 transition bg-slate-50/30">
                          <td className="p-4 pl-12 flex items-center gap-2">
                            <div className="w-4 h-px bg-gray-300"></div>
                            <span className="font-medium text-slate-600">{childCat.name}</span>
                          </td>
                          <td className="p-4 text-center text-slate-600">{childCat.sort_order}</td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openModal(childCat)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="แก้ไข">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(childCat.id, childCat.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="ลบ">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
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
                <h3 className="text-lg font-bold text-slate-800">{isEditMode ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</h3>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหมวดหมู่</label>
                  <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="เช่น ผักสด, ผลไม้" />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">หมวดหมู่หลัก (ถ้ามี)</label>
                  <select 
                    title="เลือกหมวดหมู่หลัก"
                    value={formData.parent_id} 
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition bg-white"
                  >
                    <option value="">-- ตั้งเป็นหมวดหมู่หลัก --</option>
                    {rootCategories.filter(c => c.id !== currentCategoryId).map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">เลือกหากต้องการให้เป็นหมวดหมู่ย่อยของหมวดหมู่อื่น</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับการแสดงผล (Sort Order)</label>
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    title="ลำดับการแสดงผล"
                    placeholder="เช่น 10"
                    value={formData.sort_order} 
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition" />
                  <p className="text-xs text-gray-500 mt-1">เลขน้อยจะแสดงผลก่อน (แนะนำให้เว้นระยะเช่น 10, 20, 30)</p>
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
