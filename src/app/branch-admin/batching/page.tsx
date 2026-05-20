'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import dynamic from 'next/dynamic';

// โหลด Leaflet แบบ Dynamic เพื่อป้องกันปัญหา window is not defined (SSR)
const MapContainer = dynamic(() => import('react-leaflet').then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((m) => m.Popup), { ssr: false });

export default function BatchingPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [mounted, setMounted] = useState(false);
  const [branch, setBranch] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. ดึงข้อมูล User และ branch_id ของแอดมินสาขานี้
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }

      const { data: userProfile } = await supabase
        .from('users')
        .select('branch_id')
        .eq('id', session.user.id)
        .single();

      if (!userProfile?.branch_id) return;
      const branchId = userProfile.branch_id;

      // 2. ดึงข้อมูลพิกัดของสาขา
      const { data: branchData } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .single();
      
      setBranch(branchData);

      // 3. ดึงออเดอร์ทั้งหมดของสาขานี้ ที่ยังไม่ได้จัดรอบ (pending)
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('branch_id', branchId)
        .eq('status', 'pending');

      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleOptimizeAndCreateBatch = async () => {
    if (selectedOrderIds.length === 0) {
      alert('กรุณาเลือกออเดอร์อย่างน้อย 1 รายการเพื่อสร้างรอบส่ง');
      return;
    }

    setOptimizing(true);
    try {
      const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
      
      // 1. ส่งข้อมูลไปให้ API จัดเรียงเส้นทางที่สั้นที่สุด
      const res = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchLocation: { lat: branch.lat, lng: branch.lng },
          orders: selectedOrders,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถคำนวณเส้นทางได้');
      }

      const { optimizedOrders } = data;

      // 2. สร้างรอบจัดส่ง (Delivery Batch) ใหม่
      const { data: batchData, error: batchError } = await supabase
        .from('delivery_batches')
        .insert({
          branch_id: branch.id,
          batch_status: 'pending',
          // driver_id: null // เว้นไว้ก่อน ให้แอดมินมา Assign ให้ Rider ทีหลังได้
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // 3. นำออเดอร์ที่ถูกจัดเรียงแล้ว (มี sequence_no) บันทึกลง batch_items
      const batchItems = optimizedOrders.map((order: any) => ({
        batch_id: batchData.id,
        order_id: order.id,
        sequence_no: order.sequence_no,
        delivery_status: 'pending'
      }));

      const { error: itemsError } = await supabase
        .from('batch_items')
        .insert(batchItems);

      if (itemsError) throw itemsError;

      // 4. อัปเดตสถานะออเดอร์เป็น 'batched' เพื่อไม่ให้แสดงซ้ำในการจัดรอบครั้งต่อไป
      const { error: updateOrdersError } = await supabase
        .from('orders')
        .update({ status: 'batched' })
        .in('id', selectedOrderIds);

      if (updateOrdersError) throw updateOrdersError;

      alert('จัดรอบการส่งเรียบร้อยแล้ว เส้นทางถูกปรับให้สั้นที่สุด!');
      setSelectedOrderIds([]);
      fetchData(); // รีเฟรชข้อมูลบนหน้าจอใหม่
    } catch (error: any) {
      console.error('Batching Error:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  if (!mounted || loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูลแผนที่และออเดอร์...</div>;
  }
  
  if (!branch) {
    return <div className="p-8 text-center text-red-500">ไม่พบข้อมูลสาขา กรุณาตรวจสอบว่าบัญชีนี้ผูกกับสาขาแล้วหรือไม่</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col md:flex-row gap-6">
      {/* ฝั่งซ้าย: รายการออเดอร์และปุ่มดำเนินการ */}
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดรอบส่ง (Batching)</h1>
          <p className="text-sm text-gray-500 mt-1">สาขา: {branch.name}</p>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1 overflow-y-auto max-h-[500px]">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">ออเดอร์รอส่ง ({orders.length})</h2>
          {orders.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">ขณะนี้ไม่มีออเดอร์รอจัดส่ง</p>
          ) : (
            <ul className="space-y-3">
              {orders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <li
                    key={order.id}
                    className={`p-3 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                    onClick={() => toggleOrderSelection(order.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-semibold text-gray-800">ออเดอร์ #{order.id.slice(0, 6).toUpperCase()}</span>
                        <p className="text-sm text-gray-500 mt-1">ยอดรวม: ฿{order.total_price.toLocaleString()}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          onClick={handleOptimizeAndCreateBatch}
          disabled={optimizing || selectedOrderIds.length === 0}
          className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-semibold disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
        >
          {optimizing ? 'กำลังคำนวณเส้นทาง...' : `สร้างรอบส่ง (${selectedOrderIds.length} จุดส่ง)`}
        </button>
      </div>

      {/* ฝั่งขวา: แผนที่ Interactive */}
      <div className="w-full md:w-2/3 h-[500px] md:h-[calc(100vh-140px)] rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-gray-100">
        <MapContainer
          key={`map-${branch.lat}-${branch.lng}`}
          center={[branch.lat, branch.lng]}
          zoom={12}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* หมุดสาขา (จุดเริ่มต้น) */}
          <Marker position={[branch.lat, branch.lng]}>
            <Popup className="font-sans">
              <strong className="text-blue-600">{branch.name}</strong> <br /> (จุดเริ่มต้นและสิ้นสุด)
            </Popup>
          </Marker>

          {/* หมุดออเดอร์ */}
          {orders.map((order) => {
            const isSelected = selectedOrderIds.includes(order.id);
            return (
              <Marker
                key={`marker-${order.id}`}
                position={[order.lat, order.lng]}
                eventHandlers={{
                  click: () => toggleOrderSelection(order.id),
                }}
              >
                <Popup className="font-sans">
                  <strong>ออเดอร์ #{order.id.slice(0, 6).toUpperCase()}</strong>
                  <br />
                  <span className={isSelected ? 'text-green-600 font-semibold' : 'text-gray-500'}>
                    {isSelected ? '✓ เลือกเข้ากลุ่มแล้ว' : 'คลิกเพื่อเลือก'}
                  </span>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}