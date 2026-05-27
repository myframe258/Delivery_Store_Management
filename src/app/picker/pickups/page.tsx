'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Store, CheckCircle, Clock, User, Phone, Package, Search, Printer, PackageOpen } from 'lucide-react';

export default function BranchPickupsPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [branch, setBranch] = useState<any>(null);
  const [printOrder, setPrintOrder] = useState<any>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    fetchPickupOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ล้างค่าออเดอร์ที่สั่งพิมพ์เมื่อ Dialog ปิดลง
  useEffect(() => {
    const afterPrint = () => setPrintOrder(null);
    window.addEventListener('afterprint', afterPrint);
    return () => window.removeEventListener('afterprint', afterPrint);
  }, []);

  const fetchPickupOrders = async () => {
    setLoading(true);
    try {
      // 1. ตรวจสอบข้อมูลสาขาของพนักงาน
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userProfile } = await supabase
        .from('users')
        .select('branch_id')
        .eq('id', session.user.id)
        .single();

      if (!userProfile?.branch_id) return;
      
      const { data: branchData } = await supabase
        .from('branches')
        .select('name')
        .eq('id', userProfile.branch_id)
        .single();
        
      setBranch(branchData);

      // 2. ดึงข้อมูลออเดอร์รูปแบบ "รับที่ร้าน" ที่ยังไม่สำเร็จ
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_price,
          status,
          created_at,
          delivery_date,
          delivery_method,
          customer_info,
          order_items (
            quantity,
            price_at_purchase,
            products ( name )
          )
        `)
        .eq('branch_id', userProfile.branch_id)
        .eq('delivery_method', 'pickup')
        .neq('status', 'delivered') // ไม่แสดงออเดอร์ที่รับไปแล้ว
        .order('delivery_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setOrders(ordersData || []);
    } catch (error) {
      console.error('Error fetching pickup orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันสำหรับเปลี่ยนสถานะออเดอร์ (2-Step)
  const handleUpdateStatus = async (orderId: string, currentStatus: string) => {
    let nextStatus = '';
    let confirmMessage = '';
    let successMessage = '';

    if (currentStatus === 'pending') {
      nextStatus = 'ready_for_pickup';
      confirmMessage = 'ยืนยันว่าจัดเตรียมสินค้าลงถุงเสร็จสิ้นแล้วใช่หรือไม่?';
      successMessage = 'อัปเดตสถานะเป็น "รอรับสินค้า" เรียบร้อยแล้ว!';
    } else if (currentStatus === 'ready_for_pickup') {
      nextStatus = 'delivered';
      confirmMessage = 'ยืนยันว่าลูกค้ามารับสินค้าเรียบร้อยแล้วใช่หรือไม่?';
      successMessage = 'อัปเดตสถานะออเดอร์เป็น "สำเร็จ" เรียบร้อยแล้ว!';
    } else {
      return; // กันเหนียวกรณีสถานะแปลกปลอม
    }

    if (!window.confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId);

      if (error) throw error;

      alert(successMessage);
      // รีเฟรชรายการ
      fetchPickupOrders();
    } catch (error: any) {
      console.error('Error updating order:', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + error.message);
    }
  };

  // ฟังก์ชันตั้งค่าออเดอร์ที่ต้องการพิมพ์และเรียกคำสั่งพิมพ์
  const handlePrint = (order: any) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 100); // ดีเลย์เล็กน้อยให้ React เรนเดอร์ UI สลิปเสร็จก่อน
  };

  // ค้นหาออเดอร์จากรหัส หรือ ชื่อลูกค้า
  const filteredOrders = orders.filter(order => {
    const matchId = order.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchName = order.customer_info?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchPhone = order.customer_info?.phone?.includes(searchQuery);
    return matchId || matchName || matchPhone;
  });

  return (
    <>
    {/* ส่วน UI หลัก (ซ่อนเมื่อสั่งพิมพ์) */}
    <div className="max-w-7xl mx-auto p-4 md:p-8 print:hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
            <Store className="w-8 h-8 text-emerald-600" />
            จัดการออเดอร์ "รับที่ร้าน"
          </h1>
          <p className="text-gray-500 mt-1">
            {branch ? `สาขา: ${branch.name}` : 'กำลังโหลด...'} | ออเดอร์ที่รอลูกค้ามารับด้วยตนเอง
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="ค้นหารหัส, ชื่อ, หรือเบอร์โทร..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition"
          />
        </div>
      </div>

      {/* Order List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 animate-pulse">กำลังโหลดข้อมูล...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <CheckCircle className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700">ไม่มีออเดอร์ค้างรับ</h2>
          <p className="text-gray-500 mt-2">ขณะนี้ไม่มีลูกค้ารอเข้ามารับสินค้าที่สาขา</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOrders.map(order => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 flex flex-col hover:border-emerald-300 transition-colors">
              
              {/* Order Header */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-800">#{order.id.slice(0, 8).toUpperCase()}</h3>
                    <button 
                      onClick={() => handlePrint(order)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                      title="พิมพ์ใบออเดอร์ (80mm)"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-sm font-medium text-emerald-600 flex items-center gap-1 mt-1">
                    <Clock className="w-4 h-4" /> นัดรับ: {order.delivery_date || 'ไม่ระบุวันที่'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold text-blue-600">฿{order.total_price.toLocaleString()}</div>
                  {order.status === 'pending' ? (
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2.5 py-1 rounded-md mt-1 font-medium">รอจัดของลงถุง</span>
                  ) : (
                    <span className="inline-block bg-orange-100 text-orange-700 text-xs px-2.5 py-1 rounded-md mt-1 font-medium animate-pulse">รอรับที่ร้าน</span>
                  )}
                </div>
              </div>

              {/* Customer Info & Item List */}
              <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2 text-sm text-slate-700 flex-grow">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                  <User className="w-4 h-4 text-slate-400" /> <span className="font-semibold">{order.customer_info?.name || 'ลูกค้าทั่วไป'}</span>
                  <span className="text-gray-300">|</span>
                  <Phone className="w-4 h-4 text-slate-400" /> <span>{order.customer_info?.phone || 'ไม่ระบุเบอร์โทร'}</span>
                </div>
                <div className="font-semibold flex items-center gap-1.5 mb-2"><Package className="w-4 h-4 text-slate-500" /> รายการสินค้า ({order.order_items?.reduce((sum: number, i: any) => sum + i.quantity, 0)} ชิ้น)</div>
                <ul className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {order.order_items?.map((item: any, idx: number) => (
                    <li key={idx} className="flex justify-between items-start text-xs sm:text-sm bg-white p-2.5 rounded-lg border border-gray-100 shadow-sm">
                      <span className="font-medium text-slate-700 pr-2">{item.products?.name}</span>
                      <span className="font-bold text-blue-600 whitespace-nowrap bg-blue-50 px-2 py-0.5 rounded-md">x {item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons (2-Step) */}
              {order.status === 'pending' ? (
                <button 
                  onClick={() => handleUpdateStatus(order.id, order.status)}
                  className="mt-auto w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                >
                  <PackageOpen className="w-5 h-5" /> จัดของลงถุงเสร็จสิ้น
                </button>
              ) : (
                <button 
                  onClick={() => handleUpdateStatus(order.id, order.status)}
                  className="mt-auto w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
                >
                  <CheckCircle className="w-5 h-5" /> ยืนยันลูกค้ามารับแล้ว
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    {/* ส่วนของใบเสร็จ (แสดงเฉพาะตอนสั่งพิมพ์ / รองรับ Thermal Printer 80mm) */}
    {printOrder && (
      <div className="hidden print:block w-[80mm] mx-auto p-2 text-black bg-white font-sans text-sm">
        <div className="text-center border-b-2 border-black pb-2 mb-2 mt-4">
          <h2 className="text-2xl font-bold uppercase tracking-wider">Store Pickup</h2>
          <p className="text-base font-semibold mt-1">สาขา: {branch?.name}</p>
        </div>
        
        <div className="mb-4 text-xs space-y-1">
          <p><strong>Order No:</strong> #{printOrder.id.slice(0, 8).toUpperCase()}</p>
          <p><strong>Pickup Date:</strong> {printOrder.delivery_date}</p>
          <p><strong>Customer:</strong> {printOrder.customer_info?.name}</p>
          <p><strong>Tel:</strong> {printOrder.customer_info?.phone}</p>
        </div>

        <div className="border-t border-black pt-2">
          <p className="font-bold mb-2">รายการสินค้า:</p>
          <ul className="space-y-3 text-xs">
            {printOrder.order_items?.map((item: any, idx: number) => (
              <li key={idx} className="flex items-start gap-2 leading-tight">
                <span className="shrink-0 text-lg leading-none">[&nbsp;&nbsp;]</span>
                <span className="flex-grow font-medium">{item.products?.name}</span>
                <span className="shrink-0 font-bold text-base">x{item.quantity}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t-2 border-dashed border-black mt-4 pt-3 text-center">
          <p className="font-bold text-lg">รวมยอดสุทธิ: ฿{printOrder.total_price.toLocaleString()}</p>
          <p className="mt-3 text-xs italic font-medium">* โปรดให้พนักงานติ๊กตรวจสอบความถูกต้องก่อนส่งมอบ *</p>
        </div>
      </div>
    )}
    </>
  );
}
