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

export async function POST(request: Request) {
  try {
    // ตรวจสอบ Secret Key ว่า Request นี้มาจาก Supabase ของเราจริงๆ (ตั้งค่า Query Param ตอนสร้าง Webhook ใน Supabase)
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== process.env.SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: SupabaseWebhookPayload = await request.json();

    // เราสนใจเฉพาะเวลาที่มีการอัปเดตตาราง orders
    if (payload.table === 'orders' && payload.type === 'UPDATE') {
      const { status, customer_id } = payload.record;
      const oldStatus = payload.old_record?.status;

      // ตรวจสอบว่าสถานะมีการเปลี่ยนแปลงจริงๆ หรือไม่
      if (status !== oldStatus) {
        // ดึงข้อมูล LINE User ID ของลูกค้าจากตาราง users 
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('line_user_id') // สมมติว่ามีการเก็บ line_user_id ตอนลูกค้าล็อกอินผ่าน LINE
          .eq('id', customer_id)
          .single();

        if (userData?.line_user_id) {
          const message = `อัปเดตสถานะคำสั่งซื้อ 📦\nสถานะล่าสุดของคุณคือ: ${status}`;
          await sendLinePushMessage(userData.line_user_id, message);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
