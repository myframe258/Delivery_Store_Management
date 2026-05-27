'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useBranchStore } from '@/store/branchStore';

export default function BranchGuard() {
  const router = useRouter();
  const { activeBranchId } = useBranchStore();

  useEffect(() => {
    // ถ้าตรวจพบว่าไม่มี BranchId ใน Local Storage (ไม่มีการเลือกสาขามาก่อน)
    // ให้ Redirect กลับไปหน้าแรกเสมอ เพื่อบังคับ Flow ให้ถูกต้อง
    if (!activeBranchId) {
      router.push('/');
    }
  }, [activeBranchId, router]);

  // Component นี้ใช้เพื่อตรวจสอบ Logic เบื้องหลังเท่านั้น ไม่มีการแสดงผล UI
  return null; 
}