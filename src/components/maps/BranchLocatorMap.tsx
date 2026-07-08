'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import { useRouter } from 'next/navigation';
import { useBranchStore, type Branch } from '@/store/branchStore';

// แก้ปัญหา Next.js โหลดไอคอน Marker ของ Leaflet ไม่ขึ้น
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

interface MapProps {
  branches: Branch[];
}

export default function BranchLocatorMap({ branches }: MapProps) {
  const router = useRouter();
  const setActiveBranchId = useBranchStore((state) => state.setActiveBranchId);
  const [mounted, setMounted] = useState(false);
  
  // ป้องกันปัญหา appendChild โดยการรอให้ React นำ Component ไปแปะใน DOM ก่อน
  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto Center: กำหนดพิกัดเริ่มต้นไปที่สาขาแรก ถ้าไม่มีให้ใช้พิกัดกรุงเทพฯ
  const mapCenter: LatLngExpression = branches?.length > 0 && branches[0].lat && branches[0].lng
    ? [branches[0].lat, branches[0].lng]
    : [13.7563, 100.5018]; // Default to Bangkok

  const handleSelectBranch = (branchId: string) => {
    // 1. บันทึก ID ลง Zustand (localStorage)
    setActiveBranchId(branchId);
    
    // 2. เปลี่ยนหน้าไปที่ Storefront ของสาขานั้น (อิงจาก Route [branchId])
    router.push(`/${branchId}`);
  };

  // ถ้า Component ยังไม่ถูก Mount จะไม่คืนค่าอะไรออกไป (รอจน Client พร้อม 100%)
  if (!mounted) return null;

  return (
    <MapContainer 
      key={branches?.length || 0}
      center={mapCenter} 
      zoom={6} 
      style={{ height: '500px', width: '100%' }}
      className="z-0 relative rounded-xl overflow-hidden"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {branches?.map((branch) => {
        // The lat/lng are guaranteed to be numbers from page.tsx
        return (
          <Marker key={branch.id} position={[branch.lat, branch.lng]} icon={icon}>
            <Popup>
              <div className="text-center p-1 min-w-[150px]">
                <h3 className="font-bold text-base mb-1 text-slate-800">{branch.name}</h3>
                <button
                  onClick={() => handleSelectBranch(branch.id.toString())}
                  className="mt-3 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition w-full shadow-sm"
                >
                  เลือกสาขานี้
                </button>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}