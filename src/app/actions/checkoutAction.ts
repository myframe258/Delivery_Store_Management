'use server';
import { createClient } from '@supabase/supabase-js';

export async function validateDeliverySlot(deliveryDate: string, deliverySlotId: string) {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: slot } = await supabase.from('delivery_slots').select('*').eq('id', deliverySlotId).single();
    
    if (!slot || !slot.is_active) {
      return { success: false, error: 'รอบจัดส่งไม่ถูกต้อง หรือถูกปิดใช้งานแล้ว' };
    }

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
      if (currentHour >= slot.cut_off_hour) {
        return { success: false, error: `ไม่สามารถเลือกรอบ ${slot.name} สำหรับวันนี้ได้ เนื่องจากเลยเวลาตัดรอบแล้ว` };
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'รูปแบบวันที่ไม่ถูกต้อง' };
  }
}
