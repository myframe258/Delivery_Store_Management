'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { createBrowserClient } from '@supabase/ssr';
import { MapPin, Navigation, CheckCircle, Package } from 'lucide-react';

const RiderMap = dynamic(() => import('@/components/maps/RiderMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">กำลังโหลดแผนที่...</div>
});

export default function RiderBatchClient({ initialBatches }: { initialBatches: any[] }) {
  const [batches, setBatches] = useState(initialBatches);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(initialBatches[0]?.id || null);
  const [isUpdating, setIsUpdating] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const activeBatch = batches.find((b) => b.id === activeBatchId);

  // ฟังก์ชันอัปเดตสถานะการจัดส่ง
  const handleMarkDelivered = async (batchItemId: string, orderId: string) => {
    if (!confirm('ยืนยันการส่งมอบสินค้าสำเร็จ?')) return;
    setIsUpdating(true);

    try {
      // 1. อัปเดตตาราง orders
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', orderId);
      if (orderError) throw orderError;

      // 2. อัปเดตตาราง batch_items
      const { error: batchItemError } = await supabase
        .from('batch_items')
        .update({ delivery_status: 'delivered' })
        .eq('id', batchItemId);
      if (batchItemError) throw batchItemError;

      // 3. อัปเดต State บนหน้าจอโดยไม่ต้องรีเฟรช
      setBatches((prev) => prev.map((batch) => {
        if (batch.id === activeBatchId) {
          return {
            ...batch,
            batch_items: batch.batch_items.map((item: any) => 
              item.id === batchItemId ? { ...item, delivery_status: 'delivered', orders: { ...item.orders, status: 'delivered' } } : item
            )
          };
        }
        return batch;
      }));

      alert('อัปเดตสถานะสำเร็จ!');
    } catch (error: any) {
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // ฟังก์ชันเปิด Google Maps
  const openGoogleMaps = (lat: number, lng: number) => {
    const url = `<https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}>`;
    window.open(url, '_blank');
  };

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
        <Package className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium">คุณไม่มีรอบจัดส่งที่ได้รับมอบหมายในขณะนี้</p>
      </div>
    );
  }

  // เตรียมข้อมูล Marker สำหรับแผนที่
  const mapOrders = activeBatch?.batch_items.map((item: any) => ({
    id: item.orders.id,
    lat: item.orders.lat,
    lng: item.orders.lng,
    sequence_no: item.sequence_no,
    isDelivered: item.delivery_status === 'delivered',
    customerName: item.orders.customer_info?.name || 'ลูกค้า',
  })) || [];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px-56px)] md:h-[calc(100vh-64px)] overflow-hidden">
      
      {/* แผนที่ (ครึ่งบนในมือถือ / ฝั่งซ้ายใน Desktop) */}
      <div className="h-[40vh] md:h-full md:w-1/2 lg:w-3/5 bg-gray-200 relative">
        <RiderMap orders={mapOrders} />
      </div>

      {/* รายการจัดส่ง (ครึ่งล่างในมือถือ / ฝั่งขวาใน Desktop) */}
      <div className="flex-1 md:w-1/2 lg:w-2/5 bg-gray-50 flex flex-col overflow-hidden border-t md:border-t-0 md:border-l border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:shadow-none z-10">
        
        {/* ตัวเลือกรอบบิล */}
        <div className="p-4 bg-white border-b border-gray-200">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">เลือกรอบการจัดส่ง</label>
          <select 
            value={activeBatchId || ''} 
            onChange={(e) => setActiveBatchId(e.target.value)}
            className="w-full bg-slate-50 border border-gray-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none"
          >
            {batches.map((batch, index) => (
              <option key={batch.id} value={batch.id}>
                รอบที่ {index + 1} ({batch.batch_items.length} จุดส่ง)
              </option>
            ))}
          </select>
        </div>

        {/* รายการออเดอร์ในรอบบิล (เรียงตามลำดับ sequence_no) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeBatch?.batch_items.sort((a: any, b: any) => a.sequence_no - b.sequence_no).map((item: any) => {
            const isDelivered = item.delivery_status === 'delivered';
            
            return (
              <div key={item.id} className={`p-4 rounded-xl border ${isDelivered ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${isDelivered ? 'bg-green-500' : 'bg-blue-600'}`}>
                      {item.sequence_no}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm line-clamp-1">{item.orders.customer_info?.name}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.orders.customer_info?.address}</p>
                      <p className="text-xs font-medium text-blue-600 mt-1">เก็บเงิน: ฿{item.orders.total_price?.toLocaleString() || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => openGoogleMaps(item.orders.lat, item.orders.lng)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition">
                    <Navigation className="w-4 h-4" /> นำทาง
                  </button>
                  
                  <button disabled={isDelivered || isUpdating} onClick={() => handleMarkDelivered(item.id, item.orders.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${isDelivered ? 'bg-green-500 text-white cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                    {isDelivered ? <><CheckCircle className="w-4 h-4" /> ส่งสำเร็จ</> : 'ยืนยันการส่ง'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
