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
- `branch_inventory`: สต็อกสินค้าแยกตามสาขา (branch_id, product_id, stock)
- `users`: ข้อมูลผู้ใช้งานและพนักงาน (id, role, branch_id)
- `orders`: รายการสั่งซื้อของลูกค้า (customer_id, branch_id, total_price, lat, lng, status)
- `order_items`: รายละเอียดสินค้าในออเดอร์ (order_id, product_id, quantity)
- `delivery_batches`: รอบการจัดส่งของแต่ละสาขา (id, branch_id, driver_id, batch_status)
- `batch_items`: ลำดับและจุดส่งในรอบ (batch_id, order_id, sequence_no)

---

## 4. Current Progress (สถานะปัจจุบัน)
- **Setup & Infrastructure:** ตั้งค่าโปรเจกต์ Next.js + Tailwind v4 + Supabase SSR สมบูรณ์
- **Routing & Auth:** ทำ Middleware ตรวจสอบ Role และทำ Redirect หน้า Dashboard เสร็จแล้ว
- **Customer Storefront:**
  - สร้างหน้าค้นหาสาขา (Branch Locator) ที่ดึงพิกัดจากตาราง `branches` มาแสดงบนแผนที่ Leaflet 
  - ใช้ Zustand (`branchStore.ts`) บันทึก ID สาขาที่ลูกค้าเลือก
  - สร้างหน้าสินค้าตามสาขา `/[branchId]/page.tsx` ดึงข้อมูล JOIN ระหว่าง `branch_inventory` กับ `products` เสร็จแล้ว

---

## 5. Technical Quirks & Solved Issues (ปัญหาที่แก้แล้ว)
- **Next.js SSR กับ Leaflet:** ป้องกันปัญหา `window is not defined` โดยการแยก Component แผนที่และใช้ `next/dynamic` พร้อมตั้งค่า `{ ssr: false }`
- **Map Render Bug (appendChild/Blank Screen):** 
  - แก้ปัญหาแผนที่ขาวด้วยการกำหนด `style={{ height: '500px', width: '100%' }}` แบบ Fixed 
  - ใช้ State `mounted` เพื่อให้แน่ใจว่า DOM พร้อมก่อนโหลดแผนที่
  - เพิ่ม `key` ให้ `MapContainer` เพื่อให้ React รีเซ็ตแผนที่เมื่อข้อมูลเปลี่ยน
- **String Lat/Lng:** ฐานข้อมูลส่งพิกัดมาเป็น String แก้ไขโดยใช้ `Number(lat)` ก่อนส่งให้แผนที่
- **Tailwind CSS v4 Configuration:** แก้ปัญหา CSS ไม่โหลดโดยการอัปเดตไปใช้ `@tailwindcss/postcss` ใน `postcss.config.js` และใช้ `@import "tailwindcss";` แทน `@tailwind` directives แบบเก่า

---

## 6. Next Immediate Goals (สิ่งที่ต้องทำต่อไป)
1. **Shopping Cart Store:** สร้าง Zustand Store (`cartStore.ts`) เพื่อให้ปุ่ม "เพิ่มลงตะกร้า" ในหน้า Storefront ทำงานได้
2. **Checkout Page & Map Pinning:** สร้างหน้า Checkout ให้ลูกค้ากรอกข้อมูล ปักหมุดที่อยู่ลงบนแผนที่ Leaflet และบันทึก `lat`/`lng` พร้อมรายการสินค้าลงตาราง `orders`
3. **Branch Admin Batching Map:** สร้างแดชบอร์ดให้ Branch Admin ดึงออเดอร์ค้างส่งมาแสดงบนแผนที่ เพื่อลากกรอบ (Lasso) สร้างรอบการจัดส่ง
4. **Route Optimization Integration:** เชื่อมต่อ Google Maps API ฝั่ง Backend เพื่อรับข้อมูล Batch ไปคำนวณหาเส้นทางที่สั้นที่สุด