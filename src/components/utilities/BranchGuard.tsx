'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBranchStore } from '@/store/branchStore';
import { createBrowserClient } from '@supabase/ssr';

export default function BranchGuard() {
  const router = useRouter();
  const params = useParams();
  const branchId = params?.branchId;

  // รองรับการดึง State ตามชื่อฟังก์ชันใน Zustand ของคุณ
  const activeBranchId = useBranchStore((state: any) => state.activeBranchId || state.branchId);
  const setActiveBranchId = useBranchStore((state: any) => state.setActiveBranchId || state.setBranchId);
  const setActiveBranch = useBranchStore((state: any) => state.setActiveBranch || state.setBranch);

  const [isVerifying, setIsVerifying] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const verifyBranch = async () => {
      // ถ้าไม่มี branchId ใน URL ให้ผ่านได้เลย (ปล่อยให้หน้าจัดการตัวเอง)
      if (!branchId) {
        setIsVerifying(false);
        return;
      }

      // แปลงข้อมูลเป็น String ก่อนเทียบกัน เพื่อป้องกันบั๊ก 1 !== "1"
      const urlBranchId = String(branchId);
      const storeBranchId = activeBranchId ? String(activeBranchId) : null;

      // 1. ถ้า Store ตรงกับ URL อยู่แล้ว แปลว่าลูกค้าเข้าตาม Flow ปกติ ให้ผ่านได้เลย
      if (storeBranchId === urlBranchId) {
        setIsVerifying(false);
        return;
      }

      // 2. ถ้า Store ไม่ตรง หรือว่างเปล่า (เช่น รีเฟรชหน้าเว็บ หรือเข้าผ่านการพิมพ์ URL ตรงๆ)
      try {
        const { data, error } = await supabase
          .from('branches')
          .select('*')
          .eq('id', urlBranchId)
          .single();

        if (data && !error) {
          // ดึงข้อมูลเจอสาขานี้จริง! ให้อัปเดต Store แล้วอนุญาตให้ผ่าน
          if (setActiveBranchId) setActiveBranchId(data.id);
          if (setActiveBranch) setActiveBranch(data);
          setIsVerifying(false);
        } else {
          // ค้นหาสาขาไม่เจอ ให้ดีดกลับหน้าแรก
          console.warn('BranchGuard: ไม่พบสาขาที่ระบุ กำลังนำกลับไปหน้าแรก...');
          router.push('/');
        }
      } catch (err) {
        console.error('BranchGuard Error:', err);
        router.push('/');
      }
    };

    verifyBranch();
  }, [branchId, activeBranchId, router, supabase, setActiveBranchId, setActiveBranch]);

  // ระหว่างรอเช็คข้อมูล แสดงหน้าจอ Loading ทับไว้ก่อน ป้องกัน UI กระพริบแล้วเด้งกลับ
  if (isVerifying) {
    return (
      <div className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-sm flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-blue-600 font-medium animate-pulse">กำลังตรวจสอบข้อมูลสาขา...</p>
        </div>
      </div>
    );
  }

  // ถ้าตรวจสอบผ่าน ให้คืนค่า null (ซ่อนตัวเอง และปล่อยให้หน้าเว็บทำงานต่อ)
  return null;
}
