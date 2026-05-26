'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { PackageOpen, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

type DeliveryBatch = {
    id: string;
    batch_status: string;
    created_at: string;
    batch_items: { id: string }[];
};

export default function PickerDashboardPage() {
    const router = useRouter();
    const [batches, setBatches] = useState<DeliveryBatch[]>([]);
    const [loading, setLoading] = useState(true);

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    useEffect(() => {
        fetchBatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchBatches = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login?returnTo=/picker/dashboard');
                return;
            }

            // ดึงผู้ใช้งานเพื่อเช็คสาขา (branch_id)
            const { data: userData } = await supabase
                .from('users')
                .select('branch_id')
                .eq('id', session.user.id)
                .single();

            if (!userData?.branch_id) return;

            // ดึงรอบจัดส่งของสาขานี้ ที่ยังไม่ได้จัดส่ง (เรียงตามเก่าไปใหม่ ด่วนสุดขึ้นก่อน)
            const { data, error } = await supabase
                .from('delivery_batches')
                .select(`
                    id,
                    batch_status,
                    created_at,
                    batch_items ( id )
                `)
                .eq('branch_id', userData.branch_id)
                .in('batch_status', ['pending', 'assigned', 'preparing'])
                .order('created_at', { ascending: true });

            if (error) throw error;
            setBatches(data as DeliveryBatch[]);
        } catch (error) {
            console.error('Error fetching picker batches:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="min-h-screen flex justify-center items-center bg-gray-50">กำลังโหลดข้อมูล...</div>;

    return (
        <div className="min-h-screen bg-gray-50 pt-14 pb-16 md:pt-16 md:pb-0 px-4">
            <div className="max-w-3xl mx-auto py-6">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                        <PackageOpen className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">งานจัดเตรียมสินค้า</h1>
                        <p className="text-gray-500 text-sm">เลือกรอบการจัดส่งที่ต้องการจัดเตรียม</p>
                    </div>
                </div>

                {batches.length === 0 ? (
                    <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm flex flex-col items-center">
                        <CheckCircle2 className="w-16 h-16 text-emerald-400 mb-4" />
                        <h3 className="text-lg font-bold text-gray-800">ไม่มีงานค้าง</h3>
                        <p className="text-gray-500">คุณจัดเตรียมสินค้าครบทุกรอบแล้ว</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {batches.map((batch, index) => (
                            <Link key={batch.id} href={`/picker/batch/${batch.id}`} className="block">
                                <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-blue-400 hover:shadow-md transition-all active:scale-[0.98]">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1 rounded-full">รอบที่ {index + 1}</span>
                                            {batch.batch_status === 'preparing' && <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full animate-pulse">กำลังจัดของ</span>}
                                        </div>
                                        <span className="text-gray-500 text-xs flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" /> 
                                            {new Date(batch.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} 
                                            {' '}{new Date(batch.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <h3 className="font-semibold text-gray-800 text-lg">รหัสรอบ: #{batch.id.slice(0, 6).toUpperCase()}</h3>
                                        <div className="flex items-center gap-2 text-blue-600 font-medium">รวม {batch.batch_items.length} ออเดอร์ <ChevronRight className="w-5 h-5" /></div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
