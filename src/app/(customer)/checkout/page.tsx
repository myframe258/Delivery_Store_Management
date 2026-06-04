import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CheckoutClient from './CheckoutClient';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const branchId = typeof params?.branchId === 'string' ? params.branchId : undefined;

  // 1. ตรวจสอบการ Login ของลูกค้า
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // ถ้ายังไม่ Login ให้เด้งไปหน้า Login พร้อมแนบ returnTo URL (ตาม PRD กำหนด)
    return redirect(`/login?returnTo=/checkout${branchId ? `?branchId=${branchId}` : ''}`);
  }

  // 2. ดึงข้อมูลพิกัดล่าสุดของ User
  const { data: userProfile } = await supabase
    .from('users')
    .select('lat, lng')
    .eq('id', user.id)
    .single();

  const savedLocation = userProfile?.lat && userProfile?.lng 
    ? { lat: Number(userProfile.lat), lng: Number(userProfile.lng) } 
    : null;

  // 3. ดึงข้อมูลสาขา
  if (!branchId) return <div className="p-8 text-center text-red-500">ไม่พบสาขา กรุณาเลือกสาขาที่หน้าแรก</div>;
  
  const { data: branch } = await supabase
    .from('branches')
    .select('*')
    .eq('id', branchId)
    .single();

  return <CheckoutClient branch={branch} user={user} savedLocation={savedLocation} />;
}