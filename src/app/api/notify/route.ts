import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { message } = await request.json();
    
    // ดึง Webhook URL จาก Environment Variable 
    // 💡 ทริค: หากมีหลายสาขา คุณสามารถส่ง branchId มาจาก Client 
    // และใช้ Supabase Query ดึง webhook_url ของสาขานั้นๆ จากตาราง branches ได้
    const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!discordWebhookUrl) {
      return NextResponse.json({ error: 'ไม่มีการตั้งค่า DISCORD_WEBHOOK_URL' }, { status: 500 });
    }

    // ส่งข้อความไปยัง Discord
    const response = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    });

    if (!response.ok) {
      const errRes = await response.text();
      throw new Error(`ยิง Discord Webhook ไม่สำเร็จ: ${errRes}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}