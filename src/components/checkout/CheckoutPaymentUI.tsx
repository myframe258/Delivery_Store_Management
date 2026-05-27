"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { UploadCloud, CheckCircle, Loader2 } from "lucide-react";

interface CheckoutPaymentUIProps {
  branchId: number;
  totalPrice: number;
  onOrderComplete: (orderId: string) => void;
}

export default function CheckoutPaymentUI({ branchId, totalPrice, onOrderComplete }: CheckoutPaymentUIProps) {
  const [paymentMethod, setPaymentMethod] = useState<"promptpay" | "cod">("promptpay");
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // สร้าง Supabase Client ฝั่ง Browser
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSlipFile(e.target.files[0]);
    }
  };

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    try {
      let paymentSlipUrl = null;
      let paymentStatus = "pending_payment";

      // กระบวนการอัปโหลดสลิป (ถ้าเลือก PromptPay)
      if (paymentMethod === "promptpay") {
        if (!slipFile) {
          alert("กรุณาแนบสลิปโอนเงินก่อนยืนยันคำสั่งซื้อ");
          setIsSubmitting(false);
          return;
        }

        const fileExt = slipFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("slips")
          .upload(filePath, slipFile);

        if (uploadError) throw uploadError;

        // ดึง Public URL ของไฟล์สลิป
        const { data: publicUrlData } = supabase.storage
          .from("slips")
          .getPublicUrl(uploadData.path);
          
        paymentSlipUrl = publicUrlData.publicUrl;
        paymentStatus = "pending_verification"; // รอแอดมินตรวจสอบ
      } else if (paymentMethod === "cod") {
        paymentStatus = "pending_payment";
      }

      // สมมติ: ทำการบันทึกข้อมูลออเดอร์ลงฐานข้อมูล
      // ในระบบจริง คุณจะนำตัวแปรเหล่านี้ไปรวมกับ payload ของตะกร้าสินค้า
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert({
          branch_id: branchId,
          total_price: totalPrice,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          payment_slip_url: paymentSlipUrl,
          lat: 0, // รอรับจากพิกัดลูกค้า
          lng: 0,
          status: "pending", // สถานะโดยรวมของออเดอร์
        })
        .select()
        .single();

      if (orderError) throw orderError;

      onOrderComplete(orderData.id);
    } catch (error) {
      console.error("Order submission failed:", error);
      alert("เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-xl font-bold mb-4">ช่องทางการชำระเงิน</h2>
      
      <div className="space-y-4 mb-6">
        <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${paymentMethod === 'promptpay' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
          <input type="radio" name="paymentMethod" value="promptpay" className="mr-3" 
            checked={paymentMethod === "promptpay"} 
            onChange={() => setPaymentMethod("promptpay")} />
          <span className="font-medium">โอนเงินผ่านบัญชีธนาคาร (PromptPay)</span>
        </label>

        <label className={`flex items-center p-4 border rounded-lg cursor-pointer transition ${paymentMethod === 'cod' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
          <input type="radio" name="paymentMethod" value="cod" className="mr-3" 
            checked={paymentMethod === "cod"} 
            onChange={() => setPaymentMethod("cod")} />
          <span className="font-medium">ชำระเงินปลายทาง (COD)</span>
        </label>
      </div>

      {/* ส่วนแสดง QR Code และแนบสลิป เมื่อเลือกโอนเงิน */}
      {paymentMethod === "promptpay" && (
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 text-center mb-6">
          <h3 className="font-semibold text-gray-700 mb-2">สแกน QR Code เพื่อโอนเงิน</h3>
          <p className="text-xl font-bold text-blue-600 mb-4">ยอดโอน: ฿{totalPrice.toLocaleString()}</p>
          
          {/* รูป QR Code ร้านค้า */}
          <div className="w-48 h-48 bg-white mx-auto mb-4 border-2 border-dashed border-gray-300 flex items-center justify-center rounded-lg">
            {/* ใส่รูป QR Code ของร้านจริงๆ ตรงนี้ */}
            <span className="text-gray-400">[รูป QR Code ร้านค้า]</span>
          </div>
          
          <div className="mt-4">
            <label htmlFor="slip-upload" className="block text-sm font-medium text-gray-700 mb-2">แนบสลิปโอนเงิน</label>
            <input 
              id="slip-upload"
              type="file" 
              accept="image/*"
              title="เลือกไฟล์สลิปโอนเงิน"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
      )}

      <button
        onClick={handleSubmitOrder}
        disabled={isSubmitting || (paymentMethod === "promptpay" && !slipFile)}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition disabled:bg-gray-300 disabled:cursor-not-allowed flex justify-center items-center"
      >
        {isSubmitting ? (
          <><Loader2 className="animate-spin mr-2 w-5 h-5" /> กำลังดำเนินการ...</>
        ) : (
          <><CheckCircle className="mr-2 w-5 h-5" /> ยืนยันการสั่งซื้อ</>
        )}
      </button>
    </div>
  );
}
