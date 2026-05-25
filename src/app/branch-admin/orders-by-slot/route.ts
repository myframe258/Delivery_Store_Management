import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const branchIdParam = searchParams.get('branch_id');

    // 1. ถ้าไม่ส่ง date มาใน Query ให้ใช้วันที่ปัจจุบัน 
    let targetDate = dateParam;
    if (!targetDate) {
      const thaiTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
      targetDate = thaiTime.toISOString().split('T')[0];
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { },
        },
      }
    );

    // 2. ตรวจสอบการเข้าสู่ระบบ (ใช้ getUser ปลอดภัยกว่า getSession สำหรับฝั่ง Server)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized: กรุณาเข้าสู่ระบบ' }, { status: 401 });
    }

    // 3. ตรวจสอบสิทธิ์ (Role)
    const role = user.app_metadata?.role || user.user_metadata?.role;
    if (role !== 'branch_admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    // ใช้ Service Role ในการดึงข้อมูลหลังบ้านเพื่อป้องกันปัญหา RLS บล็อกการอ่าน
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 4. ค้นหา branch_id ของแอดมินคนนี้
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('branch_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile?.branch_id) {
      console.error('Profile Error:', profileError);
      return NextResponse.json({ error: 'ไม่พบข้อมูลสาขาที่ผู้ใช้นี้ประจำอยู่', details: profileError }, { status: 404 });
    }

    let branchId = branchIdParam;

    // ตรวจสอบความปลอดภัย: ป้องกันแอดมินสาขาอื่นแอบดึงข้อมูลข้ามสาขา
    if (role !== 'super_admin' && String(userProfile.branch_id) !== String(branchIdParam)) {
      branchId = userProfile.branch_id; // บังคับใช้ branch_id ของตัวเองเสมอ
    }
    if (!branchId) branchId = userProfile.branch_id;

    // 5. ดึงข้อมูลคำสั่งซื้อของสาขานี้ ผ่าน Admin Client
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('id, total_price, status, customer_info, delivery_slot, created_at, lat, lng')
      .eq('branch_id', branchId)
      .eq('delivery_date', targetDate)
      .order('created_at', { ascending: true }); // เรียงตามเวลาสั่งซื้อก่อน-หลัง

    if (ordersError) throw ordersError;

    // 6. จัดกลุ่มออเดอร์ตามรอบจัดส่ง
    const { data: slotsData } = await supabaseAdmin.from('delivery_slots').select('*').order('sort_order');

    const groupedSlots: any = {};
    let totalCount = orders?.length || 0;

    slotsData?.forEach(slot => {
      const slotOrders = orders?.filter(o => o.delivery_slot === slot.id) || [];
      groupedSlots[slot.id] = {
        name: slot.name,
        time_range: slot.time_range,
        orders: slotOrders
      };
    });

    // หากมีออเดอร์ที่รอบจัดส่งไม่ตรงกับในระบบ (เช่นรอบถูกลบไปแล้ว)
    const unknownOrders = orders?.filter(o => !slotsData?.find(s => s.id === o.delivery_slot)) || [];
    if (unknownOrders.length > 0) {
      groupedSlots['unknown'] = {
        name: 'รอบอื่นๆ',
        time_range: '(ไม่ได้ระบุ / ถูกลบ)',
        orders: unknownOrders
      };
    }

    return NextResponse.json({
      date: targetDate,
      branch_id: branchId,
      slots: groupedSlots,
      summary: { total: totalCount }
    }, { status: 200 });

  } catch (error: any) {
    console.error('API Error (orders-by-slot):', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดบนเซิร์ฟเวอร์', details: error.message }, { status: 500 });
  }
}
