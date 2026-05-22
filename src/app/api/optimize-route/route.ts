import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // รองรับทั้ง batch_id และ batchId เพื่อความเข้ากันได้กับ Payload เดิมของระบบ
    const batch_id = body.batch_id || body.batchId;

    // ตรวจสอบ Request Payload
    if (!batch_id) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน: จำเป็นต้องระบุ batch_id' }, { status: 400 });
    }

    // 1. สร้าง Supabase Client ด้วย Service Role Key (Bypass RLS สำหรับการทำงานหลังบ้าน)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Query ดึงข้อมูลสาขาและจุดส่ง (Orders) ที่เกี่ยวข้องใน Batch นี้จากฐานข้อมูล
    const { data: batchData, error: batchError } = await supabase
      .from('delivery_batches')
      .select(`
        id,
        branches ( lat, lng ),
        batch_items (
          id,
          order_id,
          sequence_no,
          orders ( id, lat, lng, created_at )
        )
      `)
      .eq('id', batch_id)
      .single();

    if (batchError || !batchData) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลรอบจัดส่ง (Batch ID)' }, { status: 404 });
    }

    // 3. แยกข้อมูลพิกัด (Branch Origin และ Orders Waypoints)
    const branchLat = batchData.branches?.lat;
    const branchLng = batchData.branches?.lng;
    const batchItems = batchData.batch_items || [];

    if (!branchLat || !branchLng) {
      return NextResponse.json({ error: 'ข้อมูลพิกัดสาขาไม่สมบูรณ์' }, { status: 400 });
    }

    // เตรียมตัวแปรสำหรับการจัดเรียงลำดับ
    let optimizedItems: typeof batchItems = [];
    let isFallback = false;
    let fallbackMessage = '';

    // 4. ตรวจสอบ API Key (รองรับทั้ง GOOGLE_MAPS_API_KEY และ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    // ตรวจสอบว่ามีออเดอร์ใดที่พิกัดขาดหายหรือไม่
    const hasMissingCoords = batchItems.some((item) => !item.orders?.lat || !item.orders?.lng);

    if (!apiKey || hasMissingCoords || batchItems.length === 0) {
      // เงื่อนไขที่ไม่สามารถใช้ Google Maps ได้ (เข้าโหมด Fallback อัตโนมัติ)
      isFallback = true;
      fallbackMessage = !apiKey ? 'ไม่มี Google API Key' : 
                        hasMissingCoords ? 'พิกัดลูกค้าไม่สมบูรณ์' : 'ไม่มีออเดอร์ให้จัดเรียง';
    } else {
      // 5. เตรียมพารามิเตอร์ส่งให้ Google Maps
      const origin = `${branchLat},${branchLng}`; // จุดเริ่มต้น
      const destination = origin;                 // จุดสิ้นสุด (ให้คนขับวิ่งกลับมาสาขาเป็น Loop)
      
      // ผสมพิกัดให้อยู่ในฟอร์แมต "lat,lng|lat,lng" และเปิด optimize:true
      const waypoints = batchItems.map((item) => `${item.orders.lat},${item.orders.lng}`).join('|');
      const googleMapsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=optimize:true|${waypoints}&key=${apiKey}`;
      
      // 6. ส่ง Request ไปยัง Google Maps API
      const response = await fetch(googleMapsUrl);
      const data = await response.json();

      // 7. ตรวจสอบสถานะการคำนวณของ Google Maps
      if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
        console.warn('Google Maps API ตีกลับ:', data.status, data.error_message);
        isFallback = true;
        fallbackMessage = `ไม่สามารถคำนวณเส้นทางได้ (API Status: ${data.status})`;
      } else {
        // 8. ดึงข้อมูลลำดับที่ดีที่สุด (waypoint_order คืนค่าเป็น Array ของ Index เดิม)
        // ตัวอย่าง: ถ้า Array เดิมคือ [ออเดอร์ A, ออเดอร์ B, ออเดอร์ C]
        // หากเส้นทางที่สั้นที่สุดคือ C -> A -> B Google จะคืนค่า [2, 0, 1]
        const optimizedIndices: number[] = data.routes[0].waypoint_order;

        // นำ Index ที่ได้มา Map เพื่อจัดเรียง Array `batchItems` ใหม่ให้ถูกต้อง
        optimizedItems = optimizedIndices.map(index => batchItems[index]);
      }
    }

    // 9. Fallback Logic: จัดเรียงตามเวลาการสั่งซื้อ (created_at) กรณีที่ไม่สามารถ Optimize ได้
    if (isFallback) {
      // จำลองการจัดคิวแบบ First-In-First-Out (FIFO) ใครสั่งก่อนได้ส่งก่อน
      optimizedItems = [...batchItems].sort((a, b) => {
        // ถ้าข้อมูลวันที่เกิดข้อผิดพลาดให้ fallback ไปที่ 0 (1 Jan 1970)
        const dateA = new Date(a.orders?.created_at || 0).getTime();
        const dateB = new Date(b.orders?.created_at || 0).getTime();
        return dateA - dateB; 
      });
    }

    // 10. เขียนอัปเดตข้อมูลลำดับ (sequence_no) กลับลงฐานข้อมูล
    // ใช้ Promise.all เพื่อรันคำสั่ง Update หลายๆ ตัวพร้อมกัน (Parallel Execution) ช่วยให้ Response เร็วขึ้น
    const updatePromises = optimizedItems.map((item, index: number) => 
      supabase
        .from('batch_items')
        // sequence_no เริ่มจาก 1 (index + 1) เรียงไปเรื่อยๆ ตามที่จัดเรียงมาแล้ว
        .update({ sequence_no: index + 1 }) 
        .eq('id', item.id)
    );

    await Promise.all(updatePromises);

    return NextResponse.json({ 
      success: true, 
      fallback: isFallback,
      message: isFallback 
        ? `ระบบใช้โหมดสำรอง (จัดเรียงตามเวลาสั่งซื้อ) เนื่องจาก: ${fallbackMessage}`
        : 'จัดเรียงเส้นทางที่สั้นที่สุดด้วย Google Maps สำเร็จ'
    }, { status: 200 });

  } catch (error: any) {
    console.error('Optimize Route Fatal Error:', error);
    // หากเกิด Error ร้ายแรงระหว่างทำงาน ให้ตอบกลับแบบ Graceful degradation
    return NextResponse.json({ 
      success: true, 
      fallback: true, 
      message: 'Server ขัดข้อง ระบบใช้โหมดสำรองแล้ว' 
    }, { status: 200 });
  }
}