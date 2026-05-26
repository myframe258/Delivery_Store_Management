'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Package, Truck, CheckCircle, Clock, MapPin, ChevronRight, User, Calendar } from 'lucide-react';
import Link from 'next/link';

type OrderItem = {
    quantity: number;
    price_at_purchase: number;
    products: {
        name: string;
        image_url: string;
    };
};

type Order = {
    id: string;
    created_at: string;
    status: 'pending' | 'batched' | 'ready_for_pickup' | 'delivered';
    total_price: number;
    delivery_date?: string;
    delivery_slot?: string;
    delivery_method?: 'delivery' | 'pickup';
    branches: { name: string };
    order_items: OrderItem[];
};

type DeliverySlot = {
    id: string;
    name: string;
    time_range: string;
};

export default function CustomerOrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [slots, setSlots] = useState<DeliverySlot[]>([]);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        checkUserAndFetchOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkUserAndFetchOrders = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // ถ้ายังไม่ได้ล็อกอิน ให้พาไปหน้า Login แล้วกลับมาหน้านี้
                router.push('/login?returnTo=/customer/orders');
                return;
            }

            setUser(session.user);

            // ดึงข้อมูลรอบจัดส่งเพื่อนำมา map แสดงชื่อ
            const { data: slotsData } = await supabase.from('delivery_slots').select('id, name, time_range');
            if (slotsData) setSlots(slotsData);

            // ดึงออเดอร์ของลูกค้าคนนี้เท่านั้น (RLS จะช่วยกรองอีกชั้น)
            const { data, error } = await supabase
                .from('orders')
                .select(`
          id, 
          created_at, 
          status, 
          total_price,
          delivery_date,
          delivery_slot,
          delivery_method,
          branches (name),
          order_items (
            quantity, 
            price_at_purchase,
            products (name, image_url)
          )
        `)
                .eq('customer_id', session.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            setOrders(data as unknown as Order[]);
        } catch (error: any) {
            console.error('Error fetching orders:', error.message);
        } finally {
            setLoading(false);
        }
    };

    // ฟังก์ชันช่วยแสดง UI สถานะ
    const getStatusDisplay = (status: string, method?: string) => {
        switch (status) {
            case 'pending':
                return (
                    <div className="flex items-center gap-1.5 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Clock className="w-4 h-4" /> {method === 'pickup' ? 'รอจัดของลงถุง' : 'รอดำเนินการ'}
                    </div>
                );
            case 'batched':
                return (
                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Truck className="w-4 h-4" /> กำลังจัดส่ง
                    </div>
                );
            case 'ready_for_pickup':
                return (
                    <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full text-sm font-semibold animate-pulse">
                        <Package className="w-4 h-4" /> รอรับที่ร้าน
                    </div>
                );
            case 'delivered':
                return (
                    <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full text-sm font-semibold">
                        <CheckCircle className="w-4 h-4" /> {method === 'pickup' ? 'รับสินค้าสำเร็จ' : 'จัดส่งสำเร็จ'}
                    </div>
                );
            default:
                return (
                    <div className="flex items-center gap-1.5 text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Package className="w-4 h-4" /> ไม่ทราบสถานะ
                    </div>
                );
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">กำลังโหลดข้อมูลคำสั่งซื้อ...</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 py-10 px-4 md:px-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Package className="w-8 h-8 text-blue-600" />
                        การสั่งซื้อของฉัน
                    </h1>
          <div className="flex gap-3 items-center">
            <Link href="/profile" className="text-gray-700 hover:text-blue-600 font-medium text-sm flex items-center gap-1 bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm transition-colors">
              <User className="w-4 h-4" /> <span className="hidden sm:inline">จัดการโปรไฟล์</span>
            </Link>
            <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center">
              สั่งซื้อเพิ่ม <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
                </div>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
                        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-gray-700 mb-2">ยังไม่มีประวัติการสั่งซื้อ</h2>
                        <p className="text-gray-500 mb-6">คุณยังไม่เคยทำการสั่งซื้อสินค้ากับเรา</p>
                        <Link href="/" className="inline-block bg-blue-600 text-white font-medium px-6 py-3 rounded-xl hover:bg-blue-700 transition shadow-sm">
                            เริ่มเลือกซื้อสินค้าเลย
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {orders.map((order) => (
                            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">หมายเลขคำสั่งซื้อ</p>
                                        <p className="font-bold text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                                        <p className="text-xs text-gray-400 mt-1">สั่งเมื่อ: {new Date(order.created_at).toLocaleString('th-TH')}</p>
                                        
                                        {/* แสดงวันและรอบจัดส่ง */}
                                        {order.delivery_date && (
                                            <div className="flex flex-wrap items-center gap-1.5 mt-3">
                                                <span className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                                                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                                    {order.delivery_method === 'pickup' ? 'นัดรับ:' : 'จัดส่ง:'} {new Date(order.delivery_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                                </span>
                                                {order.delivery_slot && slots.length > 0 && (
                                                    <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md shadow-sm">
                                                        {slots.find(s => s.id === order.delivery_slot)?.name || 'ไม่ระบุรอบ'} 
                                                        {slots.find(s => s.id === order.delivery_slot)?.time_range && ` (${slots.find(s => s.id === order.delivery_slot)?.time_range})`}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:items-end gap-2">
                                        {getStatusDisplay(order.status, order.delivery_method)}
                                        <div className="flex items-center gap-1 text-sm font-medium text-gray-600">
                                            <MapPin className="w-4 h-4 text-gray-400" /> {order.delivery_method === 'pickup' ? 'รับที่สาขา:' : 'จัดส่งจาก:'} {order.branches?.name || 'ไม่ทราบสาขา'}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="space-y-4">
                                        {order.order_items.map((item, index) => (
                                            <div key={index} className="flex items-start gap-4">
                                                <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                                                    {item.products?.image_url ? (
                                                        <img src={item.products.image_url} alt={item.products.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Package className="w-8 h-8 text-gray-300" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-800 line-clamp-1">{item.products?.name || 'สินค้าไม่มีชื่อ'}</h4>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-sm text-gray-500">จำนวน: {item.quantity} ชิ้น</span>
                                                        <span className="font-medium text-gray-900">฿{(item.price_at_purchase * item.quantity).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
                                        <span className="text-gray-600 font-medium">ยอดรวมทั้งสิ้น</span>
                                        <span className="text-xl font-bold text-blue-600">฿{order.total_price.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
