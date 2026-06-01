import { NextResponse } from 'next/server';
import { sendLinePushMessage } from '@/lib/line-messaging';
import { createClient } from '@supabase/supabase-js';

// ตัวอย่าง Webhook Payload ที่รับมาจาก Supabase Database Webhooks
interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: any; // ข้อมูลบรรทัดใหม่หลังจากการเปลี่ยนแปลง
  old_record: any; // ข้อมูลบรรทัดเดิมก่อนการเปลี่ยนแปลง
}

// ฟังก์ชันแปลงสถานะเป็นข้อความน่ารักๆ 💬
const getCuteStatusMessage = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending':
      return 'รับออเดอร์แล้วจ้า 📝 รอแอดมินคอนเฟิร์มนิดนึงน้า';
    case 'batched':
    case 'preparing':
      return 'แอดมินกำลังจัดเตรียมสินค้าอย่างตั้งใจเลย 🛍️✨';
    case 'ready_for_pickup':
      return 'แพ็กของเสร็จแล้ว! รอพี่ไรเดอร์มารับไปส่งน้า 🛵💨';
    case 'out_for_delivery':
      return 'พี่ไรเดอร์กำลังบิดไปส่งให้ถึงที่เลยจ้า 🚀🏡 เตรียมรับสายด้วยน้า';
    case 'delivered':
      return 'เย้! ส่งสินค้าสำเร็จแล้ว 🎉 ขอบคุณที่อุดหนุนนะคะ หวังว่าจะถูกใจน้า 💕';
    case 'cancelled':
      return 'แง 🥺 ออเดอร์นี้ถูกยกเลิกแล้ว ไว้โอกาสหน้าแวะมาอุดหนุนใหม่นะคะ';
    default:
      return `มีการอัปเดตสถานะเป็น: ${status} 📦`;
  }
};

export async function POST(request: Request) {
  try {
    // ตรวจสอบ Secret Key ว่า Request นี้มาจาก Supabase ของเราจริงๆ (ตั้งค่า Query Param ตอนสร้าง Webhook ใน Supabase)
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_WEBHOOK_SECRET) {
      console.error('[Webhook Error] Unauthorized: Secret Key ไม่ตรงกัน หรือไม่ได้แนบมา');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: SupabaseWebhookPayload = await request.json();
    console.log(`[Webhook] ได้รับ Trigger จากตาราง: ${payload.table} | Event: ${payload.type}`);

    // เราสนใจเฉพาะเวลาที่มีการอัปเดตตาราง orders
    if (payload.table === 'orders' && payload.type === 'UPDATE') {
      const { status, customer_id } = payload.record;
      const oldStatus = payload.old_record?.status;

      // ตรวจสอบว่าสถานะมีการเปลี่ยนแปลงจริงๆ หรือไม่
      if (status !== oldStatus) {
        console.log(`[Webhook] สถานะออเดอร์เปลี่ยนจาก ${oldStatus} -> ${status} (Customer ID: ${customer_id})`);

        // ดึงข้อมูล LINE User ID ของลูกค้าจากตาราง users 
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { data: userData, error: userError } = await supabaseAdmin
          .from('users')
          .select('line_user_id') // สมมติว่ามีการเก็บ line_user_id ตอนลูกค้าล็อกอินผ่าน LINE
          .eq('id', customer_id)
          .single();

        if (userError) {
          console.error('[Webhook] ดึงข้อมูลผู้ใช้ไม่สำเร็จ:', userError.message);
        }

        if (userData?.line_user_id) {
          console.log(`[Webhook] พบ LINE User ID: ${userData.line_user_id} กำลังส่งข้อความ...`);
          const statusText = getCuteStatusMessage(status);
          const message = `✨ อัปเดตคำสั่งซื้อของคุณ ✨\n\n${statusText}`;
          const success = await sendLinePushMessage(userData.line_user_id, message);
          console.log(`[Webhook] สถานะการส่ง LINE: ${success ? 'สำเร็จ' : 'ล้มเหลว'}`);
        } else {
          console.log('[Webhook] ลูกค้ารายนี้ไม่ได้เชื่อมต่อบัญชี LINE ไว้ (ไม่มี line_user_id)');
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Webhook] Fatal Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
