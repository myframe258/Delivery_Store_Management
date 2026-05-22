# Product Requirements Document (PRD) - Version 3
**Project Name:** Multi-Branch Store & Batch Delivery Management System  
**Document Status:** Latest Production Draft

---

## 1. ข้อมูลภาพรวม (Project Overview)
สร้างระบบบริหารจัดการที่ครอบคลุมตั้งแต่การขายสินค้าหน้าร้าน (E-Commerce) ไปจนถึงการจัดส่งในรูปแบบ **"การส่งเป็นรอบ" (Batch Delivery)** โดยมีขีดความสามารถในการรองรับ **"หลายสาขา" (Multi-Branch)** เพื่อให้แต่ละสาขาสามารถจัดการสต็อกสินค้าและรอบการส่งของตนเองได้อย่างเป็นเอกเทศ พร้อมระบบคำนวณเส้นทางอัตโนมัติ (Route Optimization) เพื่อประหยัดเวลาและลดต้นทุน

---

## 2. กลุ่มผู้ใช้งาน (Target Users)
- **Super Admin (เจ้าของธุรกิจ):** จัดการภาพรวมระดับประเทศ เพิ่ม/ลบสาขา และจัดการบัญชีผู้ใช้งาน
- **Branch Admin (ผู้จัดการสาขา):** จัดการรายการสินค้า เปิด-ปิดสถานะ อัปเดตสต็อก และวางแผนจัดรอบส่งของสาขาตนเอง
- **Driver/Rider (คนขับรถ):** ดูคิวงานจัดส่งตามลำดับที่ระบบคำนวณให้ และใช้นำทางไปยังจุดหมาย
- **Customer (ลูกค้า):** ค้นหาสาขาใกล้บ้าน, เลือกซื้อสินค้า, ปักหมุดที่อยู่จัดส่ง, และติดตามสถานะออเดอร์

---

## 3. ระบบสิทธิ์และการเปลี่ยนหน้าอัตโนมัติ (Navigation & Auth Flow)
ระบบได้รับการออกแบบให้มี User Journey ที่ไร้รอยต่อ และไม่ต้องคอยพิมพ์ URL สลับหน้าเอง:

- **Public Access (โซนสาธารณะ):** 
  ลูกค้าทั่วไป (Guest) สามารถเข้าชมหน้าแรก (`/` - ค้นหาสาขา) และหน้าร้านค้าของสาขานั้นๆ (`/[branchId]`) รวมถึงเพิ่มสินค้าลงตะกร้าได้ทันที **โดยไม่ต้องล็อกอิน**

- **Auth Boundary (จุดบังคับล็อกอิน):** 
  ระบบจะดักจับและบังคับ Login **เฉพาะเมื่อกด "ยืนยันการสั่งซื้อ" ในหน้า `/checkout` เท่านั้น** 
  - ต้องมีการจดจำ State ของตะกร้าสินค้า (ผ่าน `cartStore`)
  - รองรับระบบ Query Parameter `?returnTo=/checkout` เพื่อให้ลูกค้าถูกเด้งกลับมาจ่ายเงินต่อได้ทันทีหลังล็อกอินสำเร็จ ป้องกัน Conversion Drop

- **Role-Based Redirect (การแยกเส้นทางหลัง Login):**
  เมื่อเข้าสู่ระบบสำเร็จ ระบบจะตรวจสอบสิทธิ์ (`role`) และเปลี่ยนหน้าอัตโนมัติ:
  - `branch_admin` ➔ เด้งไปหน้าจัดการสต็อกหลังบ้าน (`/branch-admin/inventory`) หรือหน้าจัดรอบส่ง
  - `rider` ➔ เด้งไปหน้างานจัดส่งของตนเอง (`/rider/batches`)
  - `customer` ➔ เด้งไปหน้า Checkout หรือหน้าติดตามออเดอร์

---

## 4. คุณสมบัติหลักที่ต้องมี (Core Features & Status)

### 4.1 สำหรับลูกค้า (Storefront & Checkout)
- **[Done 100%] Branch Locator & Catalog:** ค้นหาสาขาผ่าน Leaflet.js และดึงรายการสินค้าพร้อมสเตทการแยกสต็อกรายสาขาได้อย่างถูกต้อง
- **[Done 100%] Address Pinning:** หน้า Checkout ลูกค้าสามารถเลื่อนหมุด (Draggable Marker) เพื่อบันทึกพิกัดจัดส่งได้อย่างแม่นยำ
- **[Done 100%] Shopping Cart:** ระบบตะกร้าสินค้าจัดการผ่าน Zustand เก็บ State ได้แม้อยู่ในสถานะ Guest
- **[Pending] Order Tracking:** หน้าจอติดตามสถานะออเดอร์สำหรับลูกค้า (Pending -> Batched -> Delivered)

### 4.2 สำหรับ Admin (Management Dashboard)
- **[Done 100%] Responsive Navbar:** แท็บเมนูสลับอัตโนมัติตาม Role ของผู้ใช้งาน รองรับ Mobile Layout อย่างสมบูรณ์ (SafeArea `pt-14`, `pb-16` ป้องกันการทับซ้อนของ UI)
- **[Done 100%] Branch Admin Batching:** Interactive Map ที่ให้แอดมินลากหรือคลิกเลือกออเดอร์ที่ค้างส่งบนแผนที่ เพื่อสร้างเป็นรอบจัดส่ง (Batch) ได้ทันที
- **[Pending] Super Admin Master Data:** หน้าจอ `/super-admin/*` สำหรับจัดการสาขา เพิ่มสินค้าส่วนกลาง และมอบหมาย Role ให้พนักงาน

### 4.3 สำหรับคนขับ (Rider Interface)
- **[Done 100%] Rider App:** หน้าจอ PWA ออกแบบเพื่อคนขับโดยเฉพาะ แสดงคิวส่งตามลำดับ (`sequence_no`)
- **[Done 100%] Real-time Delivery & Navigation:** คนขับสามารถกดปุ่มเปิด Google Maps นำทาง และอัปเดตสถานะการจัดส่ง "สำเร็จ" ได้แบบรายจุดหมาย

---

## 5. แผนการพัฒนาใน Sprint ถัดไป (Next Sprints & Roadmap)

**Sprint ถัดไป (High Priority): Route Optimization API**
- สร้าง API (`/api/optimize-route`) เชื่อมต่อกับ Google Maps Directions API 
- ใช้พารามิเตอร์ `optimize: true` เพื่อคำนวณและจัดลำดับจุดส่งที่สั้นที่สุด (TSP - Traveling Salesman Problem) 
- นำลำดับที่จัดเรียงใหม่มาอัปเดตลงฟิลด์ `sequence_no` ให้คนขับแบบอัตโนมัติ

**Sprint ถัดไป (Medium Priority): Branch Inventory Management**
- พัฒนาหน้าระบบหลังบ้าน (`/branch-admin/inventory`) ให้แอดมินสาขาสามารถปรับลด/เพิ่มสต็อก
- รองรับการตั้งค่า เปิด-ปิด (Active/Inactive) การขายสินค้าชนิดนั้นๆ เฉพาะสาขาตนเอง

**Technical Debt Clean-up (งานปรับปรุงโค้ดหลังบ้าน):**
- ปรับแก้การดึงข้อมูล `price` และพิกัดจาก Database ที่เป็น String ให้กลายเป็น Numeric เพื่อให้คำนวณได้ถูกต้อง
- ยกเลิกการใช้ `any` ใน TypeScript โดยดึงระบบ **Supabase Database Types** มาครอบตัวแปรทั้งหมดเพื่อรับประกัน Type Safety
- นำระบบ **Row Level Security (RLS)** มาปรับใช้ในฐานข้อมูล เพื่อป้องกันการแอบแก้ไขข้อมูลข้ามสาขาผ่าน Client-side

---

## 6. เครื่องมือทางเทคนิค (Technical Stack)
- **Framework:** Next.js 16 (App Router)
- **UI & Styling:** Tailwind CSS v4, Lucide React, PWA SafeArea Config
- **Database & Auth:** Supabase (PostgreSQL) + `@supabase/ssr`
- **State Management:** Zustand
- **Maps & Routing:** Leaflet.js (`react-leaflet`), Google Maps Directions API
- **Deployment Environment:** Vercel / Node.js Runtime