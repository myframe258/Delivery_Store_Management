# Project Context: Batch Delivery Store Management

## 1. Project Overview
ระบบบริหารจัดการร้านค้าแบบหลายสาขา (Multi-Branch) ที่ครอบคลุมตั้งแต่หน้าร้าน E-Commerce ไปจนถึงระบบจัดส่งแบบ **"ส่งเป็นรอบ" (Batch Delivery)** 

**Key Features:**
- **Multi-branch Support:** แยกสินค้า สต็อก ออเดอร์ และรอบการจัดส่งออกจากกันตามแต่ละสาขา
- **Geofencing & Map Pinning:** ลูกค้าค้นหาสาขาที่ใกล้ที่สุด และปักหมุดแผนที่เพื่อระบุที่อยู่จัดส่งได้อย่างแม่นยำ
- **Route Optimization (TSP):** ระบบรวมกลุ่มออเดอร์ (Batching) และคำนวณเส้นทางจัดส่งที่สั้นที่สุดสำหรับคนขับ
- **Role-based Access:** แยกสิทธิ์ผู้ใช้งานเป็น Super Admin, Branch Admin, Rider และ Customer

---

## 2. Tech Stack
- **Framework:** Next.js 16.2.6 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`)
- **Database & Auth:** Supabase (ใช้ `@supabase/ssr` สำหรับ Next.js)
- **State Management:** Zustand (รองรับ LocalStorage persistence)
- **Mapping:** Leaflet.js (`react-leaflet`)

---

## 3. Database Schema (Supabase)
โครงสร้างฐานข้อมูลหลักออกแบบให้รองรับ Multi-branch ดังนี้:
- `branches`: ข้อมูลสาขา (id, name, lat, lng, address)
- `products`: ข้อมูลสินค้ากลาง (id, name, price, description, image_url)
- `branch_inventory`: สต็อกสินค้าแยกตามสาขา (branch_id, product_id, stock_count, status)
- `users`: ข้อมูลผู้ใช้งานและพนักงาน (id, role, branch_id)
- `orders`: รายการสั่งซื้อของลูกค้า (customer_id, branch_id, total_price, lat, lng, status: 'pending'|'batched'|'delivered')
- `order_items`: รายละเอียดสินค้าในออเดอร์ (order_id, product_id, quantity, price_at_purchase)
- `delivery_batches`: รอบการจัดส่งของแต่ละสาขา (id, branch_id, driver_id, batch_status: 'pending'|'assigned'|'in_progress'|'completed')
- `batch_items`: ลำดับและจุดส่งในรอบ (batch_id, order_id, sequence_no, delivery_status: 'pending'|'delivered')

---

## 4. Current Progress (สถานะปัจจุบัน)
- **Setup & Infrastructure:** ตั้งค่าโปรเจกต์ Next.js + Tailwind v4 + Supabase SSR สมบูรณ์
- **Routing & Auth Logic:** ทำ Middleware ตรวจสอบ Role และสร้าง `Navbar.tsx` เสร็จสมบูรณ์ รองรับการเข้าชมเว็บแบบสาธารณะ สลับเมนูตาม Role อัตโนมัติ และบังคับ Login เฉพาะจังหวะที่ลูกค้ายืนยันการสั่งซื้อ (Checkout)
- **Customer Storefront:**
  - สร้างหน้าค้นหาสาขา (Branch Locator) ที่ดึงพิกัดจากตาราง `branches` มาแสดงบนแผนที่ Leaflet 
  - ใช้ Zustand (`branchStore.ts`) บันทึก ID สาขาที่ลูกค้าเลือก
  - สร้างหน้าสินค้าตามสาขา (`/[branchId]/page.tsx`), ระบบตะกร้า (`cartStore.ts`) ทำงานได้สมบูรณ์
  - สร้างหน้า Checkout ให้ลูกค้าปักหมุดที่อยู่และบันทึกรายการลง Database (`orders`, `order_items`) ได้สำเร็จ
- **Branch Admin Flow:** สร้างหน้าจัดรอบส่ง (`/branch-admin/batching`) ให้แอดมินสาขาดึงออเดอร์บนแผนที่ และเลือกรวมกลุ่มออเดอร์ (Batching) สร้างเป็นรอบจัดส่งลง Database ได้แล้ว
- **Rider Flow:** สร้างหน้าแอปสำหรับคนขับ (`/rider/batches`) รองรับการดูคิวงานตามลำดับ `sequence_no` บนแผนที่, ฟีเจอร์กดปุ่มเพื่อนำทางผ่าน Google Maps App, และปุ่มกดเปลี่ยนสถานะส่งสำเร็จแบบ Real-time

---

## 5. Technical Quirks & Solved Issues (ปัญหาที่แก้แล้ว)
- **Next.js SSR กับ Leaflet:** ป้องกันปัญหา `window is not defined` โดยการแยก Component แผนที่และใช้ `next/dynamic` พร้อมตั้งค่า `{ ssr: false }`
- **Map Render Bug (appendChild/Blank Screen):** 
  - แก้ปัญหาแผนที่ขาวด้วยการกำหนด `style={{ height: '500px', width: '100%' }}` แบบ Fixed 
  - ใช้ State `mounted` เพื่อให้แน่ใจว่า DOM พร้อมก่อนโหลดแผนที่
  - เพิ่ม `key` ให้ `MapContainer` เพื่อให้ React รีเซ็ตแผนที่เมื่อข้อมูลเปลี่ยน
- **String Lat/Lng:** ฐานข้อมูลส่งพิกัดมาเป็น String แก้ไขโดยใช้ `Number(lat)` ก่อนส่งให้แผนที่
- **Tailwind CSS v4 Configuration:** แก้ปัญหา CSS ไม่โหลดโดยการอัปเดตไปใช้ `@tailwindcss/postcss` ใน `postcss.config.js` และใช้ `@import "tailwindcss";` แทน `@tailwind` directives แบบเก่า
- **Mobile UI Layout Management:** ป้องกันปัญหาเนื้อหาโดน Navbar ด้านบน และ Bottom Navigation ในมือถือบัง โดยตั้งค่า SafeArea `pt-14` และ `pb-16` ไว้ใน `layout.tsx` ทำให้แสดงผล PWA ได้สมบูรณ์
- **Draggable Map Pinning:** ทำระบบเลื่อนปักหมุด (Draggable Marker) ในหน้า Checkout โดยใช้ Event `dragend` ของ Leaflet ให้ลูกค้าเลื่อนหมุดเพื่อดึงพิกัดจัดส่งที่แม่นยำ 100%

---

## 6. Next Immediate Goals (สิ่งที่ต้องทำต่อไป)
1. **Route Optimization API:** สร้าง Route Handler (`/api/optimize-route`) เชื่อมต่อ Google Maps Directions API เพื่อจัดเรียงลำดับจุดส่งที่สั้นที่สุด (TSP) และอัปเดต `sequence_no` ให้ Rider อัตโนมัติ
2. **Branch Inventory Management:** สร้างหน้าระบบหลังบ้าน (`/branch-admin/inventory`) ให้ผู้จัดการสาขาสามารถแก้ไข/จัดการจำนวนสต็อกและสถานะของสินค้าในสาขาตัวเอง
3. **Type Safety & Security (RLS):** เปลี่ยนการใช้ Type `any` ด้วยการรัน Supabase Types Script และตั้งค่า Row Level Security (RLS) Policy เพื่อป้องกันการแอบแก้ไขข้อมูลข้ามสาขา