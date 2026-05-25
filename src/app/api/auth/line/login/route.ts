import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { origin } = new URL(request.url);

    const clientId = process.env.NEXT_PUBLIC_LINE_CLIENT_ID;
    // ป้องกันปัญหาจากการรันเซิร์ฟเวอร์บน 0.0.0.0 โดยแปลงเป็น localhost ให้ตรงกับ LINE Developers
    const safeOrigin = origin.includes('0.0.0.0') ? origin.replace('0.0.0.0', 'localhost') : origin;
    const redirectUri = encodeURIComponent(`${safeOrigin}/api/auth/line/callback`);
    const state = Math.random().toString(36).substring(7); // สร้างค่าสุ่มป้องกันการโจมตีแบบ CSRF

    // สร้างลิงก์สำหรับพาผู้ใช้ไปหน้าล็อกอินของ LINE
    const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid%20email`;

    return NextResponse.redirect(lineAuthUrl);
}
