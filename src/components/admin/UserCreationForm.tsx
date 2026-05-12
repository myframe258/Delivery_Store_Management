'use client';

import { useState } from 'react';

interface Branch {
  id: number;
  name: string;
}

interface UserCreationFormProps {
  branches: Branch[];
}

export default function UserCreationForm({ branches }: UserCreationFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('branch_admin');
  const [branchId, setBranchId] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        role,
        branch_id: Number(branchId),
      }),
    });

    const result = await response.json();
    setIsLoading(false);

    if (response.ok) {
      setMessage({ type: 'success', text: `สร้างบัญชี ${email} สำเร็จ!` });
      // เคลียร์ฟอร์ม
      setEmail('');
      setPassword('');
      setRole('branch_admin');
      setBranchId('');
    } else {
      setMessage({ type: 'error', text: `เกิดข้อผิดพลาด: ${result.error}` });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">อีเมล</label>
        <div className="mt-1">
          <input id="email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
        </div>
      </div>

      {/* Password */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
        <div className="mt-1">
          <input id="password" name="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
        </div>
      </div>

      {/* Role */}
      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">ตำแหน่ง (Role)</label>
        <select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
          <option value="branch_admin">ผู้จัดการสาขา (Branch Admin)</option>
          <option value="rider">คนขับ (Rider)</option>
        </select>
      </div>

      {/* Branch */}
      <div>
        <label htmlFor="branch" className="block text-sm font-medium text-gray-700">สาขา (Branch)</label>
        <select id="branch" name="branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} required
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
          <option value="" disabled>-- เลือกสาขา --</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} (ID: {branch.id})
            </option>
          ))}
        </select>
      </div>

      {/* Submit Button */}
      <div>
        <button type="submit" disabled={isLoading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 transition-colors">
          {isLoading ? 'กำลังสร้าง...' : 'สร้างบัญชี'}
        </button>
      </div>

      {/* Message Area */}
      {message && (
        <div className={`p-4 rounded-md text-sm ${ message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800' }`}>
          {message.text}
        </div>
      )}
    </form>
  );
}
