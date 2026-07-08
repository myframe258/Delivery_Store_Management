'use client'; // บังคับให้เป็น Client Component

import dynamic from 'next/dynamic';
import type { Branch } from '@/store/branchStore';

// โหลด BranchLocatorMap แบบ ssr: false
const MapComponent = dynamic(
    () => import('./BranchLocatorMap'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[500px] bg-slate-100 flex items-center justify-center rounded-xl animate-pulse border-2 border-dashed border-slate-200">
                <p className="text-slate-500 font-medium">กำลังเตรียมแผนที่...</p>
            </div>
        )
    }
);

export default function BranchMapWrapper({ branches }: { branches: Branch[] }) {
    return (
        <div className="w-full h-[500px] rounded-xl overflow-hidden shadow-inner relative z-0">
            <MapComponent branches={branches} />
        </div>
    );
}