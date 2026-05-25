'use server';

export async function validateDeliverySlot(deliveryDate: string, deliverySlot: string) {
  try {
    // 1. ดึงเวลาปัจจุบัน (แปลงเป็นเวลาไทย GMT+7 เพื่อความแม่นยำของ Cut-off)
    const serverNow = new Date();
    const thaiTime = new Date(serverNow.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
    const currentHour = thaiTime.getHours();
    
    const selectedDateObj = new Date(deliveryDate);
    selectedDateObj.setHours(0, 0, 0, 0);
    
    const todayDateObj = new Date(thaiTime);
    todayDateObj.setHours(0, 0, 0, 0);

    // กฎข้อที่ 1: ห้ามเลือกวันย้อนหลัง
    if (selectedDateObj < todayDateObj) {
      return { success: false, error: 'ไม่สามารถเลือกวันจัดส่งย้อนหลังได้' };
    }

    // กฎข้อที่ 2: เช็ค Cut-off time กรณีเลือกจัดส่ง "วันนี้"
    if (selectedDateObj.getTime() === todayDateObj.getTime()) {
      if (currentHour >= 12) {
        return { success: false, error: 'สั่งซื้อหลัง 12:00 น. ต้องเลือกรอบจัดส่งของวันพรุ่งนี้เป็นต้นไป' };
      }
      if (deliverySlot === 'morning') {
        return { success: false, error: 'สั่งซื้อวันนี้ สามารถรับสินค้าได้รอบเร็วที่สุดคือ "รอบเย็น" (18:00-19:00)' };
      }
    }

    // กฎข้อที่ 3: ป้องกันการแอบส่งค่า Slot แปลกๆ เข้ามา
    if (!['morning', 'evening'].includes(deliverySlot)) {
      return { success: false, error: 'รอบจัดส่งไม่ถูกต้อง' };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'รูปแบบวันที่ไม่ถูกต้อง' };
  }
}
