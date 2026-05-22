'use client';

import { useRouter } from 'next/navigation';
import { useBranchStore } from '@/store/branchStore';
import { Store, ArrowRight } from 'lucide-react';

interface Branch {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  address: string;
}

export default function BranchList({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  
  // ดึงฟังก์ชันสำหรับเซ็ตค่าสาขาจาก Zustand (รองรับชื่อฟังก์ชันทั่วไปที่มักใช้)
  const setActiveBranchId = useBranchStore((state: any) => state.setActiveBranchId || state.setBranch);

  const handleSelectBranch = (branchId: string | number) => {
    // 1. อัปเดต State ให้ระบบรู้ว่าลูกค้าเลือกสาขาไหน
    if (setActiveBranchId) {
      setActiveBranchId(branchId.toString());
    } else {
      // Fallback กรณีหาฟังก์ชัน Setter ไม่เจอ ให้เซ็ตผ่าน setState โดยตรง
      useBranchStore.setState({ activeBranchId: branchId.toString() });
    }
    
    // 2. นำทางไปยังหน้าร้านค้าของสาขานั้น
    router.push(`/${branchId}`);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {branches?.map((branch) => (
        <div 
          key={branch.id} 
          onClick={() => handleSelectBranch(branch.id)}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-300 cursor-pointer group flex flex-col justify-between h-full relative overflow-hidden"
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <Store className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{branch.name}</h3>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2 mb-6">{branch.address || 'ไม่มีข้อมูลที่อยู่'}</p>
          </div>
          
          {/* ปุ่ม "เข้าสู่หน้าร้านค้า" */}
          <button className="w-full flex items-center justify-center gap-2 bg-slate-50 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-700 py-3 rounded-xl text-sm font-semibold transition-colors border border-slate-100 group-hover:border-blue-100 mt-auto">
            เข้าสู่หน้าร้านค้า
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      ))}
    </div>
  );
}