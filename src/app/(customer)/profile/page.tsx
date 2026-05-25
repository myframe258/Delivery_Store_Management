'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { User, Phone, MapPin, Save, ChevronLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// โหลด CheckoutMap แบบ Dynamic (ปิด SSR) ป้องกัน Window is not defined
const CheckoutMap = dynamic(() => import('@/components/maps/CheckoutMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-slate-100 flex items-center justify-center rounded-xl animate-pulse">
      <p className="text-slate-500 font-medium">กำลังโหลดแผนที่...</p>
    </div>
  ),
});

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  // State สำหรับพิกัดแผนที่ (Default: กรุงเทพฯ)
  const [location, setLocation] = useState<{ lat: number; lng: number }>({
    lat: 13.7563,
    lng: 100.5018,
  });
  const [isLocating, setIsLocating] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/login?returnTo=/profile');
        return;
      }

      setUser(session.user);

      // ดึงข้อมูลจากตาราง users
      const { data: profile } = await supabase
        .from('users')
        .select('name, phone, lat, lng')
        .eq('id', session.user.id)
        .single();

      // ดึงที่อยู่จาก LocalStorage
      const savedAddress = localStorage.getItem('last_saved_address') || '';

      setFormData({
        name: profile?.name || session.user.user_metadata?.name || '',
        phone: profile?.phone || session.user.phone || '',
        address: savedAddress,
      });

      // ถ้ามีพิกัด ให้แสดงหมุดที่เดิม ถ้าไม่มีให้หาตำแหน่งปัจจุบัน
      if (profile?.lat && profile?.lng) {
        setLocation({ lat: Number(profile.lat), lng: Number(profile.lng) });
      } else if (navigator.geolocation) {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
            setIsLocating(false);
          },
          () => {
            setIsLocating(false);
          },
          { enableHighAccuracy: true }
        );
      }

      setLoading(false);
    };

    fetchProfile();
  }, [router, supabase]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      // 1. อัปเดตข้อมูลลงตาราง users
      const { error } = await supabase
        .from('users')
        .update({
          name: formData.name,
          phone: formData.phone,
          lat: location.lat.toString(),
          lng: location.lng.toString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // 2. อัปเดตข้อมูลลง LocalStorage
      localStorage.setItem('last_saved_address', formData.address);

      alert('บันทึกข้อมูลส่วนตัวสำเร็จ!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 md:px-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/orders" className="inline-flex items-center text-gray-500 hover:text-blue-600 mb-6 transition-colors">
          <ChevronLeft className="w-5 h-5 mr-1" /> กลับไปหน้าคำสั่งซื้อ
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" />
              ข้อมูลส่วนตัวและที่อยู่จัดส่ง
            </h1>
            <p className="text-gray-500 text-sm mt-1">อัปเดตข้อมูลสำหรับการจัดส่งในครั้งถัดไป</p>
          </div>

          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1"><User className="w-4 h-4 mr-2" /> ชื่อ-นามสกุล</label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ระบุชื่อผู้รับ" />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1"><Phone className="w-4 h-4 mr-2" /> เบอร์โทรศัพท์</label>
              <input required type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="08X-XXX-XXXX" />
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1"><MapPin className="w-4 h-4 mr-2" /> ที่อยู่จัดส่งรายละเอียด (บ้านเลขที่, ซอย)</label>
              <textarea required name="address" value={formData.address} onChange={handleChange} rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="รายละเอียดที่อยู่..." />
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1"><MapPin className="w-4 h-4 mr-2" /> ปักหมุดตำแหน่งจัดส่งประจำ</label>
              <p className="text-xs text-gray-500 mb-3">ตำแหน่งนี้จะถูกโหลดอัตโนมัติเมื่อคุณสั่งซื้อสินค้าในครั้งถัดไป</p>
              <div className="relative h-[300px] w-full rounded-xl overflow-hidden border border-gray-300">
                {isLocating ? (
                  <div className="absolute inset-0 z-10 bg-slate-50 flex items-center justify-center">
                    <p className="text-blue-600 font-medium animate-pulse">📍 กำลังค้นหาตำแหน่งปัจจุบัน...</p>
                  </div>
                ) : (
                  <CheckoutMap 
                    initialPosition={[location.lat, location.lng]} 
                    onLocationChange={(lat, lng) => setLocation({ lat, lng })} 
                  />
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={saving} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors shadow-sm flex items-center gap-2">
                <Save className="w-5 h-5" />
                {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
