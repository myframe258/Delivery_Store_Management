import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import Navbar from '@/components/layouts/Navbar';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'Batch Delivery Store Management',
  description: 'ระบบจัดการร้านค้าและจัดรอบการจัดส่งสินค้า',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <Navbar />
        {/* ปรับ Padding สำหรับ Desktop (pt-16) และ Mobile (pt-14 บน, pb-16 ล่าง) เพื่อไม่ให้เนื้อหาถูกเมนูบัง */}
        <div className="pt-14 pb-16 md:pt-16 md:pb-0">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
