import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { distance } = body;

    if (typeof distance !== 'number') {
      return NextResponse.json({ error: 'กรุณาระบุระยะทางเป็นตัวเลข' }, { status: 400 });
    }

    // สูตรคำนวณค่าจัดส่ง: ค่าบริการเริ่มต้น (Base Fee) + (ระยะทาง * ราคาต่อกิโลเมตร)
    // เช่น: เริ่มต้น 15 บาท + กิโลเมตรละ 10 บาท
    const BASE_FEE = 15;
    const RATE_PER_KM = 10;

    // ปัดเศษขึ้นเสมอเพื่อไม่ให้มีจุดทศนิยม
    const fee = Math.ceil(BASE_FEE + (distance * RATE_PER_KM));

    return NextResponse.json({ fee, distance });
  } catch (error) {
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการคำนวณค่าจัดส่ง' }, { status: 500 });
  }
}
