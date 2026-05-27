'use client';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { User, Phone, MapPin, Save, ChevronLeft, Plus, Home, Store, Map as MapIcon, Edit2, Trash2, CheckCircle, X, Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import toast from 'react-hot-toast';
import ConfirmModal from '@/components/ui/ConfirmModal';

// โหลด CheckoutMap แบบ Dynamic (ปิด SSR) ป้องกัน Window is not defined
const CheckoutMap = dynamic(() => import('@/components/maps/CheckoutMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] bg-slate-100 flex items-center justify-center rounded-xl animate-pulse">
      <p className="text-slate-500 font-medium">กำลังโหลดแผนที่...</p>
    </div>
  ),
});

interface Address {
  id: string;
  title: string;
  address_text: string;
  lat: number;
  lng: number;
  is_default: boolean;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // Profile State
  const [profileData, setProfileData] = useState({ name: '', phone: '' });
  
  // Address Book State
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState<Partial<Address>>({ title: 'บ้าน', address_text: '', is_default: false });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, id: '', isDefault: false });

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

  const fetchProfileAndAddresses = async () => {
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
      .select('name, phone')
      .eq('id', session.user.id)
      .single();

    // ดึงสมุดที่อยู่จากตาราง user_addresses
    const { data: userAddresses } = await supabase
      .from('user_addresses')
      .select('*')
      .eq('user_id', session.user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    setProfileData({
      name: profile?.name || session.user.user_metadata?.name || session.user.user_metadata?.full_name || '',
      phone: profile?.phone || session.user.phone || session.user.user_metadata?.phone || '',
    });

    if (userAddresses) {
      setAddresses(userAddresses as Address[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfileAndAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, supabase]);

  // --- จัดการข้อมูลส่วนตัว ---
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from('users')
        .update({
          name: profileData.name,
          phone: profileData.phone,
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('บันทึกข้อมูลส่วนตัวสำเร็จ!');
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  // --- จัดการสมุดที่อยู่ ---
  const openModal = (address?: Address) => {
    if (address) {
      setAddressForm(address);
      setLocation({ lat: address.lat, lng: address.lng });
    } else {
      setAddressForm({ title: 'บ้าน', address_text: '', is_default: addresses.length === 0 });
      if (navigator.geolocation) {
        handleGetCurrentLocation();
      }
    }
    setIsAddressModalOpen(true);
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => { 
          handleLocationChangeAndFetchAddress(pos.coords.latitude, pos.coords.longitude);
          setIsLocating(false); 
        },
        () => { 
          toast.error('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาเปิดการเข้าถึงพิกัด (GPS)');
          setIsLocating(false); 
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleLocationChangeAndFetchAddress = async (lat: number, lng: number) => {
    setLocation({ lat, lng });
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=th`);
      const data = await res.json();
      if (data && data.display_name) {
        setAddressForm(prev => ({ ...prev, address_text: data.display_name }));
      }
    } catch (err) {
      console.error('Reverse geocoding error:', err);
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingAddress(true);

    try {
      if (addressForm.is_default) {
        await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', user.id);
      }

      const payload = {
        user_id: user.id,
        title: addressForm.title,
        address_text: addressForm.address_text,
        lat: location.lat,
        lng: location.lng,
        is_default: addressForm.is_default || addresses.length === 0,
      };

      if (addressForm.id) {
        const { error } = await supabase.from('user_addresses').update(payload).eq('id', addressForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('user_addresses').insert([payload]);
        if (error) throw error;
      }

      setIsAddressModalOpen(false);
      fetchProfileAndAddresses();
      toast.success('บันทึกที่อยู่เรียบร้อยแล้ว');
    } catch (error: any) {
      toast.error('บันทึกที่อยู่ไม่สำเร็จ: ' + error.message);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddressClick = (id: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error('ไม่สามารถลบที่อยู่หลักได้ กรุณาตั้งที่อยู่อื่นเป็นที่อยู่หลักก่อน');
      return;
    }
    setDeleteConfirmModal({ isOpen: true, id, isDefault });
  };

  const executeDeleteAddress = async () => {
    const { id } = deleteConfirmModal;
    setDeleteConfirmModal({ isOpen: false, id: '', isDefault: false });
    
    try {
      const { error } = await supabase.from('user_addresses').delete().eq('id', id);
      if (error) throw error;
      setAddresses(addresses.filter(a => a.id !== id));
      toast.success('ลบที่อยู่เรียบร้อยแล้ว');
    } catch (error: any) {
      toast.error('ลบที่อยู่ไม่สำเร็จ: ' + error.message);
    }
  };

  const getIconForTitle = (title: string) => {
    if (title === 'บ้าน') return <Home className="w-5 h-5 text-blue-500" />;
    if (title === 'ร้านขายของ') return <Store className="w-5 h-5 text-emerald-500" />;
    return <MapIcon className="w-5 h-5 text-orange-500" />;
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
              ข้อมูลส่วนตัว
            </h1>
            <p className="text-gray-500 text-sm mt-1">อัปเดตข้อมูลสำหรับติดต่อ</p>
          </div>

          <form onSubmit={handleSaveProfile} className="p-6 space-y-4 border-b border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1"><User className="w-4 h-4 mr-2" /> ชื่อ-นามสกุล</label>
                <input required type="text" name="name" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="ระบุชื่อผู้รับ" />
              </div>
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1"><Phone className="w-4 h-4 mr-2" /> เบอร์โทรศัพท์</label>
                <input required type="tel" name="phone" pattern="^0[0-9]{9}$" title="กรุณากรอกเบอร์โทรศัพท์ 10 หลัก ที่ขึ้นต้นด้วย 0" maxLength={10} value={profileData.phone} onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setProfileData({...profileData, phone: val});
                }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="08XXXXXXXX" />
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={savingProfile} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400 text-white font-medium rounded-xl transition shadow-sm flex items-center gap-2">
                <Save className="w-5 h-5" />
                {savingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูลส่วนตัว'}
              </button>
            </div>
          </form>

          {/* สมุดที่อยู่ */}
          <div className="p-6 bg-gray-50/50">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  สมุดที่อยู่ของฉัน
                </h2>
                <p className="text-gray-500 text-sm mt-1">จัดการที่อยู่สำหรับจัดส่งสินค้า</p>
              </div>
              <button type="button" onClick={() => openModal()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-1.5 transition">
                <Plus className="w-4 h-4" /> เพิ่มที่อยู่
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="text-center py-10 bg-white border border-gray-200 border-dashed rounded-xl">
                <MapIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">คุณยังไม่มีที่อยู่ที่บันทึกไว้</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div key={addr.id} className={`p-4 rounded-xl border-2 transition-all relative group ${addr.is_default ? 'border-blue-500 bg-blue-50/30' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2 font-bold text-gray-800">
                        {getIconForTitle(addr.title)} {addr.title}
                        {addr.is_default && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> หลัก</span>}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => openModal(addr)} className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-md transition" title="แก้ไข">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!addr.is_default && (
                          <button type="button" onClick={() => handleDeleteAddressClick(addr.id, addr.is_default)} className="p-1.5 text-red-600 hover:bg-red-100 rounded-md transition" title="ลบ">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{addr.address_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Address Form Modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-lg font-bold text-gray-800">{addressForm.id ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่'}</h2>
              <button onClick={() => setIsAddressModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition" title="ปิด"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleSaveAddress} className="p-5 overflow-y-auto flex-grow space-y-5">
              {/* ประเภทที่อยู่ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทที่อยู่</label>
                <div className="flex gap-3">
                  {['บ้าน', 'ร้านขายของ', 'อื่นๆ'].map(type => (
                    <label key={type} className="flex-1 cursor-pointer">
                      <input type="radio" name="title" value={type} checked={addressForm.title === type} onChange={(e) => setAddressForm({...addressForm, title: e.target.value})} className="peer sr-only" />
                      <div className="p-2.5 border-2 rounded-xl text-center text-sm font-medium text-gray-600 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-700 hover:bg-gray-50 transition">
                        {type}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* รายละเอียด */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียดที่อยู่ (บ้านเลขที่, ซอย)</label>
                <textarea required value={addressForm.address_text} onChange={(e) => setAddressForm({...addressForm, address_text: e.target.value})} rows={3} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="รายละเอียดที่อยู่..." />
              </div>

              {/* แผนที่ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ปักหมุดตำแหน่งจัดส่ง</label>
                <div className="relative h-[250px] w-full rounded-xl overflow-hidden border border-gray-300">
                  {isLocating ? (
                    <div className="absolute inset-0 z-10 bg-slate-50 flex items-center justify-center">
                      <p className="text-blue-600 font-medium animate-pulse">📍 กำลังค้นหาตำแหน่งปัจจุบัน...</p>
                    </div>
                  ) : (
                    <>
                    <CheckoutMap 
                      initialPosition={[location.lat, location.lng]} 
                    onLocationChange={handleLocationChangeAndFetchAddress}
                    />
                  <button
                    type="button"
                    onClick={handleGetCurrentLocation}
                    className="absolute bottom-4 right-4 z-[400] bg-white text-blue-600 p-3 rounded-full shadow-lg border border-gray-200 hover:bg-blue-50 transition-all flex items-center justify-center active:scale-95"
                    title="ตำแหน่งปัจจุบัน"
                  >
                    <Navigation className="w-5 h-5" />
                  </button>
                  </>
                  )}
                </div>
              </div>

              {/* ตั้งเป็นค่าเริ่มต้น */}
              {!addressForm.is_default && (
                <label className="flex items-center cursor-pointer gap-2 select-none">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={addressForm.is_default} onChange={(e) => setAddressForm({...addressForm, is_default: e.target.checked})} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${addressForm.is_default ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${addressForm.is_default ? 'transform translate-x-4' : ''}`}></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700">ตั้งเป็นที่อยู่หลักสำหรับการจัดส่ง</span>
                </label>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddressModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition">ยกเลิก</button>
                <button type="submit" disabled={savingAddress} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition shadow-sm">
                  {savingAddress ? 'กำลังบันทึก...' : 'บันทึกที่อยู่'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ยืนยันการลบที่อยู่ */}
      <ConfirmModal
        isOpen={deleteConfirmModal.isOpen}
        title="ยืนยันการลบที่อยู่"
        message="คุณต้องการลบที่อยู่นี้ออกจากสมุดที่อยู่ใช่หรือไม่?"
        onConfirm={executeDeleteAddress}
        onCancel={() => setDeleteConfirmModal({ isOpen: false, id: '', isDefault: false })}
        isDestructive={true}
      />
    </div>
  );
}
