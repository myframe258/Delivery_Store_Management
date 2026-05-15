import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const { batch_id } = await request.json();
    if (!batch_id) return NextResponse.json({ error: 'Missing batch_id' }, { status: 400 });

    // 1. Initialize Supabase Client (ใช้ Service Role Key เพื่อ Bypass RLS กรณีรันจากฝั่ง Server)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 2. ดึงข้อมูลพิกัดของสาขา (จุดเริ่มต้น)
    const { data: batch, error: batchError } = await supabase
      .from('delivery_batches')
      .select('branch_id, branches(lat, lng)')
      .eq('id', batch_id)
      .single();

    if (batchError || !batch) throw new Error('ไม่พบข้อมูลรอบจัดส่ง (Batch not found)');
    
    // แปลง String เป็น Number ป้องกันข้อผิดพลาด
    const branchLat = Number(batch.branches.lat);
    const branchLng = Number(batch.branches.lng);

    // 3. ดึงข้อมูลพิกัดออเดอร์ทั้งหมดในรอบนี้ (จุดแวะส่ง)
    const { data: items, error: itemsError } = await supabase
      .from('batch_items')
      .select('id, order_id, orders(lat, lng)')
      .eq('batch_id', batch_id);

    if (itemsError || !items || items.length === 0) throw new Error('ไม่พบรายการออเดอร์ในรอบจัดส่งนี้');

    // หากมีแค่ 1 จุดส่ง ไม่ต้องเสียเวลาให้ Google Maps คำนวณ
    if (items.length === 1) {
      await supabase.from('batch_items').update({ sequence_no: 1 }).eq('id', items[0].id);
      return NextResponse.json({ success: true, message: 'มีเพียง 1 จุดส่ง อัปเดตลำดับเรียบร้อย' });
    }

    // 4. เตรียมข้อมูลส่งเข้า Google Maps Directions API
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) throw new Error('ยังไม่ได้ตั้งค่า GOOGLE_MAPS_API_KEY ใน .env.local');

    const origin = `${branchLat},${branchLng}`;
    const destination = origin; // กำหนดให้จุดสิ้นสุดกลับมาที่สาขา (Loop) เพื่อให้ Google จัดลำดับได้แม่นยำที่สุด
    
    // กำหนด Waypoints พร้อมเปิดโหมด optimize:true
    const waypoints = `optimize:true|` + items.map((item: any) => `${item.orders.lat},${item.orders.lng}`).join('|');

    const googleApiUrl = `<https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&waypoints=${waypoints}&key=${apiKey}>`;

    const response = await fetch(googleApiUrl);
    const data = await response.json();

    if (data.status !== 'OK') {
      throw new Error(`Google Maps API คำนวณเส้นทางไม่ได้: ${data.status}`);
    }

    // 5. นำลำดับที่ Google คำนวณได้ (waypoint_order) มาอัปเดตลง Database
    const waypointOrder = data.routes[0].waypoint_order; // จะได้ Array เช่น [2, 0, 1]

    const updatePromises = waypointOrder.map((originalIndex: number, newSequence: number) => {
      const batchItemId = items[originalIndex].id;
      return supabase
        .from('batch_items')
        .update({ sequence_no: newSequence + 1 }) // +1 เพราะ Sequence ควรเริ่มที่ 1
        .eq('id', batchItemId);
    });

    await Promise.all(updatePromises);

    return NextResponse.json({ success: true, message: 'คำนวณและอัปเดตเส้นทางสำเร็จ!' });
  } catch (error: any) {
    console.error('Route Optimization Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
