'use client';

import dynamic from 'next/dynamic';

// โหลด Component แผนที่แบบไม่ทำ SSR (Server-Side Rendering)
// เพื่อป้องกัน Error: "window is not defined" จากการเรียกใช้ Leaflet ฝั่ง Server
const DynamicBranchLocatorMap = dynamic(
  () => import('./BranchLocatorMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[500px] bg-slate-50 flex items-center justify-center rounded-xl animate-pulse">
        <p className="text-slate-500 font-medium text-lg">กำลังโหลดแผนที่...</p>
      </div>
    ),
  }
);

export default DynamicBranchLocatorMap;