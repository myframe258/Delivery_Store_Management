import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  
  // ตรวจสอบว่าผู้ใช้ล็อกอินหรือไม่
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // ดึงข้อมูลจาก request body
    const {
      branch_id,
      total_price,
      customer_info,
      lat,
      lng,
      delivery_date,
      delivery_slot,
      items,
    } = await request.json();

    // ตรวจสอบข้อมูลพื้นฐาน
    if (!branch_id || !items || items.length === 0 || !lat || !lng || !delivery_date || !delivery_slot) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // เรียกใช้ RPC Function ที่สร้างไว้บน Supabase
    const { data: newOrderId, error: rpcError } = await supabase.rpc(
      'create_order_and_decrement_stock', 
      {
        p_branch_id: branch_id,
        p_customer_id: user.id,
        p_total_price: total_price,
        p_customer_info: customer_info,
        p_lat: lat.toString(),
        p_lng: lng.toString(),
        p_delivery_date: delivery_date,
        p_delivery_slot: delivery_slot,
        p_items: items,
      }
    );

    if (rpcError) {
      console.error('RPC Error:', rpcError);
      // แปลง Error จาก Database ให้เป็นข้อความที่ User เข้าใจง่าย
      const friendlyMessage = rpcError.message.includes('สินค้าไม่เพียงพอ') 
        ? `ขออภัย, ${rpcError.message.split(': ')[1]} มีจำนวนไม่พอในสต็อก`
        : 'เกิดข้อผิดพลาดในการสร้างออเดอร์';
      return NextResponse.json({ error: friendlyMessage, details: rpcError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, orderId: newOrderId }, { status: 201 });

  } catch (error: any) {
    console.error('Order API Error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดที่ไม่คาดคิดบนเซิร์ฟเวอร์' }, { status: 500 });
  }
}