import { NextResponse } from 'next/server';

// ข้อมูลจำเพาะสำหรับ Request Body ที่คาดหวัง
interface OrderLocation {
  id: string; // Order ID
  lat: number;
  lng: number;
  [key: string]: any; // ข้อมูลอื่นๆ ของออเดอร์
}

interface OptimizeRouteRequest {
  branchLocation: { lat: number; lng: number };
  orders: OrderLocation[];
}

export async function POST(request: Request) {
  try {
    const body: OptimizeRouteRequest = await request.json();
    const { branchLocation, orders } = body;

    // 1. ตรวจสอบข้อมูลนำเข้า
    if (!branchLocation || !orders || !Array.isArray(orders) || orders.length === 0) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ครบถ้วน กรุณาส่งพิกัดสาขาและรายการออเดอร์' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ยังไม่ได้ตั้งค่า GOOGLE_MAPS_API_KEY ใน Environment Variables' },
        { status: 500 }
      );
    }

    // 2. จัดเตรียมพารามิเตอร์สำหรับ Google Maps API
    const origin = `${branchLocation.lat},${branchLocation.lng}`;
    // ให้ปลายทางเป็นสาขา เพื่อให้รถวิ่งจบรอบที่ร้าน
    const destination = origin; 
    
    // แปลงพิกัดออเดอร์เป็น string และใส่คำสั่ง optimize:true เพื่อให้ AI ของ Google จัดเรียงลำดับให้
    const waypointsArray = orders.map((o) => `${o.lat},${o.lng}`);
    const waypointsParam = `optimize:true|${waypointsArray.join('|')}`;

    // 3. ยิง Request ไปยัง Google Maps Directions API
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.append('origin', origin);
    url.searchParams.append('destination', destination);
    url.searchParams.append('waypoints', waypointsParam);
    url.searchParams.append('key', apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== 'OK') {
      return NextResponse.json({ error: 'Google Maps API error', details: data }, { status: 400 });
    }

    // 4. นำผลลัพธ์ (waypoint_order) มาจัดเรียงลำดับออเดอร์ใหม่
    const route = data.routes[0];
    const optimizedOrderIndices: number[] = route.waypoint_order; // เช่น [2, 0, 1]

    // สร้าง Array ออเดอร์ใหม่ที่ถูกเรียงลำดับแล้ว พร้อมแนบ sequence_no
    const optimizedOrders = optimizedOrderIndices.map((originalIndex, newSequence) => ({
      ...orders[originalIndex],
      sequence_no: newSequence + 1, // เริ่มต้นที่ 1
    }));

    // 5. ส่งข้อมูลกลับไปยัง Client
    return NextResponse.json({
      success: true,
      optimizedOrders
    });
  } catch (error) {
    console.error('Optimize Route API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}