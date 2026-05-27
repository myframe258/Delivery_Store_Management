# Product Requirements Document (PRD) - Version 5
**Project Name:** Multi-Branch Store & Batch Delivery Management System  
**Document Status:** Latest Production Draft (Updated with Audit Report)

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
  ลูกค้าทั่วไป (Guest) สามารถเข้าชมหน้าแรก (`/` - ค้นหาสาขา) และหน้าร้านค้าของสาขานั้นๆ (`/[branchId]`) รวมถึงเพิ่มสินค้าลงตะกร้าได้ทันที **โดยไม่ต้องล็อกอิน**

- **Auth Boundary (จุดบังคับล็อกอิน):** 
  ระบบจะดักจับและบังคับ Login **เฉพาะเมื่อกด "ยืนยันการสั่งซื้อ" ในหน้า `/checkout` เท่านั้น** 
  - ต้องมีการจดจำ State ของตะกร้าสินค้า (ผ่าน `cartStore`)
  - **[Critical UX]** ระบบ `/login` ต้องดักจับและรองรับ Query Parameter `?returnTo=/checkout` เพื่อให้ลูกค้าถูกเด้งกลับมาจ่ายเงินต่อได้ทันทีหลังล็อกอินสำเร็จ ป้องกันไม่ให้โดน Redirect ไปหน้า Dashboard ทั่วไป (Conversion Drop)

- **Role-Based Redirect (การแยกเส้นทางหลัง Login):**
  เมื่อเข้าสู่ระบบสำเร็จ ระบบจะตรวจสอบสิทธิ์ (`role`) และเปลี่ยนหน้าอัตโนมัติ:
  - `branch_admin` ➔ เด้งไปหน้าจัดการสต็อกหลังบ้าน (`/branch-admin/inventory`) หรือหน้าจัดรอบส่ง
  - `picker` ➔ เด้งไปหน้างานจัดเตรียมสินค้า (`/picker/dashboard`)
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
  *(หมายเหตุ: ต้องเพิ่มเมนู "จัดการสาขา" และ "จัดการผู้ใช้" สำหรับ Super Admin ลงใน Navbar เพื่อลด UX Gap สำหรับผู้ดูแลระบบ)*
- **[Done 100%] Branch Admin Batching:** Interactive Map ที่ให้แอดมินลากหรือคลิกเลือกออเดอร์ที่ค้างส่งบนแผนที่ เพื่อสร้างเป็นรอบจัดส่ง (Batch) ได้ทันที
- **[Done 100%] Route Optimization API:** ระบบคำนวณเส้นทางและจัดลำดับจุดส่งอัตโนมัติด้วย Google Maps Directions API (TSP)
- **[Done 100%] Branch Inventory:** ระบบให้ผู้จัดการสาขาอัปเดตสต็อกและสถานะเปิด/ปิดการขายสินค้า
- **[Done 100%] Super Admin Products:** หน้าจอจัดการฐานข้อมูลสินค้าส่วนกลาง, นำเข้า/ส่งออกด้วย Excel (Bulk Update), อัปโหลดรูปขึ้น Storage และระบบ Soft Delete (`is_active`)
- **[Pending] Super Admin Master Data (Branch & User):** หน้าจอเพิ่ม/ลบสาขา และกำหนด Role ผู้ใช้งาน

### 4.3 สำหรับคนขับ (Rider Interface)
- **[Done 100%] Rider App:** หน้าจอ PWA ออกแบบเพื่อคนขับโดยเฉพาะ แสดงคิวส่งตามลำดับ (`sequence_no`)
- **[Done 100%] Real-time Delivery & Navigation:** คนขับสามารถกดปุ่มเปิด Google Maps นำทาง และอัปเดตสถานะการจัดส่ง "สำเร็จ" ได้แบบรายจุดหมาย

---

## 5. แผนการพัฒนาใน Sprint ถัดไป (Next Sprints & Roadmap)

**ลำดับที่ 1 (High Priority): Super Admin Master Data**
- เพิ่มหน้าต่างสรุปยอดขายและการจัดส่ง (Analytics) สำหรับ Branch Admin และ Super Admin

**Technical Debt & Security Clean-up (ด่วนมาก):**
- **🚨 Row Level Security (RLS):** ต้องรีบเพิ่ม RLS Policy ใน Supabase ทันที เพื่อป้องกัน Hacker ยิง API ฝั่ง Client-side (เช่น `.insert()`, `.update()` ในหน้า Batching/Inventory) ข้ามสาขาหรือเปลี่ยนแปลงข้อมูลสำคัญ
- **Type Safety:** ยกเลิกการใช้ `any` ใน TypeScript (เช่น `[branchId]/page.tsx`, `RiderBatchClient.tsx`) โดยใช้คำสั่ง Generate Types จาก Supabase Database มาครอบตัวแปรทั้งหมดเพื่อรับประกัน Type Safety
- **Role Syncing Optimization:** ตรวจสอบ PostgreSQL Trigger ที่ทำหน้าที่ Sync `role` ลง `raw_app_meta_data` ให้สมบูรณ์ 100% เพื่อที่จะได้ลบการยิง Query ดึง Role ซ้ำซ้อนใน `Navbar.tsx` ช่วยลดภาระฐานข้อมูล

---

## 6. เครื่องมือทางเทคนิค (Technical Stack)
- **Framework:** Next.js 16 (App Router)
- **UI & Styling:** Tailwind CSS v4, Lucide React, PWA SafeArea Config
- **Database & Auth:** Supabase (PostgreSQL) + `@supabase/ssr`
- **State Management:** Zustand
- **Maps & Routing:** Leaflet.js (`react-leaflet`), Google Maps Directions API
- **Data Processing:** `xlsx` สำหรับนำเข้า/ส่งออกข้อมูล Excel
- **Deployment Environment:** Vercel / Node.js Runtime