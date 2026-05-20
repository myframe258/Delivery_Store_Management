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
  const [riders, setRiders] = useState<any[]>([]);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [activeBatches, setActiveBatches] = useState<any[]>([]);

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

      // 4. ดึงข้อมูลคนขับ (Rider) ประจำสาขานี้
      const { data: ridersData } = await supabase
        .from('users')
        .select('*')
        .eq('branch_id', branchId)
        .eq('role', 'rider');
      setRiders(ridersData || []);

      // 5. ดึงรอบจัดส่งปัจจุบันที่ยังไม่เสร็จ (Manage Batches)
      const { data: batchesData } = await supabase
        .from('delivery_batches')
        .select(`
          id,
          batch_status,
          created_at,
          driver_id,
          batch_items (id, order_id, delivery_status)
        `)
        .eq('branch_id', branchId)
        .neq('batch_status', 'completed')
        .order('created_at', { ascending: false });
      setActiveBatches(batchesData || []);
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
          batch_status: selectedRiderId ? 'assigned' : 'pending',
          driver_id: selectedRiderId || null
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
      setSelectedRiderId('');
      fetchData(); // รีเฟรชข้อมูลบนหน้าจอใหม่
    } catch (error: any) {
      console.error('Batching Error:', error);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  // ฟังก์ชันแก้ไขมอบหมายคนขับในรอบที่สร้างไปแล้ว
  const handleUpdateBatchDriver = async (batchId: string, driverId: string) => {
    try {
      const newStatus = driverId ? 'assigned' : 'pending';
      const { error } = await supabase
        .from('delivery_batches')
        .update({ driver_id: driverId || null, batch_status: newStatus })
        .eq('id', batchId);
      
      if (error) throw error;
      alert('อัปเดตคนขับสำเร็จ');
      fetchData();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  // ฟังก์ชันยกเลิกรอบจัดส่ง (คืนสถานะออเดอร์ทั้งหมด)
  const handleCancelBatch = async (batchId: string, orderIds: string[]) => {
    if (!confirm('ยืนยันการยกเลิกรอบจัดส่งนี้?\nออเดอร์ทั้งหมดจะถูกคืนกลับไปสถานะ "รอจัดรอบ"')) return;
    setLoading(true);
    try {
      // 1. คืนสถานะออเดอร์
      if (orderIds.length > 0) {
        const { error: orderErr } = await supabase.from('orders').update({ status: 'pending' }).in('id', orderIds);
        if (orderErr) throw orderErr;
      }
      // 2. ลบ batch_items
      const { error: itemsErr } = await supabase.from('batch_items').delete().eq('batch_id', batchId);
      if (itemsErr) throw itemsErr;
      // 3. ลบ delivery_batches
      const { error: batchErr } = await supabase.from('delivery_batches').delete().eq('id', batchId);
      if (batchErr) throw batchErr;

      alert('ยกเลิกรอบจัดส่งสำเร็จ ออเดอร์ถูกคืนสถานะแล้ว');
      fetchData();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการยกเลิกรอบส่ง: ' + err.message);
      setLoading(false);
    }
  };

  if (!mounted || loading) {
    return <div className="p-8 text-center text-gray-500 animate-pulse">กำลังโหลดข้อมูลแผนที่และออเดอร์...</div>;
  }
  
  if (!branch) {
    return <div className="p-8 text-center text-red-500">ไม่พบข้อมูลสาขา กรุณาตรวจสอบว่าบัญชีนี้ผูกกับสาขาแล้วหรือไม่</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 flex flex-col gap-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">จัดรอบส่ง (Batching)</h1>
          <p className="text-sm text-gray-500 mt-1">สาขา: {branch.name}</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 w-full md:w-auto">
          <button onClick={() => setActiveTab('create')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'create' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>สร้างรอบส่งใหม่</button>
          <button onClick={() => setActiveTab('manage')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'manage' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>จัดการรอบปัจจุบัน</button>
        </div>
      </div>
        
      {/* Tab: สร้างรอบส่ง (Create) */}
      {activeTab === 'create' && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* ฝั่งซ้าย: รายการออเดอร์และปุ่มดำเนินการ */}
          <div className="w-full md:w-1/3 flex flex-col gap-4">
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

            {/* ส่วนเลือกคนขับ (Rider) */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">มอบหมายคนขับ (Rider)</label>
              <select
                value={selectedRiderId}
                onChange={(e) => setSelectedRiderId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
              >
                <option value="">-- ยังไม่มอบหมาย (รอจัดสรรทีหลัง) --</option>
                {riders.map(rider => (
                  <option key={rider.id} value={rider.id}>
                    {rider.email || `Rider #${rider.id.slice(0, 8)}`}
                  </option>
                ))}
              </select>
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
              
              <Marker position={[branch.lat, branch.lng]}>
                <Popup className="font-sans">
                  <strong className="text-blue-600">{branch.name}</strong> <br /> (จุดเริ่มต้นและสิ้นสุด)
                </Popup>
              </Marker>

              {orders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                return (
                  <Marker
                    key={`marker-${order.id}`}
                    position={[order.lat, order.lng]}
                    eventHandlers={{ click: () => toggleOrderSelection(order.id) }}
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
      )}

      {/* Tab: จัดการรอบส่ง (Manage) */}
      {activeTab === 'manage' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-bold text-gray-800">จัดการรอบจัดส่งปัจจุบัน</h2>
            <p className="text-sm text-gray-500">ตรวจสอบ แก้ไขคนขับ หรือยกเลิกรอบส่งที่ยังไม่เสร็จสิ้น</p>
          </div>
          <div className="p-5">
            {activeBatches.length === 0 ? (
              <div className="text-center py-10 text-gray-400">ไม่มีรอบจัดส่งที่กำลังดำเนินการในขณะนี้</div>
            ) : (
              <div className="grid gap-4">
                {activeBatches.map(batch => (
                  <div key={batch.id} className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-gray-800">รอบบิล #{batch.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`px-3 py-1 text-xs rounded-full font-medium ${
                          batch.batch_status === 'pending' ? 'bg-orange-100 text-orange-700' : 
                          batch.batch_status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 
                          'bg-green-100 text-green-700'
                        }`}>
                          {batch.batch_status === 'pending' ? 'รอจัดสรรคนขับ' : batch.batch_status === 'in_progress' ? 'กำลังจัดส่ง' : 'จัดสรรคนขับแล้ว'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">สร้างเมื่อ: {new Date(batch.created_at).toLocaleString('th-TH')}</p>
                      <p className="text-sm text-gray-600 mt-1">จุดส่งทั้งหมด: <span className="font-semibold">{batch.batch_items?.length || 0}</span> ออเดอร์</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-500 mb-1 font-medium">มอบหมายคนขับ</label>
                        <select
                          value={batch.driver_id || ''}
                          onChange={(e) => handleUpdateBatchDriver(batch.id, e.target.value)}
                          disabled={batch.batch_status === 'in_progress'}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                        >
                          <option value="">-- ยังไม่มอบหมาย --</option>
                          {riders.map(r => (
                            <option key={r.id} value={r.id}>{r.email || `Rider #${r.id.slice(0, 6)}`}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        onClick={() => handleCancelBatch(batch.id, batch.batch_items?.map((i: any) => i.order_id) || [])}
                        disabled={batch.batch_status === 'in_progress'}
                        className="mt-0 sm:mt-5 px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ยกเลิกรอบนี้
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}