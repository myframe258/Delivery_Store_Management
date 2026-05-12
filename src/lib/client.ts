import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ฟังก์ชันสำหรับเรียกใช้ Supabase ใน Client Components ('use client')
// จะดึงค่า URL และ Anon Key จาก Environment Variables ให้อัตโนมัติ
export const createSupabaseClient = () => {
  return createClientComponentClient();
};