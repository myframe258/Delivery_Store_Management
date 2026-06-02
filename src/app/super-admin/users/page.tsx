'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Users, Edit2, Shield, Store, X, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';

type Branch = {
  id: string;
  name: string;
};

type UserRecord = {
  id: string;
  role: 'super_admin' | 'branch_admin' | 'rider' | 'customer';
  branch_id: string | null;
  email?: string; // ถ้ามีการเก็บ email ไว้ใน public.users
  branches: { name: string } | null;
};


export default function SuperAdminUsersPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<'employee' | 'customer' | 'all'>('employee');

  // Modal State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'customer',
    branch_id: '',
  });

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRole]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // ดึงข้อมูลผู้ใช้พร้อมชื่อสาขาที่สังกัด
      let query = supabase.from('users').select('*, branches(name)').order('role');
      
      if (filterRole === 'employee') {
        query = query.in('role', ['super_admin', 'branch_admin', 'rider']);
      } else if (filterRole === 'customer') {
        query = query.eq('role', 'customer');
      }

      const { data: usersData, error: usersError } = await query;

      if (usersError) throw usersError;

      // ดึงรายชื่อสาขาทั้งหมดสำหรับใช้ใน Dropdown
      const { data: branchesData, error: branchesError } = await supabase
        .from('branches')
        .select('id, name')
        .order('name');

      if (branchesError) throw branchesError;

      setUsers(usersData as UserRecord[]);
      setBranches(branchesData || []);
    } catch (error: any) {
      console.error('Error fetching data:', error.message);
      toast.error('ไม่สามารถดึงข้อมูลผู้ใช้งานได้');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (user: UserRecord) => {
    setEditingUser(user);
    setFormData({
      email: user.email || '',
      password: '',
      role: user.role || 'customer',
      branch_id: user.branch_id ? String(user.branch_id) : '',
    });
    setModalMode('edit');
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      role: 'customer',
      branch_id: '',
    });
    setModalMode('create');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingUser(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSaving(true);

    try {
      // ถ้าเป็น Super Admin หรือ Customer ไม่จำเป็นต้องมีสาขาสังกัด
      const isBranchRequired = formData.role === 'branch_admin' || formData.role === 'rider';
      const finalBranchId = isBranchRequired && formData.branch_id ? formData.branch_id : null;

      if (isBranchRequired && !finalBranchId) {
        toast.error('กรุณาระบุสาขาต้นสังกัดสำหรับ Branch Admin หรือ Rider');
        setIsSaving(false);
        return;
      }

      if (modalMode === 'create') {
        // เรียกใช้งาน API สร้างผู้ใช้ใหม่ (Bypass RLS ด้วย Service Role)
        const res = await fetch('/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            role: formData.role,
            branch_id: finalBranchId ? parseInt(finalBranchId, 10) : null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'ไม่สามารถสร้างผู้ใช้งานได้');
        toast.success('สร้างผู้ใช้งานใหม่สำเร็จ');

      } else if (modalMode === 'edit' && editingUser) {
        // อัปเดตข้อมูลผู้ใช้งานเดิม
        const { error } = await supabase
          .from('users')
          .update({
            role: formData.role,
            branch_id: finalBranchId ? parseInt(finalBranchId, 10) : null,
          })
          .eq('id', editingUser.id);
      
        if (error) throw error;
        toast.success('อัปเดตสิทธิ์ผู้ใช้งานสำเร็จ');
      }

      closeModal();
      fetchData(); // โหลดข้อมูลใหม่
    } catch (error: any) {
      console.error('Error updating user:', error.message);
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">Super Admin</span>;
      case 'branch_admin':
        return <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">Branch Admin</span>;
      case 'rider':
        return <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-semibold rounded-full">Rider</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">Customer</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-blue-600" />
            จัดการสิทธิ์ผู้ใช้งาน
          </h1>
          <p className="text-gray-500 mt-1">กำหนดสิทธิ์ (Role) และระบุสาขาต้นสังกัดให้พนักงาน (Super Admin)</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* ตัวกรอง (Filter) สำหรับกรองดูเฉพาะพนักงาน หรือลูกค้า */}
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 w-full md:w-auto">
            <button 
              onClick={() => setFilterRole('employee')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterRole === 'employee' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              พนักงาน (Staff)
            </button>
            <button 
              onClick={() => setFilterRole('customer')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterRole === 'customer' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              ลูกค้า
            </button>
            <button 
              onClick={() => setFilterRole('all')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${filterRole === 'all' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              ทั้งหมด
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium flex justify-center items-center gap-2 transition-all shadow-sm active:scale-95 whitespace-nowrap"
          >
            <UserPlus className="w-5 h-5" />
            เพิ่มผู้ใช้ใหม่
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-600">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">User ID / ข้อมูลผู้ใช้</th>
                <th className="px-6 py-4 text-center">ระดับสิทธิ์ (Role)</th>
                <th className="px-6 py-4">สาขาที่สังกัด</th>
                <th className="px-6 py-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500 animate-pulse">กำลังโหลดข้อมูลผู้ใช้งาน...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-500">ไม่พบข้อมูลผู้ใช้งาน</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-800">
                      {user.email || <span className="text-xs text-gray-400">{user.id}</span>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        {user.branch_id ? (
                          <><Store className="w-4 h-4 text-gray-400" /> {user.branches?.name || 'ไม่ทราบสาขา'}</>
                        ) : (
                          <span className="text-gray-400 text-xs">- ไม่มีสังกัด -</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => openEditModal(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไขสิทธิ์">
                        <Edit2 className="w-5 h-5 mx-auto" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Role Modal */}
      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {modalMode === 'create' ? <><UserPlus className="w-5 h-5 text-blue-600" /> เพิ่มผู้ใช้งานใหม่</> : <><Shield className="w-5 h-5 text-blue-600" /> แก้ไขสิทธิ์ผู้ใช้งาน</>}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200"
                title="ปิดหน้าต่าง"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 flex-grow flex flex-col gap-5">
              
              {modalMode === 'create' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">อีเมลผู้ใช้งาน <span className="text-red-500">*</span></label>
                    <input required type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="email@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน <span className="text-red-500">*</span></label>
                    <input required type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="รหัสผ่านขั้นต่ำ 6 ตัวอักษร" minLength={6} />
                  </div>
                </>
              )}
              {modalMode === 'edit' && editingUser?.email && (
                <div className="bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 text-sm text-gray-600">
                  กำลังแก้ไขสิทธิ์ของ: <span className="font-bold text-gray-800">{editingUser.email}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระดับสิทธิ์ (Role)</label>
                <select 
                  title="เลือกระดับสิทธิ์"
                  value={formData.role} 
                  onChange={(e) => setFormData({...formData, role: e.target.value})} 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="customer">Customer (ลูกค้า)</option>
                  <option value="rider">Rider (พนักงานขับรถ)</option>
                  <option value="branch_admin">Branch Admin (ผู้จัดการสาขา)</option>
                  <option value="super_admin">Super Admin (ผู้ดูแลระบบสูงสุด)</option>
                </select>
              </div>

              {(formData.role === 'branch_admin' || formData.role === 'rider') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">สาขาต้นสังกัด <span className="text-red-500">*</span></label>
                  <select 
                    title="เลือกสาขาต้นสังกัด"
                    required 
                    value={formData.branch_id} 
                    onChange={(e) => setFormData({...formData, branch_id: e.target.value})} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">-- กรุณาเลือกสาขา --</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={closeModal} disabled={isSaving} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors">ยกเลิก</button>
                <button type="submit" disabled={isSaving} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-sm">{isSaving ? 'กำลังบันทึก...' : 'บันทึกสิทธิ์'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}