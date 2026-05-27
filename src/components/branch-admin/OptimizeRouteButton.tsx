'use client';

import { useState } from 'react';
import { optimizeBatchRoute, OptimizeRoutePayload } from '@/lib/api/optimizeRoute';

interface OptimizeRouteButtonProps {
  payload: OptimizeRoutePayload;
  onSuccess?: (optimizedOrders: any[]) => void;
}

export default function OptimizeRouteButton({ payload, onSuccess }: OptimizeRouteButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // เรียกใช้งานฟังก์ชันยิง API
      const result = await optimizeBatchRoute(payload);
      
      if (result.success) {
        alert('จัดเรียงเส้นทางสำเร็จ!');
        if (onSuccess) {
          // ส่งข้อมูลกลับไปให้ Component แม่ เพื่ออัปเดต UI (เช่น ลำดับคิว)
          onSuccess(result.optimizedOrders);
        }
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'เกิดข้อผิดพลาดในการจัดเรียงเส้นทาง';
      setError(errorMessage);
      alert('Error: ' + errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleOptimize}
        disabled={isLoading || payload.orders.length === 0}
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        {isLoading ? 'กำลังคำนวณเส้นทาง...' : 'คำนวณเส้นทางที่สั้นที่สุด (TSP)'}
      </button>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
