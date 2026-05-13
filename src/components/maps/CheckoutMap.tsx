'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

interface CheckoutMapProps {
  initialPosition: [number, number];
  onLocationChange: (lat: number, lng: number) => void;
}

export default function CheckoutMap({ initialPosition, onLocationChange }: CheckoutMapProps) {
  const [position, setPosition] = useState<L.LatLngExpression>(initialPosition);
  const markerRef = useRef<L.Marker>(null);

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
      <Marker draggable={true} eventHandlers={eventHandlers} position={position} ref={markerRef} icon={icon}>
        <Popup minWidth={90}>เลื่อนหมุดเพื่อระบุที่อยู่จัดส่ง</Popup>
      </Marker>
    </MapContainer>
  );
}