import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import Navbar from '@/components/layouts/Navbar';

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
        <div className="pt-16">{children}</div>
      </body>
    </html>
  );
}
