'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useBranchStore, type Branch } from '@/store/branchStore'; 
import { Store, ArrowRight, MapPin, MapPinOff } from 'lucide-react';

interface BranchListProps {
  branches: Branch[];
  autoRedirectEnabled?: boolean;
  className?: string;
}

// Haversine formula to calculate distance between two points on Earth in kilometers
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

export default function BranchList({ branches, autoRedirectEnabled = false, className }: BranchListProps) {
  const router = useRouter();
  // Select actions individually to prevent unnecessary re-renders and infinite loops.
  // This is more stable than selecting an object.
  const setActiveBranchId = useBranchStore((state) => state.setActiveBranchId);
  const setUserLocation = useBranchStore((state) => state.setUserLocation);
  const setNearestBranch = useBranchStore((state) => state.setNearestBranch);

  const [status, setStatus] = useState<'idle' | 'locating' | 'denied' | 'no_branch_nearby' | 'done'>(autoRedirectEnabled ? 'locating' : 'idle');

  const handleSelectBranch = useCallback((branchId: string | number, isAutoRedirect = false) => {
    if (setActiveBranchId) {
      setActiveBranchId(branchId.toString());
    }
    if (isAutoRedirect) {
      sessionStorage.setItem('autoRedirected', 'true');
    }
    router.push(`/${branchId}`);
  }, [router, setActiveBranchId]);

  const requestGeolocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setStatus('done');
      return;
    }

    setStatus('locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (setUserLocation) setUserLocation({ lat: latitude, lng: longitude });
        
        // Refactor: Use `reduce` for a more robust and functional way to find the nearest branch.
        // This avoids control-flow analysis issues with TypeScript in complex callbacks.
        const nearest = branches.reduce(
          (acc: { branch: Branch | null; distance: number }, currentBranch: Branch) => {
            const distance = getDistance(latitude, longitude, currentBranch.lat, currentBranch.lng);
            if (distance < acc.distance) {
              return { branch: currentBranch, distance: distance };
            }
            return acc;
          },
          { branch: null, distance: Infinity }
        );

        const nearestBranch = nearest.branch;
        const minDistance = nearest.distance;

        if (setNearestBranch) setNearestBranch(nearestBranch);

        const MAX_DISTANCE_KM = 15; // กำหนดรัศมีสำหรับการ Redirect อัตโนมัติ (15 กม.)

        // With the `reduce` approach, this simple check is now perfectly clear to the compiler.
        if (nearestBranch && minDistance <= MAX_DISTANCE_KM) {
          handleSelectBranch(nearestBranch.id, true);
        } else {
          setStatus('no_branch_nearby');
          setTimeout(() => setStatus('done'), 3000);
        }
      },
      (error) => {
        console.warn("Geolocation error:", error.message);
        if (setUserLocation) setUserLocation(null);
        if (setNearestBranch) setNearestBranch(null);
        
        if (error.code === error.PERMISSION_DENIED) {
          setStatus('denied');
        } else {
          setStatus('done');
        }
      }
    );
  }, [branches, handleSelectBranch, setNearestBranch, setUserLocation]);

  useEffect(() => {
    if (!autoRedirectEnabled || typeof window === 'undefined' || !branches || branches.length === 0) {
      setStatus('done');
      return;
    }

    if (sessionStorage.getItem('autoRedirected') === 'true') {
      setStatus('done');
      return;
    }

    requestGeolocation();
  }, [autoRedirectEnabled, branches, requestGeolocation]);

  if (status === 'locating') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm h-full min-h-[300px]">
        <MapPin className="w-10 h-10 text-blue-500 animate-bounce mb-4" />
        <h3 className="font-bold text-lg text-slate-800">กำลังค้นหาสาขาใกล้คุณ...</h3>
        <p className="text-sm text-slate-500 mt-1">กรุณาอนุญาตให้เบราว์เซอร์เข้าถึงตำแหน่งของคุณ</p>
      </div>
    );
  }

  if (status === 'no_branch_nearby') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm h-full min-h-[300px]">
        <MapPin className="w-10 h-10 text-slate-400 mb-4" />
        <h3 className="font-bold text-lg text-slate-800">ไม่พบสาขาในรัศมี 15 กม.</h3>
        <p className="text-sm text-slate-500 mt-1">กำลังแสดงสาขาทั้งหมดให้คุณเลือก...</p>
      </div>
    );
  }

  if (status === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm h-full min-h-[300px]">
        <MapPinOff className="w-10 h-10 text-red-500 mb-4" />
        <h3 className="font-bold text-lg text-slate-800">ไม่สามารถเข้าถึงตำแหน่งได้</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          กรุณาอนุญาตให้เข้าถึงตำแหน่งเพื่อค้นหาสาขาที่ใกล้ที่สุดโดยอัตโนมัติ
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={requestGeolocation}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-md shadow-blue-200 active:scale-95"
          >
            ลองอีกครั้ง
          </button>
          <button
            onClick={() => setStatus('done')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-6 py-2.5 rounded-xl transition-colors active:scale-95"
          >
            เลือกสาขาเอง
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={className || 'space-y-4'}>
      {branches?.map((branch) => (
        <div 
          key={branch.id} 
          onClick={() => handleSelectBranch(branch.id, false)}
          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-300 cursor-pointer group flex flex-col justify-between h-full relative overflow-hidden"
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                <Store className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">{branch.name}</h3>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2 mb-4">{branch.address || 'ไม่มีข้อมูลที่อยู่'}</p>
          </div>
          
          <div className="w-full flex items-center justify-center gap-2 bg-slate-50 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-700 py-3 rounded-xl text-sm font-semibold transition-colors border border-slate-100 group-hover:border-blue-100 mt-auto">
            เข้าสู่หน้าร้านค้า
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </div>
        </div>
      ))}
    </div>
  );
}