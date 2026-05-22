# Project Context: Batch Delivery & Store Management System

## 1. Project Overview (ภาพรวมโครงการ)
ระบบบริหารจัดการร้านค้าแบบหลายสาขา (Multi-Branch) ที่ครอบคลุมตั้งแต่หน้าร้าน E-Commerce ไปจนถึงระบบจัดส่งแบบ **"ส่งเป็นรอบ" (Batch Delivery)** โดยมีเป้าหมายหลักในการเพิ่มประสิทธิภาพการจัดส่งด้วยการรวมกลุ่มออเดอร์ (Batching) และระบบคำนวณเส้นทางอัตโนมัติ (Route Optimization) เพื่อประหยัดเวลาและลดต้นทุนค่าน้ำมัน

## 2. Tech Stack
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Database & Auth:** Supabase (ใช้ `@supabase/ssr` สำหรับ Next.js)
- **State Management:** Zustand
- **Mapping:** Leaflet.js (`react-leaflet`)

## 3. Database Schema (Latest)
โครงสร้างฐานข้อมูลหลักถูกออกแบบมาเพื่อรองรับระบบ Multi-branch และการจัดส่งโดยเฉพาะ:
- `branches`: เก็บข้อมูลสาขา (id, name, lat, lng, address)
- `products`: ข้อมูลสินค้าส่วนกลาง (id, name, price, description, image_url)
- `branch_inventory`: จัดการสต็อกสินค้าแยกตามสาขา (branch_id, product_id, stock_count, status)
- `public.users`: ตารางผู้ใช้งาน **(หัวใจสำคัญคือคอลัมน์ `role` ใช้จัดการสิทธิ์ระดับ Super Admin, Branch Admin, Rider, Customer และมี `branch_id` ระบุสังกัดสาขา)**
- `orders`: รายการคำสั่งซื้อของลูกค้า (customer_id, branch_id, total_price, lat, lng, status: pending | batched | delivered)
- `order_items`: รายละเอียดสินค้าภายในออเดอร์
- `delivery_batches`: รอบการจัดส่งของแต่ละสาขา (id, branch_id, driver_id, batch_status)
- `batch_items`: ลำดับและจุดส่งในแต่ละรอบจัดส่ง (batch_id, order_id, sequence_no, delivery_status)

## 4. Current Progress (Completed 100%)
ระบบผ่านจุด MVP (Minimum Viable Product) ในส่วนของ Core Flow สำคัญดังนี้:
- **Customer Flow:** สร้างหน้าค้นหาและเลือกร้านค้า, ระบบตะกร้าสินค้า (Cart Store), หน้า Checkout ที่รองรับการปักหมุดแผนที่บ้านลูกค้าได้อย่างแม่นยำ และหน้า Success
- **Admin Flow:** ระบบหน้าจัดรอบส่ง (`/branch-admin/batching`) ที่ Branch Admin สามารถดึงออเดอร์ที่ยังไม่ส่งมาแสดงบนแผนที่ และใช้เครื่องมือเลือกออเดอร์เพื่อสร้างรอบจัดส่ง (Batch) ได้ทันที
- **Rider Flow:** หน้าจอการทำงานสำหรับคนขับ (`/rider/batches`) แสดงคิวงานส่งตามลำดับ (`sequence_no`), มีแผนที่ปักหมุดจุดส่ง, ปุ่มกดนำทางไปยังเป้าหมายผ่าน Google Maps และอัปเดตสถานะการส่งรายจุด
- **UI/UX & Routing:** 
  - ระบบ `Navbar` สลับเมนูอัตโนมัติตาม Role ของผู้ใช้งาน (Guest/Customer/Admin/Rider)
  - รองรับ Mobile Layout (SafeArea) ปรับ Padding เว้นระยะหน้าจอเพื่อไม่ให้ถูกเมนูหรือขอบมือถือบัง

## 5. Technical Quirks & Solved Issues
- **SSR Map Protection:** แก้ปัญหา Next.js 16 แครชตอน Render ฝั่ง Server กับ Leaflet.js (`window is not defined`) ด้วยการแยก Component แผนที่และใช้ `next/dynamic` ควบคู่กับการตั้งค่า `ssr: false`
- **Map Render Bug (Blank Screen):** แก้ปัญหาแผนที่โหลดหน้าขาว ด้วยการกำหนด Fixed Dimensions, ควบคุม Render Cycle ด้วย State `mounted`, และใช้ `key` บน `MapContainer` เพื่อบังคับให้แผนที่ Re-render อย่างถูกต้อง
- **Role-based Navigation & Protection:** สร้าง Route Guard ที่หนาแน่นผ่าน `middleware.ts` และ Navbar เพื่อป้องกันผู้ใช้ข้ามสิทธิ์ไปหน้าของ Role อื่น และบังคับ Login ก่อน Checkout

## 6. Next Immediate Goals (ขั้นตอนถัดไป)
**ลำดับ 1: Route Optimization API**
- สร้างระบบเชื่อมต่อ Google Maps Directions API
- คำนวณและจัดเรียงลำดับจุดจัดส่งที่สั้นที่สุด (TSP - Traveling Salesman Problem) อัตโนมัติ
- อัปเดตข้อมูล `sequence_no` ในตาราง `batch_items` กลับให้ระบบของคนขับ

**ลำดับ 2: Branch Inventory Management**
- พัฒนาหน้าระบบหลังบ้าน (`/branch-admin/inventory`)
- ให้ผู้จัดการสาขาสามารถปรับปรุงสต็อก และเปิด-ปิดสถานะสินค้าภายในสาขาของตนเองได้อย่างอิสระ

**ลำดับ 3: Type Safety & Security**
- นำระบบ Database Types ของ Supabase มาบังคับใช้ครอบตัวแปรที่ยังเป็น `any` ใน TypeScript
- สร้าง Row Level Security (RLS) Policies เพื่อล็อกความปลอดภัยในฐานข้อมูล ป้องกันไม่ให้แอบดูหรือแก้ไขข้อมูลข้ามสาขาจากฝั่ง Client ได้