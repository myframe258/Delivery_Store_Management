import type { Metadata } from 'next';

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
      <body>{children}</body>
    </html>
  );
}