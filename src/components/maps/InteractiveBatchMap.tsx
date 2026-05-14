'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

interface OrderLocation {
  id: string;
  lat: number;
  lng: number;
  customer_info?: any;
}

interface InteractiveBatchMapProps {
  orders: OrderLocation[];
  selectedIds: string[];
  onToggleOrder: (id: string) => void;
  center: [number, number];
}

export default function InteractiveBatchMap({ orders, selectedIds, onToggleOrder, center }: InteractiveBatchMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // สร้างไอคอนหมุดแบบ Custom (เปลี่ยนสีตามสถานะการเลือก)
  const createIcon = (isSelected: boolean) => L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="w-6 h-6 rounded-full border-2 border-white shadow-md ${isSelected ? 'bg-green-500 scale-110' : 'bg-blue-500'} transition-transform"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

  if (!mounted) return null;

  return (
    <MapContainer 
      center={center} 
      zoom={11} 
      style={{ height: '100%', width: '100%' }}
      className="z-0 relative rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {orders.map((order) => (
        <Marker 
          key={order.id} 
          position={[order.lat, order.lng]} 
          icon={createIcon(selectedIds.includes(order.id))}
          eventHandlers={{ click: () => onToggleOrder(order.id) }}
        />
      ))}
    </MapContainer>
  );
}