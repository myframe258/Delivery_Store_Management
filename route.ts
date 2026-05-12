import { NextResponse } from 'next/server';

interface OrderLocation {
  id: string;
  lat: number;
  lng: number;
  [key: string]: any; // ข้อมูลอื่นๆ เช่น customer_info
}

interface OptimizeRequest {
  branchLocation: {
    lat: number;
    lng: number;
  };
  orders: OrderLocation[];
}

export async function POST(
  request: Request,
  { params }: { params: { branchId: string } }
) {
  try {
    const { branchId } = params;
    const body: OptimizeRequest = await request.json();
    const { branchLocation, orders } = body;

    // 1. ตรวจสอบความถูกต้องของข้อมูลที่ส่งมา
    if (!branchLocation || !orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json({ error: 'ข้อมูลสาขาหรือออเดอร์ไม่ถูกต้อง' }, { status: 400 });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ไม่พบ Google Maps API Key ในระบบ' }, { status: 500 });
    }

    // 2. จัดเตรียมพารามิเตอร์สำหรับ Google Maps Directions API
    // กำหนดให้จุดเริ่มต้น (Origin) และจุดสิ้นสุด (Destination) เป็นที่ตั้งสาขา เพื่อสร้าง Loop การจัดส่งกลับมาที่เดิม
    const origin = `${branchLocation.lat},${branchLocation.lng}`;
    const destination = origin;

    // นำพิกัดออเดอร์ทั้งหมดมาต่อกันด้วย | และนำหน้าด้วย optimize:true เพื่อสั่งให้ Google จัดเรียงลำดับใหม่
    const waypointsList = orders.map((o) => `${o.lat},${o.lng}`).join('|');
    const waypoints = `optimize:true|${waypointsList}`;

    // 3. สร้าง URL และยิง Request ไปยัง Google
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.append('origin', origin);
    url.searchParams.append('destination', destination);
    url.searchParams.append('waypoints', waypoints);
    url.searchParams.append('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      return NextResponse.json(
        { error: 'ไม่สามารถคำนวณเส้นทางได้', details: data.error_message || data.status },
        { status: 500 }
      );
    }

    // 4. ดึงลำดับใหม่ที่ผ่านการ Optimize แล้ว (waypoint_order จะเป็น array เช่น [2, 0, 1])
    const waypointOrder: number[] = data.routes[0].waypoint_order;
    const optimizedOrders = waypointOrder.map((index) => orders[index]);

    // ดึง Polyline เพื่อนำไปใช้ลากเส้นทางบน Leaflet ได้ทันที
    const encodedPolyline = data.routes[0].overview_polyline.points;

    return NextResponse.json({
      branchId,
      optimizedOrders,
      polyline: encodedPolyline,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' }, { status: 500 });
  }
}