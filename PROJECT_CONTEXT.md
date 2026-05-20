# Project Context: Batch Delivery Store Management

## 1. Project Overview
ระบบบริหารจัดการร้านค้าแบบหลายสาขา (Multi-Branch) ที่ครอบคลุมตั้งแต่หน้าร้าน E-Commerce ไปจนถึงระบบจัดส่งแบบ **"ส่งเป็นรอบ" (Batch Delivery)**

**Key Features:**
- **Multi-branch Support:** แยกสินค้า สต็อก ออเดอร์ และรอบการจัดส่งออกจากกันตามแต่ละสาขา
- **Geofencing & Map Pinning:** ลูกค้าค้นหาสาขาที่ใกล้ที่สุด และปักหมุดแผนที่เพื่อระบุที่อยู่จัดส่งได้อย่างแม่นยำ
- **Route Optimization (TSP):** ระบบรวมกลุ่มออเดอร์ (Batching) และคำนวณเส้นทางจัดส่งที่สั้นที่สุดสำหรับคนขับ
- **Role-based Access:** แยกสิทธิ์ผู้ใช้งานเป็น Super Admin, Branch Admin, Rider และ Customer เพื่อการจัดการที่ปลอดภัยและเป็นระบบ

---

## 2. Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Database & Auth:** Supabase (ใช้ `@supabase/ssr` สำหรับ Next.js)
- **State Management:** Zustand (รองรับ LocalStorage persistence)
- **Mapping:** Leaflet.js (`react-leaflet`)

---

## 3. Database Schema (Latest)
โครงสร้างฐานข้อมูลหลักออกแบบให้รองรับ Multi-branch อย่างสมบูรณ์:
- `branches`: ข้อมูลสาขา (id, name, lat, lng, address)
- `products`: ข้อมูลสินค้ากลาง (id, name, price, description, image_url)
- `branch_inventory`: สต็อกสินค้าแยกตามสาขา (branch_id, product_id, stock_count, status)
- `public.users`: ข้อมูลผู้ใช้งาน โดยมีคอลัมน์ `role` (super_admin, branch_admin, rider, customer) เป็นหัวใจสำคัญในการจัดการสิทธิ์ (Role-based Authorization) และมี `branch_id` ระบุสาขาที่สังกัด
- `orders`: รายการสั่งซื้อของลูกค้า (customer_id, branch_id, total_price, lat, lng, status: 'pending'|'batched'|'delivered')
- `order_items`: รายละเอียดสินค้าในออเดอร์ (order_id, product_id, quantity, price_at_purchase)
- `delivery_batches`: รอบการจัดส่งของแต่ละสาขา (id, branch_id, driver_id, batch_status: 'pending'|'assigned'|'in_progress'|'completed')
- `batch_items`: ลำดับและจุดส่งในรอบ (batch_id, order_id, sequence_no, delivery_status: 'pending'|'delivered')

---

## 4. Current Progress (Completed 100%)
ระบบผ่านจุด MVP ในส่วนของ Core Flow เป็นที่เรียบร้อย:
- **Customer Flow:** สร้างหน้าค้นหาสาขา, เลือกร้านค้า, ระบบตะกร้าสินค้า (Cart), หน้า Checkout ที่สามารถปักหมุดที่อยู่บ้านลูกค้าได้อย่างแม่นยำ และหน้า Success
- **Admin Flow:** ระบบหน้าจัดรอบส่ง (`/branch-admin/batching`) ให้แอดมินสาขาสามารถดึงออเดอร์บนแผนที่ และเลือกรวมกลุ่มออเดอร์เพื่อสร้างเป็นรอบจัดส่งได้เรียบร้อย
- **Rider Flow:** หน้าจอสำหรับคนขับ (`/rider/batches`) รองรับการดูคิวงานตามลำดับ (`sequence_no`) บนแผนที่, มีฟีเจอร์กดปุ่มนำทางผ่าน Google Maps, และอัปเดตสถานะการส่งสำเร็จได้แบบ Real-time
- **UI/UX & Routing:** 
  - สร้างระบบ `Navbar` ที่สลับเมนูอัตโนมัติตาม Role ของผู้ใช้งาน (Guest/Customer/Admin/Rider)
  - รองรับ Mobile Layout (SafeArea) สำหรับ PWA โดยเว้นระยะ `pt-14` และ `pb-16` ไม่ให้เนื้อหาถูกบัง

---

## 5. Technical Quirks & Solved Issues
- **SSR Map Protection:** แก้ปัญหา Next.js 16 SSR แครชกับ Leaflet.js (`window is not defined`) ด้วยการแยก Component และใช้ `next/dynamic` พร้อมตั้งค่า `ssr: false`
- **Map Render Bug (Blank Screen):** แก้ปัญหาแผนที่ขาว โดยกำหนด Fixed Dimensions, ควบคุม Render Cycle ด้วย State `mounted`, และใช้ `key` บน `MapContainer` เพื่อบังคับ Re-render แผนที่ใหม่
- **Role-based Navigation & Protection:** สร้าง Route Guard อย่างแน่นหนาผ่าน Middleware และ `Navbar` เพื่อบังคับ Login เฉพาะจังหวะ Checkout และป้องกัน User ทะลุเข้าหน้าของ Role อื่น

---

## 6. Next Immediate Goals (ขั้นตอนถัดไป)
**ลำดับ 1: Route Optimization API** 
สร้างระบบเชื่อมต่อ Google Maps Directions API (`/api/optimize-route`) เพื่อคำนวณและจัดเรียงลำดับการส่งที่สั้นที่สุด (TSP) อัตโนมัติ พร้อมอัปเดต `sequence_no` ให้คนขับ

**ลำดับ 2: Branch Inventory Management** 
พัฒนาหน้าระบบหลังบ้าน (`/branch-admin/inventory`) ให้ผู้จัดการสาขาสามารถจัดการสต็อกและเปิด-ปิดสถานะสินค้าภายในสาขาตนเองได้

**ลำดับ 3: Type Safety & Security (RLS)** 
นำ Type ของ Supabase มาบังคับใช้ครอบตัวแปรที่ยังเป็น `any` และเขียน Row Level Security (RLS) Policies ใน Database เพื่อป้องกันการแอบเข้าถึงหรือแก้ไขข้อมูลข้ามสาขา (Client-side protection)