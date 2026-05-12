-- 1. เพิ่มคอลัมน์ branch_id (bigint) ลงในตาราง orders
ALTER TABLE public.orders 
ADD COLUMN branch_id bigint;

-- ตั้งค่า Foreign Key สำหรับตาราง orders ให้ชี้ไปที่ branches
ALTER TABLE public.orders 
ADD CONSTRAINT orders_branch_id_fkey 
FOREIGN KEY (branch_id) 
REFERENCES public.branches(id) 
ON DELETE SET NULL;

-- 2. เพิ่มคอลัมน์ branch_id (bigint) ลงในตาราง delivery_batches
ALTER TABLE public.delivery_batches 
ADD COLUMN branch_id bigint;

-- ตั้งค่า Foreign Key สำหรับตาราง delivery_batches ให้ชี้ไปที่ branches
ALTER TABLE public.delivery_batches 
ADD CONSTRAINT delivery_batches_branch_id_fkey 
FOREIGN KEY (branch_id) 
REFERENCES public.branches(id) 
ON DELETE SET NULL;