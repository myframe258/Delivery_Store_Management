'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

// แก้ปัญหาไอคอนหมุดของ Leaflet ไม่แสดงผลบน Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// คอมโพเนนต์ช่วยเลื่อนแผนที่ (Pan) ไปยังตำแหน่งใหม่เวลา State เปลี่ยน
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14, { animate: true, duration: 1.5 });
  }, [center, map]);
  return null;
}

interface CheckoutMapProps {
  initialPosition: [number, number];
  onLocationChange: (lat: number, lng: number) => void;
  branchLocation?: [number, number]; // พิกัดสาขา (ทางเลือก)
  serviceRadius?: number; // รัศมีให้บริการ กม. (ทางเลือก)
}

export default function CheckoutMap({ initialPosition, onLocationChange, branchLocation, serviceRadius }: CheckoutMapProps) {
  const [position, setPosition] = useState<L.LatLngExpression>(initialPosition);
  const markerRef = useRef<L.Marker>(null);

  // ซิงค์ตำแหน่งหมุดเมื่อ initialPosition เปลี่ยน (เช่น กดปุ่มตำแหน่งปัจจุบัน)
  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition[0], initialPosition[1]]);

  // ดักจับ Event เมื่อลูกค้าลากหมุด (DragEnd) ให้บันทึกพิกัดใหม่
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker != null) {
          const newPos = marker.getLatLng();
          setPosition(newPos);
          onLocationChange(newPos.lat, newPos.lng);
        }
      },
    }),
    [onLocationChange]
  );

  return (
    <MapContainer
      center={initialPosition}
      zoom={14}
      style={{ height: '350px', width: '100%' }}
      className="rounded-xl border border-gray-200 z-0 relative"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* เรียกใช้ MapUpdater เพื่อให้แผนที่เลื่อนตามพิกัดใหม่ */}
      <MapUpdater center={initialPosition} />
      
      <Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={markerRef} icon={icon}>
        <Popup minWidth={90}>เลื่อนหมุดเพื่อระบุที่อยู่จัดส่ง</Popup>
      </Marker>

      {/* วาดวงกลมรัศมีให้บริการ หากมีการส่งข้อมูลสาขาเข้ามา */}
      {branchLocation && serviceRadius && (
        <Circle
          center={branchLocation}
          radius={serviceRadius * 1000} // แปลงกิโลเมตรเป็นเมตร
          pathOptions={{ fillColor: '#3b82f6', color: '#2563eb', fillOpacity: 0.1, weight: 2 }}
        />
      )}
    </MapContainer>
  );
}