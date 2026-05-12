'use client';

import dynamic from 'next/dynamic';

const BranchLocatorMap = dynamic(() => import('./BranchLocatorMap'), {
  ssr: false,
  loading: () => <div className="h-full w-full flex items-center justify-center bg-gray-100 text-gray-500">กำลังโหลดแผนที่...</div>
});

export default function DynamicBranchLocatorMap({ branches }: { branches: any[] }) {
  return <BranchLocatorMap branches={branches} />;
}