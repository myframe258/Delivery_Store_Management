'use client';

import React, { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { FolderTree, Plus, Edit2, Trash2, X } from 'lucide-react';

type Category = {
  id: string;
  name: string;
  created_at: string;
  parent_id?: string | null;
  sort_order: number;
};

export default function SuperAdminCategoriesPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    parent_id: '' as string | null,
    sort_order: 1,
  });

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      console.error('Error fetching categories:', error.message);
      alert('ไม่สามารถดึงข้อมูลหมวดหมู่ได้');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (category?: Category) => {
    if (category) {
      setEditingId(category.id);
      setFormData({
        name: category.name || '',
        parent_id: category.parent_id || '',
        sort_order: category.sort_order || 1,
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', parent_id: '', sort_order: categories.length > 0 ? Math.max(...categories.map(c => c.sort_order || 0)) + 1 : 1 });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        parent_id: formData.parent_id || null,
        sort_order: formData.sort_order,
      };

      if (!payload.name) {
        throw new Error('กรุณากรอกชื่อหมวดหมู่');
      }

      if (editingId) {
        // Update Existing Category
        const { error } = await supabase
          .from('categories')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        alert('อัปเดตข้อมูลหมวดหมู่สำเร็จ');
      } else {
        // Insert New Category
        const { error } = await supabase
          .from('categories')
          .insert([payload]);
          
        if (error) {
          if (error.code === '23505') { // Unique violation
            throw new Error('มีชื่อหมวดหมู่นี้อยู่ในระบบแล้ว');
          }
          throw error;
        }
        
        alert('เพิ่มหมวดหมู่ใหม่สำเร็จ');
      }

      closeModal();
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error.message);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่ "${name}" ?\nสินค้าที่อยู่ในหมวดหมู่นี้จะถูกเปลี่ยนเป็น "ไม่ระบุหมวดหมู่" ทันที`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      alert('ลบหมวดหมู่สำเร็จ');
      setCategories(categories.filter(c => c.id !== id));
    } catch (error: any) {
      console.error('Error deleting category:', error.message);
      alert(`ไม่สามารถลบหมวดหมู่ได้`);
    }
  };

  // ฟังก์ชันแยกหมวดหมู่หลักและหมวดหมู่ย่อย
  const rootCategories = categories.filter(c => !c.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FolderTree className="w-8 h-8 text-blue-600" />
            จัดการหมวดหมู่สินค้า
          </h1>
          <p className="text-gray-500 mt-1">เพิ่ม แก้ไข หรือลบหมวดหมู่สินค้าในระบบ (Super Admin)</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 w-full md:w-auto"
        >
          <Plus className="w-5 h-5" />
          เพิ่มหมวดหมู่
        </button>
      </div>

      {/* Categories Table/Grid */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 w-20 text-center">ลำดับ</th>
                <th className="px-6 py-4">ชื่อหมวดหมู่</th>
                <th className="px-6 py-4 w-40 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-gray-500 animate-pulse">กำลังโหลดข้อมูล...</td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <FolderTree className="w-12 h-12 text-gray-300 mb-2" />
                      <p>ยังไม่มีข้อมูลหมวดหมู่ในระบบ</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rootCategories.map((category) => (
                  <React.Fragment key={category.id}>
                    <tr className="border-b border-gray-200 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-center font-medium text-gray-500">
                        {category.sort_order}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900 text-base">{category.name}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openModal(category)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(category.id, category.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {getChildren(category.id).map(child => (
                      <tr key={child.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors bg-gray-50/30">
                        <td className="px-6 py-4 text-center font-medium text-gray-400">
                          {child.sort_order}
                        </td>
                        <td className="px-6 py-4 pl-12">
                          <p className="font-medium text-gray-700 flex items-center gap-2">
                            <span className="text-gray-400">↳</span> {child.name}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => openModal(child)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(child.id, child.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
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

      {/* Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{editingId ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200" title="ปิดหน้าต่าง"><X className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อหมวดหมู่ <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="เช่น เครื่องดื่ม, ของแห้ง" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับการแสดงผล <span className="text-red-500">*</span></label>
                <input 
                  required 
                  type="number" 
                  min="1"
                  value={formData.sort_order} 
                  onChange={(e) => setFormData({...formData, sort_order: parseInt(e.target.value) || 1})} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="1, 2, 3..." 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">อยู่ภายใต้หมวดหมู่หลัก (ไม่บังคับ)</label>
                <select 
                  title="เลือกหมวดหมู่หลัก"
                  value={formData.parent_id || ''} 
                  onChange={(e) => setFormData({...formData, parent_id: e.target.value})} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                  <option value="">-- เป็นหมวดหมู่หลัก --</option>
                  {rootCategories
                    .filter(c => c.id !== editingId) // ไม่ให้เลือกตัวเองเป็นแม่
                    .map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)
                  }
                </select>
              </div>
              
              <div className="mt-4 flex justify-end gap-3 border-t border-gray-100 pt-4">
                <button type="button" onClick={closeModal} disabled={isSaving} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">ยกเลิก</button>
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
