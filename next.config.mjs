/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co', // เผื่อการใช้งานรูปภาพจาก Supabase Storage ในอนาคต
      },
    ],
  },
};

export default nextConfig;