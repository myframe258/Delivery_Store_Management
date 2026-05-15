'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export default function Breadcrumbs() {
  const pathname = usePathname();
  const pathNames = pathname.split('/').filter((path) => path);

  // ดิกชันนารีสำหรับแปลชื่อ Path ภาษาอังกฤษเป็นภาษาไทยให้ดูสวยงาม
  const labelMap: Record<string, string> = {
    'branch-admin': 'ผู้จัดการสาขา',
    'inventory': 'จัดการสต็อกสินค้า',
    'batching': 'จัดรอบการส่ง',
    'super-admin': 'ผู้ดูแลระบบ',
    'branches': 'จัดการสาขา',
    'rider': 'คนขับรถ',
    'batches': 'คิวงานจัดส่ง',
  };

  return (
    <nav className="flex text-gray-500 text-sm font-medium mb-6 bg-white py-3 px-5 rounded-xl shadow-sm border border-gray-100 w-fit">
      <ol className="inline-flex items-center space-x-1 md:space-x-2">
        <li className="inline-flex items-center">
          <Link href="/dashboard" className="flex items-center hover:text-blue-600 transition">
            <Home className="w-4 h-4 mr-2" />
            หน้าหลัก
          </Link>
        </li>
        
        {pathNames.map((value, index) => {
          const href = `/${pathNames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathNames.length - 1;
          const label = labelMap[value] || value;

          return (
            <li key={index} className="flex items-center">
              <ChevronRight className="w-4 h-4 mx-1 text-gray-400" />
              {isLast ? <span className="text-slate-800 font-semibold">{label}</span> : <Link href={href} className="hover:text-blue-600 transition">{label}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}