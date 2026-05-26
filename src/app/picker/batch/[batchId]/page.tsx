'use client';

import { useEffect, useState, useMemo } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckSquare, Package, ShoppingBag, ListTodo, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

// --- Types ---
type Product = { id: string; name: string; image_url: string; product_units?: { name: string } | any };
type OrderItem = { id: string; quantity: number; products: Product };
type Order = { id: string; order_code: string; customer_info: { name: string }; order_items: OrderItem[] };
type BatchItem = { id: string; orders: Order };
type DeliveryBatch = { id: string; batch_status: string; batch_items: BatchItem[] };

// Aggregated Type for Pick List
type PickListItem = {
    id: string; // เปลี่ยนมาใช้ Custom ID เพื่อรองรับการแยกทศนิยม
    productId: string;
    name: string;
    image_url: string;
    totalQuantity: number;
    unit_name: string;
    isDecimal: boolean;
    bagCount: number;
};

export default function PickerBatchDetailPage() {
    const { batchId } = useParams();
    const router = useRouter();
    const [batch, setBatch] = useState<DeliveryBatch | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Navigation Tabs: 'pick' (หยิบรวม) | 'pack' (แยกกล่อง)
    const [activeTab, setActiveTab] = useState<'pick' | 'pack'>('pick');

    // Checklist States
    const [pickedProducts, setPickedProducts] = useState<Record<string, boolean>>({}); // key: productId
    const [packedOrderItems, setPackedOrderItems] = useState<Record<string, boolean>>({}); // key: orderItemId

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        if (batchId) fetchBatchDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [batchId]);

    const fetchBatchDetails = async () => {
        try {
            // เปลี่ยนสถานะรอบนี้เป็น 'preparing' อัตโนมัติเมื่อกดเข้ามาดู
            await supabase.from('delivery_batches').update({ batch_status: 'preparing' }).eq('id', batchId).in('batch_status', ['pending', 'assigned']);

            const { data, error } = await supabase
                .from('delivery_batches')
                .select(`
                    id,
                    batch_status,
                    batch_items (
                        id,
                        orders (
                            id, order_code, customer_info,
                            order_items (
                                id, quantity,
                                products ( id, name, image_url,
                                    product_units (name)
                                )
                            )
                        )
                    )
                `)
                .eq('id', batchId)
                .single();

            if (error) throw error;
            setBatch(data as unknown as DeliveryBatch);
        } catch (error) {
            console.error('Error fetching batch detail:', error);
            alert('ไม่สามารถดึงข้อมูลรอบจัดส่งได้');
        } finally {
            setLoading(false);
        }
    };

    // --- Data Processing ---
    // 1. รวมรายการสินค้าทั้งหมดเพื่อทำ Pick List (เดินหยิบทีเดียว)
    const pickList = useMemo(() => {
        if (!batch) return [];
        const itemMap = new Map<string, PickListItem>();

        batch.batch_items.forEach(bi => {
            bi.orders?.order_items?.forEach(oi => {
                const pId = oi.products.id;
                const qty = Number(oi.quantity);
                const unit = Array.isArray(oi.products.product_units) ? oi.products.product_units[0] : oi.products.product_units;
                const unitName = unit?.name || '';
                
                // ตรวจสอบว่าเป็นทศนิยมหรือไม่
                const isDecimal = !Number.isInteger(qty);
                
                // ถ้าเป็นทศนิยม ให้แยก Key ตามน้ำหนัก (เช่น id_0.5) แต่ถ้าเป็นชิ้นเต็ม ให้ใช้ productId ปกติ
                const mapKey = isDecimal ? `${pId}_${qty}` : pId;

                if (itemMap.has(mapKey)) {
                    const existing = itemMap.get(mapKey)!;
                    if (isDecimal) {
                        existing.bagCount += 1; // นับเพิ่มจำนวน "ถุง"
                    } else {
                        existing.totalQuantity += qty; // บวกจำนวน "ชิ้น" ตามปกติ
                    }
                } else {
                    itemMap.set(mapKey, {
                        id: mapKey,
                        productId: pId,
                        name: oi.products.name,
                        image_url: oi.products.image_url,
                        totalQuantity: qty,
                        unit_name: unitName,
                        isDecimal: isDecimal,
                        bagCount: 1
                    });
                }
            });
        });
        return Array.from(itemMap.values());
    }, [batch]);

    // --- Actions ---
    const togglePick = (itemId: string) => {
        setPickedProducts(prev => ({ ...prev, [itemId]: !prev[itemId] }));
    };

    const togglePack = (orderItemId: string) => {
        setPackedOrderItems(prev => ({ ...prev, [orderItemId]: !prev[orderItemId] }));
    };

    // เช็คว่าเช็คถูกครบทุกกล่องหรือยัง
    const isAllPacked = useMemo(() => {
        if (!batch) return false;
        const totalItems = batch.batch_items.reduce((acc, bi) => acc + (bi.orders?.order_items?.length || 0), 0);
        const packedCount = Object.values(packedOrderItems).filter(Boolean).length;
        return totalItems > 0 && packedCount === totalItems;
    }, [batch, packedOrderItems]);

    // ยืนยันการจัดของเสร็จสิ้น (Server Action)
    const handleCompleteBatch = async () => {
        if (!isAllPacked) {
            alert('กรุณาแพ็กสินค้าและติ๊กถูกให้ครบทุกออเดอร์');
            return;
        }
        if (!confirm('ยืนยันว่าแพ็กสินค้าใส่กล่องครบทุกออเดอร์แล้ว?')) return;
        setIsSubmitting(true);

        try {
            // 1. อัปเดตสถานะ Delivery Batch -> ready_for_pickup
            await supabase.from('delivery_batches').update({ batch_status: 'ready_for_pickup' }).eq('id', batchId);

            // 2. อัปเดตสถานะ Orders ทั้งหมดใน Batch นี้ -> ready_for_pickup
            const orderIds = batch?.batch_items.map(bi => bi.orders.id) || [];
            if (orderIds.length > 0) {
                await supabase.from('orders').update({ status: 'ready_for_pickup' }).in('id', orderIds);
            }

            alert('จัดเตรียมสินค้าเรียบร้อย! ส่งต่อให้ไรเดอร์ได้เลย');
            router.push('/picker/dashboard');
        } catch (error) {
            console.error('Error completing batch:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">กำลังจัดเตรียมรายการ...</div>;
    if (!batch) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">ไม่พบข้อมูล</div>;

    return (
        <div className="min-h-screen bg-gray-50 pt-14 pb-24 md:pt-16 md:pb-0 relative">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-[56px] md:top-[64px] z-20">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link href="/picker/dashboard" className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 active:scale-95 transition shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-bold text-gray-900 truncate">รอบจัดส่ง #{batch.id.slice(0, 8).toUpperCase()}</h1>
                        <p className="text-xs text-blue-600 font-medium">{batch.batch_items.length} ออเดอร์ที่ต้องจัด</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex max-w-3xl mx-auto border-t border-gray-100 bg-white">
                    <button onClick={() => setActiveTab('pick')} className={`flex-1 flex justify-center items-center gap-2 py-3 border-b-2 font-medium text-sm transition ${activeTab === 'pick' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        <ListTodo className="w-4 h-4 sm:w-5 sm:h-5" /> 1. รายการหยิบรวม
                    </button>
                    <button onClick={() => setActiveTab('pack')} className={`flex-1 flex justify-center items-center gap-2 py-3 border-b-2 font-medium text-sm transition ${activeTab === 'pack' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                        <Package className="w-4 h-4 sm:w-5 sm:h-5" /> 2. แยกตามออเดอร์
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
                
                {/* TAB 1: Pick List (หยิบรวม) */}
                {activeTab === 'pick' && (
                    <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-3">
                        <div className="mb-4 bg-blue-50 text-blue-800 px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2 border border-blue-100">
                            <ShoppingBag className="w-5 h-5 shrink-0" />
                            คำแนะนำ: เดินหยิบสินค้าตามจำนวนรวมทั้งหมดด้านล่างใส่รถเข็นให้ครบก่อน แล้วค่อยไปที่แท็บแยกตามออเดอร์
                        </div>

                        {pickList.map(item => {
                            const isPicked = pickedProducts[item.id];
                            return (
                                <div key={item.id} onClick={() => togglePick(item.id)} className={`flex items-center gap-3 p-3 sm:p-4 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer select-none ${isPicked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 shadow-sm'}`}>
                                    {/* Touch Target Checkbox */}
                                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border-2 transition-colors ${isPicked ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}>
                                        {isPicked && <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />}
                                    </div>
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-lg border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                                        {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <ShoppingBag className="w-5 h-5 text-gray-300" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-semibold text-sm sm:text-base leading-tight line-clamp-2 ${isPicked ? 'text-green-800 line-through opacity-70' : 'text-gray-900'}`}>
                                            {item.name}
                                        </h3>
                                        {item.isDecimal && <span className={`text-xs font-medium mt-1 block ${isPicked ? 'text-green-700/70' : 'text-gray-500'}`}>({item.totalQuantity} {item.unit_name})</span>}
                                    </div>
                                    <div className="shrink-0 text-right ml-1">
                                        {item.isDecimal ? (
                                            <>
                                                <span className={`block text-xl sm:text-2xl font-black ${isPicked ? 'text-green-600' : 'text-blue-600'}`}>{item.bagCount}</span>
                                                <span className={`block text-[10px] sm:text-xs font-medium mt-0.5 text-right ${isPicked ? 'text-green-600/70' : 'text-gray-500'}`}>ถุง(แพ็ค)</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className={`block text-xl sm:text-2xl font-black ${isPicked ? 'text-green-600' : 'text-blue-600'}`}>{item.totalQuantity}</span>
                                                {item.unit_name && <span className={`block text-[10px] sm:text-xs font-medium mt-0.5 text-right ${isPicked ? 'text-green-600/70' : 'text-gray-500'}`}>{item.unit_name}</span>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* TAB 2: Pack List (แยกกล่อง/แยกออเดอร์) */}
                {activeTab === 'pack' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                        {batch.batch_items.map((bi, index) => {
                            const order = bi.orders;
                            const isOrderFullyPacked = order?.order_items?.every(oi => packedOrderItems[oi.id]);

                            return (
                                <div key={bi.id} className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-colors ${isOrderFullyPacked ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200'}`}>
                                    <div className={`px-4 py-3 border-b flex justify-between items-center ${isOrderFullyPacked ? 'bg-green-50' : 'bg-slate-50'}`}>
                                        <div>
                                            <span className="text-xs font-bold bg-slate-800 text-white px-2 py-1 rounded-md mr-2">ออเดอร์ {index + 1}</span>
                                            <span className="font-semibold text-slate-800 text-sm">{order?.customer_info?.name || 'ลูกค้าไม่ระบุชื่อ'}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium">#{order?.order_code || order?.id.slice(0, 6).toUpperCase()}</div>
                                    </div>

                                    <div className="divide-y divide-gray-50">
                                        {order?.order_items?.map(oi => {
                                            const isPacked = packedOrderItems[oi.id];
                                            const unit = Array.isArray(oi.products?.product_units) ? oi.products.product_units[0] : oi.products?.product_units;
                                            const unitName = unit?.name || '';
                                            const displayQty = Number.isInteger(Number(oi.quantity)) ? Number(oi.quantity) : Number(oi.quantity).toFixed(2).replace(/\.?0+$/, '');

                                            return (
                                                <div key={oi.id} onClick={() => togglePack(oi.id)} className={`flex items-center gap-3 p-3 sm:p-4 transition-colors cursor-pointer select-none active:bg-gray-50 ${isPacked ? 'bg-green-50/50' : ''}`}>
                                                    <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center shrink-0 border-2 transition ${isPacked ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-transparent'}`}>
                                                        <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-medium leading-tight line-clamp-2 ${isPacked ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{oi.products?.name}</p>
                                                    </div>
                                                    <div className={`text-right shrink-0 ml-2 ${isPacked ? 'text-gray-400' : 'text-slate-800'}`}>
                                                        <span className="text-base sm:text-lg font-bold">{displayQty}</span>
                                                        {unitName && <span className="text-[10px] sm:text-xs ml-1 font-medium">{unitName}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Floating Action Bar */}
            {activeTab === 'pack' && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:static md:bg-transparent md:border-none md:p-0 md:shadow-none md:max-w-3xl md:mx-auto md:mt-8 z-30 pb-safe">
                    <button 
                        onClick={handleCompleteBatch}
                        disabled={!isAllPacked || isSubmitting}
                        className={`w-full py-3.5 sm:py-4 rounded-2xl text-base sm:text-lg font-bold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isAllPacked ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/30' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                    >
                        {isSubmitting ? 'กำลังบันทึก...' : <><CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> เตรียมสินค้าเสร็จสิ้น</>}
                    </button>
                </div>
            )}
        </div>
    );
}
