/**
 * ฟังก์ชันสำหรับส่ง Push Message ผ่าน LINE Messaging API
 * @param toUserId LINE User ID ของผู้รับ (ลูกค้า)
 * @param messageText ข้อความที่ต้องการส่งแจ้งเตือน
 */
export async function sendLinePushMessage(toUserId: string, messageText: string) {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('Missing LINE_CHANNEL_ACCESS_TOKEN');
    return false;
  }

  try {
    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        to: toUserId,
        messages: [
          {
            type: 'text',
            text: messageText
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('LINE API Error Details:', JSON.stringify(data, null, 2));
    }

    return response.ok;
  } catch (error) {
    console.error('Error sending LINE message:', error);
    return false;
  }
}