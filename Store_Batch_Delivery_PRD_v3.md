# Product Requirements Document (PRD) - Version 5 (Phase 2 In-Progress)
**Project Name:** Multi-Branch Store & Batch Delivery Management System  
**Document Status:** Phase 2 In-Progress

---

## 1. ข้อมูลภาพรวม (Project Overview)
สร้างระบบบริหารจัดการที่ครอบคลุมตั้งแต่การขายสินค้าหน้าร้าน (E-Commerce) ไปจนถึงการจัดส่งในรูปแบบ **"การส่งเป็นรอบ" (Batch Delivery)** โดยมีขีดความสามารถในการรองรับ **"หลายสาขา" (Multi-Branch)** เพื่อให้แต่ละสาขาสามารถจัดการสต็อกสินค้าและรอบการส่งของตนเองได้อย่างเป็นเอกเทศ พร้อมระบบคำนวณเส้นทางอัตโนมัติ (Route Optimization) เพื่อประหยัดเวลาและลดต้นทุน

---

## 2. กลุ่มผู้ใช้งาน (Target Users)
- **Super Admin (เจ้าของธุรกิจ):** จัดการภาพรวมระดับประเทศ เพิ่ม/ลบสาขา และจัดการบัญชีผู้ใช้งาน
- **Branch Admin (ผู้จัดการสาขา):** จัดการรายการสินค้า เปิด-ปิดสถานะ อัปเดตสต็อก และวางแผนจัดรอบส่งของสาขาตนเอง
- **Picker (พนักงานจัดของ):** ดูรอบการจัดส่ง และเตรียมสินค้าตามออเดอร์ที่ถูกจัดรอบไว้
- **Driver/Rider (คนขับรถ):** ดูคิวงานจัดส่งตามลำดับที่ระบบคำนวณให้ และใช้นำทางไปยังจุดหมาย
- **Customer (ลูกค้า):** ค้นหาสาขาใกล้บ้าน, เลือกซื้อสินค้า, ปักหมุดที่อยู่จัดส่ง, และติดตามสถานะออเดอร์

---

## 3. ระบบสิทธิ์และการเปลี่ยนหน้าอัตโนมัติ (Navigation & Auth Flow)
ระบบได้รับการออกแบบให้มี User Journey ที่ไร้รอยต่อ และไม่ต้องคอยพิมพ์ URL สลับหน้าเอง:

- **Public Access (โซนสาธารณะ):** 
  ระบบรองรับ Public Access ให้ลูกค้าเข้าชมร้านและเลือกสินค้าลงตะกร้าได้โดยไม่ต้อง Login

- **Auth Boundary (จุดบังคับล็อกอิน):** 
  บังคับ Login เฉพาะตอนกด 'ยืนยันการสั่งซื้อ' ในหน้า `/checkout` เท่านั้น
  - ต้องมีการจดจำ State ของตะกร้าสินค้า (ผ่าน `cartStore`)
  - **[Critical UX]** ระบบ `/login` ต้องรองรับการ Redirect กลับมาทำรายการต่อ เพื่อให้ลูกค้ากลับมาจ่ายเงินต่อได้ทันทีหลังล็อกอินสำเร็จ ป้องกันไม่ให้โดน Redirect ไปหน้า Dashboard ทั่วไป (Conversion Drop)

- **Role-Based Redirect (การแยกเส้นทางหลัง Login):**
  เมื่อเข้าสู่ระบบสำเร็จ ระบบจะตรวจสอบสิทธิ์ (`role`) และเปลี่ยนหน้าอัตโนมัติ:
  - `branch_admin` ➔ เด้งไปหน้าจัดการสต็อกหลังบ้าน (`/branch-admin/inventory`) หรือหน้าจัดรอบส่ง
  - `picker` ➔ เด้งไปหน้างานจัดเตรียมสินค้า (`/picker/dashboard`)
  - `rider` ➔ เด้งไปหน้างานจัดส่งของตนเอง (`/rider/batches`)
  - `customer` ➔ เด้งไปหน้า Checkout หรือหน้าติดตามออเดอร์

---

## 4. คุณสมบัติหลักที่ต้องมี (Core Features & Status)

### 4.1 สำหรับลูกค้า (Storefront & Checkout)
- **[Done 100%] Customer Flow:** หน้าร้านค้าแยกสาขา, ระบบตะกร้าสินค้า (Zustand), และหน้า Checkout ปักหมุดที่อยู่ลงแผนที่ (Leaflet)

### 4.2 สำหรับ Admin (Management Dashboard)
- **[Done 100%] Branch Admin Flow:** หน้าจัดรอบส่ง (Batching Dashboard) ที่ดึงออเดอร์มาสร้างรอบการจัดส่งผ่านแผนที่

### 4.3 สำหรับคนขับ (Rider Interface)
- **[Done 100%] Rider Flow:** หน้าจอ Mobile-friendly สำหรับคนขับ, ดูคิวงาน (Sequence), ปุ่มกดนำทาง Google Maps, และอัปเดตสถานะการส่งสำเร็จ

### 4.4 สำหรับ Super Admin และความปลอดภัย (Security & Master Data)
- **[Done 100%] Super Admin Master Data & Security:** สร้างหน้าจัดการสาขา/ผู้ใช้งาน และบังคับใช้ Row Level Security (RLS) ล็อกสิทธิ์การเข้าถึงข้อมูลระดับสาขา

### 4.5 ระบบชำระเงินและการแจ้งเตือน (Payments & Notifications)
- **[Done 100%] Payment Gateway Integration:** เชื่อมต่อระบบชำระเงิน (Omise/Stripe) รองรับ PromptPay QR และ Credit Card ลดการตรวจสลิปแบบ Manual
- **[Done 100%] Customer Notifications:** เชื่อมต่อ Line Messaging API / SMS ส่งแจ้งเตือนสถานะออเดอร์แบบ Real-time ให้ลูกค้า


## 5. แผนการพัฒนาใน Sprint ถัดไป (Next Sprints & Future Roadmap)
หลังจากระบบ Core Flow ของ MVP เสร็จสมบูรณ์ แผนการพัฒนาถัดไปจะมุ่งเน้นไปที่การสร้างรายได้ (Business Value), ความปลอดภัย, และการขยายระบบ (Scalability)

### Sprint N+1 (High Priority / Quick Wins)
- **Proof of Delivery & Rider Payouts:** ให้คนขับอัปโหลดรูปถ่ายหลักฐานการจัดส่งลง Supabase Storage พร้อมระบบคำนวณค่ารอบจัดส่งอัตโนมัติ
- **Centralized Analytics Dashboard:** แดชบอร์ดสรุปยอดขายแยกตามสาขาและสินค้าขายดี สำหรับผู้บริหาร
- **Redis Caching:** แคชข้อมูลแคตตาล็อกสินค้าและ Geofencing ด้วย Vercel KV/Redis ลดภาระ Database Read

### Sprint N+2 (Medium Priority / Scale-up)
- **Auto-Replenishment & Transfer:** ระบบแนะนำการโยกย้ายสต็อกข้ามสาขา และแจ้งเตือนสั่งของจากคลังอัตโนมัติ
- **AI-Powered Upselling & Forecasting:** ใช้ AI วิเคราะห์พฤติกรรมการซื้อเพื่อแนะนำสินค้าที่เกี่ยวข้อง และคาดการณ์จำนวนคนขับที่ต้องการในช่วง Peak Time

### Future Roadmap (Long-term Vision)
- **Customer Loyalty & Rewards:** ระบบสะสมแต้มสำหรับลูกค้าและการสร้างแคมเปญการตลาดระดับสาขา
- **Multi-Vehicle Routing:** รองรับการจัดเส้นทางแบบผสมผสานยานพาหนะ (เช่น รถมอเตอร์ไซค์, รถกระบะ) ตามขนาดหรือน้ำหนักของออเดอร์รวมใน Batch

## 6. เครื่องมือทางเทคนิค (Technical Stack)
- **Framework:** Next.js 16 (App Router)
- **UI & Styling:** Tailwind CSS v4, Lucide React, PWA SafeArea Config
- **Database & Auth:** Supabase (PostgreSQL) + `@supabase/ssr`
- **State Management:** Zustand
- **Maps & Routing:** Leaflet.js (`react-leaflet`), Google Maps Directions API
- **Data Processing:** `xlsx` สำหรับนำเข้า/ส่งออกข้อมูล Excel
- **Deployment Environment:** Vercel / Node.js Runtime