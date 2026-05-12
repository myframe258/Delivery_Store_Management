'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBranchStore } from '../../store/branchStore';

// ไอคอนสำหรับสาขา (สีน้ำเงิน)
const storeIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// ไอคอนสำหรับตำแหน่งลูกค้า (สีแดง)
const userIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

// Component สำหรับให้ React-Leaflet เลื่อนแผนที่ไปที่ Center ใหม่ได้
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function BranchLocatorMap({ branches }: { branches: any[] }) {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([13.7563, 100.5018]);
  const [mapZoom, setMapZoom] = useState(10);
  
  const router = useRouter();
  const setActiveBranch = useBranchStore((state) => state.setActiveBranch);

  // เมื่อลูกค้ากดเลือกร้าน
  const handleSelectBranch = (branch: any) => {
    setActiveBranch(branch);
    router.push(`/${branch.id}`); // นำทางไปหน้า Storefront ของสาขานั้น
  };

  // ฟังก์ชันขอพิกัดผู้ใช้และหาสาขาที่ใกล้ที่สุด
  const findNearestBranch = () => {
    if (!navigator.geolocation) {
      alert("เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง");
      return;
    }

    navigator.geolocation.getCurrentPosition((position) => {
      const { latitude, longitude } = position.coords;
      setUserLocation([latitude, longitude]);
        
      if (!branches || branches.length === 0) {
        setMapCenter([latitude, longitude]);
        setMapZoom(13);
        return;
      }

      // คำนวณระยะทางที่ใกล้ที่สุด (สูตรพีทาโกรัสอย่างง่ายสำหรับ Lat/Lng)
      let nearest = branches[0];
      let minDistance = Infinity;

      branches.forEach(branch => {
        if (branch.lat && branch.lng) {
          const dist = Math.sqrt(Math.pow(branch.lat - latitude, 2) + Math.pow(branch.lng - longitude, 2));
          if (dist < minDistance) {
            minDistance = dist;
            nearest = branch;
          }
        }
      });

      // เลื่อนกล้องไปที่สาขาที่ใกล้ที่สุด
      setMapCenter([nearest.lat, nearest.lng]);
      setMapZoom(13);
    }, (error) => {
      alert("ไม่สามารถดึงตำแหน่งของคุณได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง");
    });
  };

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* ปุ่มค้นหาตำแหน่ง */}
      <div className="absolute top-4 right-4 z-[400]">
        <button onClick={findNearestBranch} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-md font-medium transition">
          📍 ค้นหาสาขาใกล้ฉัน
        </button>
      </div>

      <MapContainer center={mapCenter} zoom={mapZoom} className="flex-1 w-full z-0">
        <ChangeView center={mapCenter} zoom={mapZoom} />
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        
        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Popup><div className="font-bold text-center">📍 ตำแหน่งของคุณ</div></Popup>
          </Marker>
        )}

        {branches?.map((branch) => (
          <Marker key={branch.id} position={[branch.lat, branch.lng]} icon={storeIcon}>
            <Popup>
              <div className="p-1 min-w-[200px]">
                <h3 className="font-bold text-lg text-slate-800">{branch.name}</h3>
                <p className="text-sm text-gray-600 my-2">{branch.address}</p>
                {branch.phone && <p className="text-sm text-gray-500 mb-3">📞 {branch.phone}</p>}
                <button onClick={() => handleSelectBranch(branch)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-md font-medium transition-colors">
                  เลือกร้านนี้
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}