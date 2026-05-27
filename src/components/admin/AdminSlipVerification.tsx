"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Check, X, ExternalLink, Loader2 } from "lucide-react";

interface OrderData {
  id: string;
  order_code: string;
  total_price: number;
  payment_slip_url: string;
}

interface AdminSlipVerificationProps {
  order: OrderData;
  onVerificationComplete: (orderId: string, newStatus: string) => void;
}

export default function AdminSlipVerification({ order, onVerificationComplete }: AdminSlipVerificationProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleUpdateStatus = async (status: 'paid' | 'payment_failed') => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: status })
        .eq('id', order.id);

      if (error) throw error;

      alert(`อัปเดตสถานะเป็น ${status} เรียบร้อยแล้ว`);
      onVerificationComplete(order.id, status);
    } catch (error) {
      console.error("Update payment status error:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-100 max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800">ตรวจสอบการชำระเงิน</h2>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
          รอตรวจสอบสลิป
        </span>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-500">รหัสคำสั่งซื้อ: <span className="font-semibold text-gray-800">{order.order_code}</span></p>
        <p className="text-sm text-gray-500">ยอดเงินที่ต้องชำระ: <span className="text-xl font-bold text-blue-600">฿{order.total_price.toLocaleString()}</span></p>
      </div>

      <div className="mb-6 relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
        {order.payment_slip_url ? (
          <div className="flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={order.payment_slip_url} alt="Slip" className="w-full object-contain max-h-80" />
            <a href={order.payment_slip_url} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition">
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-400">ไม่พบรูปภาพสลิป</div>
        )}
      </div>

      <div className="flex gap-3">
        <button 
          onClick={() => handleUpdateStatus('payment_failed')}
          disabled={isUpdating}
          className="flex-1 py-2 px-4 border border-red-500 text-red-600 hover:bg-red-50 font-semibold rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <X className="w-5 h-5" /> ปฏิเสธสลิป
        </button>
        <button 
          onClick={() => handleUpdateStatus('paid')}
          disabled={isUpdating}
          className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isUpdating ? <Loader2 className="animate-spin w-5 h-5" /> : <Check className="w-5 h-5" />} ยืนยันยอดเงิน
        </button>
      </div>
    </div>
  );
}