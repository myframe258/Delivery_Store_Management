import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CheckoutClient from '../../(customer)/checkout/CheckoutClient';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { branchId } = await searchParams;
  const supabase = await createClient();

  // ตรวจสอบการ Login หากยังไม่เข้าสู่ระบบ ให้ Redirect ไปหน้า Login พร้อมแนบ returnTo
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?returnTo=/checkout?branchId=${branchId}`);
  }

  if (!branchId) redirect('/');

  // 1. ดึงข้อมูลสาขา พร้อมรัศมีบริการ (service_radius)
  const { data: branch } = await supabase
    .from('branches')
    .select('*')
    .eq('id', branchId)
    .single();

  // 2. ดึงข้อมูลพิกัดล่าสุดของลูกค้าจากตาราง users
  const { data: userProfile } = await supabase
    .from('users')
    .select('lat, lng') // อย่าลืมเพิ่มคอลัมน์ lat, lng เป็น Text หรือ Float ในตาราง users นะครับ
    .eq('id', user.id)
    .single();

  const savedLocation = (userProfile?.lat && userProfile?.lng) ? { lat: Number(userProfile.lat), lng: Number(userProfile.lng) } : null;

  return <CheckoutClient branch={branch} user={user} savedLocation={savedLocation} />;
}