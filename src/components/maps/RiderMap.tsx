'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface OrderMarker {
  id: string;
  lat: number;
  lng: number;
  sequence_no: number;
  isDelivered: boolean;
  customerName: string;
}

interface RiderMapProps {
  orders: OrderMarker[];
}

export default function RiderMap({ orders }: RiderMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // สร้างไอคอนที่มีตัวเลขลำดับอยู่ตรงกลาง เปลี่ยนเป็นสีเขียวเมื่อส่งสำเร็จ
  const createSequenceIcon = (sequence: number, isDelivered: boolean) => L.divIcon({
    className: 'custom-sequence-icon',
    html: `<div class="w-8 h-8 rounded-full shadow-md flex items-center justify-center font-bold text-white border-2 border-white transition-colors ${isDelivered ? 'bg-green-500' : 'bg-blue-600'}">${sequence}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });

  if (!mounted || orders.length === 0) return null;

  // หาจุดกึ่งกลางจากออเดอร์แรก
  const center: [number, number] = [orders[0].lat, orders[0].lng];

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} className="z-0 relative">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {orders.map((order) => (
        <Marker key={order.id} position={[order.lat, order.lng]} icon={createSequenceIcon(order.sequence_no, order.isDelivered)}>
          <Popup>
            <div className="font-medium text-sm">จุดที่ {order.sequence_no}: {order.customerName}</div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}