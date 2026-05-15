'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

// โหลด Map แบบปิด SSR
const InteractiveBatchMap = dynamic(
  () => import('@/components/maps/InteractiveBatchMap'),
  { ssr: false, loading: () => <div className="w-full h-full bg-slate-100 animate-pulse rounded-xl" /> }
);

interface Order {
  id: string;
  lat: number;
  lng: number;
  total_price: number;
  customer_info: any;
}

interface BatchingClientProps {
  orders: Order[];
  branchId: number;
  branchLocation: { lat: number; lng: number };
}

export default function BatchingClient({ orders, branchId, branchLocation }: BatchingClientProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const toggleOrder = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((orderId) => orderId !== id) : [...prev, id]
    );
  };

  const handleCreateBatch = async () => {
    if (selectedIds.length === 0) return;
    setIsSubmitting(true);

    try {
      // 1. สร้างรอบส่ง (Delivery Batch)
      const { data: batchData, error: batchError } = await supabase
        .from('delivery_batches')
        .insert({
          branch_id: branchId,
          batch_status: 'pending' // รอมอบหมายคนขับ
        })
        .select('id')
        .single();

      if (batchError || !batchData) throw new Error(batchError?.message);

      // 2. บันทึกออเดอร์ที่ถูกเลือกลงใน Batch (batch_items)
      const batchItems = selectedIds.map((orderId, index) => ({
        batch_id: batchData.id,
        order_id: orderId,
        sequence_no: index + 1, // จะถูก Optimize ทีหลังโดย API
        delivery_status: 'pending'
      }));

      const { error: itemsError } = await supabase.from('batch_items').insert(batchItems);
      if (itemsError) throw new Error(itemsError.message);

      // 3. อัปเดตสถานะออเดอร์เป็น 'batched' จะได้ไม่แสดงในหน้านี้ซ้ำ
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'batched' })
        .in('id', selectedIds);

      if (updateError) throw new Error(updateError.message);

      // 4. เรียกใช้ API เพื่อคำนวณและจัดลำดับเส้นทาง (Route Optimization)
      try {
        const optimizeRes = await fetch('/api/optimize-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ batch_id: batchData.id })
        });
        const optimizeData = await optimizeRes.json();
        if (!optimizeRes.ok) throw new Error(optimizeData.error || 'คำนวณเส้นทางล้มเหลว');
      } catch (optError: any) {
        console.error('Optimization warning:', optError);
        alert('สร้างรอบจัดส่งสำเร็จแล้ว แต่มีปัญหาในการคำนวณเส้นทางอัตโนมัติ: ' + optError.message);
      }

      alert('สร้างรอบการจัดส่งและจัดเรียงเส้นทางสำเร็จ!');
      setSelectedIds([]); // เคลียร์รายการที่เลือก
      router.refresh();   // ดึงข้อมูลใหม่จาก Server

    } catch (error: any) {
      console.error('Error creating batch:', error);
      alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] min-h-[600px]">
      
      {/* ฝั่งซ้าย: แผนที่แบบ Interactive */}
      <div className="w-full lg:w-2/3 bg-white rounded-2xl shadow-sm border border-gray-200 p-2 relative h-[400px] lg:h-full">
        <InteractiveBatchMap 
          orders={orders} 
          selectedIds={selectedIds} 
          onToggleOrder={toggleOrder}
          center={[branchLocation.lat, branchLocation.lng]}
        />
      </div>

      {/* ฝั่งขวา: รายการออเดอร์ที่เลือก */}
      <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">จัดการรอบจัดส่ง</h2>
          <p className="text-sm text-gray-500">เลือกออเดอร์จากแผนที่หรือรายการด้านล่าง</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {orders.length === 0 && <p className="text-center text-gray-400 mt-10">ไม่มีออเดอร์รอจัดส่ง</p>}
          {orders.map((order) => {
            const isSelected = selectedIds.includes(order.id);
            return (
              <div 
                key={order.id} 
                onClick={() => toggleOrder(order.id)}
                className={`p-4 border rounded-xl cursor-pointer transition-all ${isSelected ? 'border-green-500 bg-green-50 shadow-sm' : 'border-gray-200 hover:border-blue-400'}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-gray-800 text-sm">
                    ผู้รับ: {order.customer_info?.name || 'ไม่ระบุชื่อ'}
                  </span>
                  <span className={`w-4 h-4 rounded-full border-2 ${isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}></span>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1">{order.customer_info?.address}</p>
                <p className="text-sm font-medium text-blue-600 mt-2">฿{(order.total_price || 0).toLocaleString()}</p>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-100 bg-white">
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-600">เลือกแล้ว</span>
            <span className="font-bold text-lg text-slate-800">{selectedIds.length} รายการ</span>
          </div>
          <button onClick={handleCreateBatch} disabled={selectedIds.length === 0 || isSubmitting} className="w-full bg-slate-800 text-white py-3 rounded-xl font-medium hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {isSubmitting ? 'กำลังสร้างรอบ...' : 'สร้างรอบจัดส่ง (Create Batch)'}
          </button>
        </div>
      </div>
    </div>
  );
}