export default function RiderBatchesPage() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">รอบการจัดส่งของฉัน (Rider)</h1>
      <p className="text-gray-600 text-sm">เลือก Batch เพื่อดูจุดจัดส่งตามลำดับ</p>
      {/* TODO: แสดงรายการ Batch ที่ได้รับมอบหมาย (assign ให้ driver_id) */}
    </div>
  );
}
