'use client';

import { useState, useEffect, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { MapPin, Navigation, CheckCircle, Package, RefreshCw, Phone, List, ChevronDown, ChevronUp } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import toast from 'react-hot-toast';

const RiderMap = dynamic(() => import('@/components/maps/RiderMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">กำลังโหลดแผนที่...</div>
});

export default function RiderBatchClient({ initialBatches }: { initialBatches: any[] }) {
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [batches, setBatches] = useState(initialBatches);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(initialBatches[0]?.id || null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; batchItemId: string; orderId: string }>({ isOpen: false, batchItemId: '', orderId: '' });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // อัปเดต State อัตโนมัติเมื่อมีการโหลดข้อมูลใหม่จาก Server
  useEffect(() => {
    setBatches(initialBatches);
    setActiveBatchId(prevId => {
      // ถ้ารอบบิลปัจจุบันถูกลบไปแล้ว หรือยังไม่ได้เลือก ให้สลับไปเลือกรอบแรกสุด
      if (!prevId || !initialBatches.find(b => b.id === prevId)) {
        return initialBatches[0]?.id || null;
      }
      return prevId;
    });
  }, [initialBatches]);

  const activeBatch = batches.find((b) => b.id === activeBatchId);

  // ฟังก์ชันโหลดข้อมูลงานใหม่
  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  // ฟังก์ชันอัปเดตสถานะการจัดส่ง
  const handleMarkDeliveredClick = (batchItemId: string, orderId: string) => {
    setConfirmModal({ isOpen: true, batchItemId, orderId });
  };

  const executeMarkDelivered = async () => {
    const { batchItemId, orderId } = confirmModal;
    setConfirmModal({ isOpen: false, batchItemId: '', orderId: '' });
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

      // 3. ตรวจสอบว่าเป็นการส่งชิ้นสุดท้ายเพื่อปิดรอบบิล (Completed) หรือไม่
      const currentBatch = batches.find(b => b.id === activeBatchId);
      let alertMessage = 'อัปเดตสถานะสำเร็จ!';
      
      if (currentBatch) {
        const isLastItem = currentBatch.batch_items.every((item: any) => 
          item.id === batchItemId || item.delivery_status === 'delivered'
        );

        if (isLastItem) {
          await supabase.from('delivery_batches').update({ batch_status: 'completed' }).eq('id', activeBatchId);
          alertMessage = 'ส่งสินค้าครบทุกจุดแล้ว ปิดรอบการจัดส่งนี้อัตโนมัติ!';
        } else if (currentBatch.batch_status !== 'in_progress') {
          // เปลี่ยนสถานะรอบส่งเป็น in_progress เมื่อเริ่มส่งจุดแรก
          await supabase.from('delivery_batches').update({ batch_status: 'in_progress' }).eq('id', activeBatchId);
        }
      }

      // 4. อัปเดต State บนหน้าจอ
      setBatches((prev) => {
        const updatedBatches = prev.map((batch) => {
          if (batch.id === activeBatchId) {
            const updatedItems = batch.batch_items.map((item: any) => 
              item.id === batchItemId ? { ...item, delivery_status: 'delivered', orders: { ...item.orders, status: 'delivered' } } : item
            );
            const isLastItem = updatedItems.every((item: any) => item.delivery_status === 'delivered');
            return { ...batch, batch_status: isLastItem ? 'completed' : 'in_progress', batch_items: updatedItems };
          }
          return batch;
        }).filter(batch => batch.batch_status !== 'completed'); // เอารอบที่เสร็จแล้วออกจากหน้าจอ

        // ถ้ารอบนี้ส่งเสร็จจนหายไปจากหน้าจอ ให้เลือกคิวถัดไปอัตโนมัติ
        if (updatedBatches.every(b => b.id !== activeBatchId)) {
          setTimeout(() => setActiveBatchId(updatedBatches[0]?.id || null), 0);
        }
        return updatedBatches;
      });

      toast.success(alertMessage);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  // ฟังก์ชันเปิด Google Maps
  const openGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  // ฟังก์ชันเปิด/ปิดดูรายการสินค้า
  const toggleOrderDetails = (orderId: string) => {
    if (!orderId) return;
    setExpandedOrders(prev => prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]);
  };

  // ฟังก์ชันสร้างป้ายกำกับสำหรับ Rider
  const getRiderPaymentBadge = (method: string, status: string) => {
    if (method === 'cod') {
      return <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] rounded-full font-bold border border-orange-200">เก็บเงินปลายทาง</span>;
    }
    if (method === 'promptpay' && status === 'paid') {
      return <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full font-bold border border-green-200">โอนเงินแล้ว</span>;
    }
    return null;
  };

  if (batches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-64px)] text-gray-500 px-4 text-center">
        <Package className="w-16 h-16 mb-4 text-gray-300" />
        <p className="text-lg font-medium mb-6">คุณไม่มีรอบจัดส่งที่ได้รับมอบหมายในขณะนี้</p>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'กำลังโหลดข้อมูล...' : 'รีเฟรชอัปเดตงานใหม่'}
        </button>
      </div>
    );
  }

  // เตรียมข้อมูล Marker สำหรับแผนที่
  const mapOrders = activeBatch?.batch_items.map((item: any) => ({
    id: item.orders?.id || item.id,
    lat: item.orders?.lat || 0,
    lng: item.orders?.lng || 0,
    sequence_no: item.sequence_no,
    isDelivered: item.delivery_status === 'delivered',
    customerName: item.orders?.customer_info?.name || 'ลูกค้า',
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
        <div className="p-4 bg-white border-b border-gray-200 flex gap-3 items-end shadow-sm z-10">
          <div className="flex-1">
            <label htmlFor="batch-select" className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">เลือกรอบการจัดส่ง</label>
            <select
              id="batch-select"
              value={activeBatchId || ''} 
              onChange={(e) => setActiveBatchId(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none cursor-pointer"
            >
              {batches.map((batch, index) => (
                <option key={batch.id} value={batch.id}>
                  รอบที่ {index + 1} ({batch.batch_items.length} จุดส่ง)
                </option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="รีเฟรชข้อมูล"
            className="p-2.5 h-[42px] border border-gray-200 bg-white text-gray-600 rounded-lg hover:bg-gray-50 transition shadow-sm flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {/* รายการออเดอร์ในรอบบิล (เรียงตามลำดับ sequence_no) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeBatch?.batch_items.sort((a: any, b: any) => a.sequence_no - b.sequence_no).map((item: any) => {
            const isDelivered = item.delivery_status === 'delivered';
            const isExpanded = expandedOrders.includes(item.orders?.id);
            
            return (
              <div key={item.id} className={`p-4 rounded-xl border ${isDelivered ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${isDelivered ? 'bg-green-500' : 'bg-blue-600'}`}>
                      {item.sequence_no}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-slate-800 text-sm line-clamp-1 pr-2">{item.orders?.customer_info?.name || 'ไม่ระบุชื่อ'}</h3>
                        {item.orders?.customer_info?.phone && (
                          <a href={`tel:${item.orders.customer_info.phone}`} className="text-green-600 p-1.5 hover:bg-green-100 bg-green-50 rounded-full transition-colors shrink-0" title="โทรหาลูกค้า">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
              {getRiderPaymentBadge(item.orders?.payment_method, item.orders?.payment_status)}
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.orders?.customer_info?.address || 'ไม่ระบุที่อยู่'}</p>
              {item.orders?.payment_method !== 'cod' && (
                <p className="text-xs font-medium text-blue-600 mt-1">ยอดสุทธิ: ฿{item.orders?.total_price?.toLocaleString() || 0}</p>
              )}
                    </div>
                  </div>
                </div>

        {/* ไฮไลท์พิเศษ: กล่องแจ้งเตือนเก็บเงินใหญ่ๆ (แสดงเฉพาะ COD) */}
        {item.orders?.payment_method === 'cod' && !isDelivered && (
          <div className="mt-2 mb-3 p-3 bg-orange-50 border-2 border-dashed border-orange-300 rounded-xl flex justify-between items-center">
            <div className="flex items-center gap-2 text-orange-800 font-bold">
              <span className="text-xl">💰</span>
              <span className="text-sm">ยอดเก็บลูกค้า:</span>
            </div>
            <span className="text-lg font-black text-orange-600">฿{item.orders?.total_price?.toLocaleString() || 0}</span>
          </div>
        )}

                {/* ส่วนแสดงรายละเอียดสินค้า (Toggle) */}
                <div className="mt-3">
                  <button 
                    onClick={() => toggleOrderDetails(item.orders?.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 transition-colors py-1"
                  >
                    <List className="w-3.5 h-3.5" /> ดูรายการสินค้า {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  
                  {isExpanded && item.orders?.order_items && (
                    <div className="mt-2 pt-2 border-t border-dashed border-gray-200/60 bg-slate-50/50 rounded-lg p-2.5">
                      <ul className="space-y-1.5">
                        {item.orders.order_items.map((orderItem: any, idx: number) => {
                          // จัดการตัวเลขให้สวยงาม (ตัดทศนิยมถ้าเป็นจำนวนเต็ม)
                          const qty = Number(orderItem.quantity);
                          const displayQty = Number.isInteger(qty) ? qty : qty.toFixed(2).replace(/\.?0+$/, '');
                          const unit = Array.isArray(orderItem.products?.product_units) ? orderItem.products.product_units[0] : orderItem.products?.product_units;
                          const unitName = unit?.name || '';
                          
                          return (
                            <li key={idx} className="text-xs text-slate-700 flex justify-between items-start gap-2">
                              <span className="line-clamp-2">- {orderItem.products?.name || 'ไม่ระบุชื่อสินค้า'}</span>
                              <span className="font-semibold shrink-0 text-blue-700">x{displayQty} {unitName}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <button onClick={() => openGoogleMaps(item.orders?.lat || 0, item.orders?.lng || 0)} className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 text-blue-600 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition">
                    <Navigation className="w-4 h-4" /> นำทาง
                  </button>
                  
                  <button disabled={isDelivered || isUpdating} onClick={() => item.orders?.id && handleMarkDeliveredClick(item.id, item.orders.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${isDelivered ? 'bg-green-500 text-white cursor-not-allowed' : 'bg-slate-800 text-white hover:bg-slate-700'}`}>
                    {isDelivered ? <><CheckCircle className="w-4 h-4" /> ส่งสำเร็จ</> : 'ยืนยันการส่ง'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal ยืนยันการส่งสำเร็จ */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="ยืนยันการส่งมอบ"
        message="คุณได้ส่งมอบสินค้าและเก็บเงิน (ถ้ามี) เรียบร้อยแล้วใช่หรือไม่?"
        onConfirm={executeMarkDelivered}
        onCancel={() => setConfirmModal({ isOpen: false, batchItemId: '', orderId: '' })}
      />
    </div>
  );
}
