'use client';

import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

interface ProductProps {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  unit_name?: string;
  step_value?: number;
  min_value?: number;
}

interface AddToCartButtonProps {
  product: ProductProps;
  branchId: string;
}

export default function AddToCartButton({ product, branchId }: AddToCartButtonProps) {
  // ดึง State และ Action จาก Zustand Store (ใช้ Fallback ป้องกัน Type Error กรณีตั้งชื่อฟังก์ชันต่างไป)
  const cartItems = useCartStore((state: any) => state.items || state.cart || []);
  const addItem = useCartStore((state: any) => state.addItem || state.addToCart);
  const updateQuantity = useCartStore((state: any) => state.updateQuantity || state.updateItem);
  const removeItem = useCartStore((state: any) => state.removeItem || state.removeFromCart);

  // ค้นหาว่ามีสินค้านี้ในตะกร้าของสาขานี้แล้วหรือยัง
  const existingItem = cartItems.find(
    (item: any) => item.id === product.id && item.branchId === branchId
  );
  const quantity = existingItem ? existingItem.quantity : 0;

  // ดึงค่ามาจาก Master Data ถ้าไม่มีให้ใช้ค่าเริ่มต้นเป็น 1
  const step = product.step_value || 1;
  const min = product.min_value || 1;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (addItem) {
      // ครั้งแรกที่หยิบลงตะกร้า ให้เริ่มที่ค่า min เสมอ
      addItem({ ...product, branchId, quantity: min });
    } else {
      alert('ฟังก์ชันเพิ่มลงตะกร้ายังไม่พร้อมใช้งาน');
    }
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (updateQuantity) {
      // ใช้ toFixed(2) แล้วแปลงกลับเป็น Number เพื่อป้องกันปัญหาทศนิยมเพี้ยน (เช่น 0.1 + 0.2)
      const nextQuantity = Number((quantity + step).toFixed(2));
      updateQuantity(product.id, nextQuantity);
    }
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity > min && updateQuantity) {
      const nextQuantity = Number((quantity - step).toFixed(2));
      // ตรวจสอบเผื่อว่ากดลบแล้วค่าน้อยกว่าค่าขั้นต่ำ ให้ถือว่าเป็นการลบออกจากตะกร้า
      if (nextQuantity >= min) {
        updateQuantity(product.id, nextQuantity);
      } else if (removeItem) {
        removeItem(product.id);
      }
    } else if (quantity <= min && removeItem) {
      removeItem(product.id);
    }
  };

  const displayQuantity = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(2).replace(/\.?0+$/, '');

  // กรณีที่มีสินค้าในตะกร้าแล้ว -> แสดงปุ่มปรับจำนวน (+ / -)
  if (quantity > 0) {
    return (
      <div className="w-full flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl overflow-hidden h-9 sm:h-11 shadow-sm">
        <button
          onClick={handleDecrease}
          title="ลดจำนวน"
          className="w-10 sm:w-12 h-full flex items-center justify-center text-blue-600 hover:bg-blue-200 active:bg-blue-300 transition-colors"
        >
          <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
        <span className="font-bold text-sm sm:text-base text-blue-800 min-w-[2rem] px-1 text-center select-none">
          {displayQuantity}
        </span>
        <button
          onClick={handleIncrease}
          title="เพิ่มจำนวน"
          className="w-10 sm:w-12 h-full flex items-center justify-center text-blue-600 hover:bg-blue-200 active:bg-blue-300 transition-colors"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    );
  }

  // กรณีที่ยังไม่มีสินค้าในตะกร้า -> แสดงปุ่ม "เพิ่มลงตะกร้า"
  return (
    <button
      onClick={handleAdd}
      className="w-full flex items-center justify-center gap-1.5 sm:gap-2 bg-white border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl h-9 sm:h-11 text-xs sm:text-sm font-bold transition-all duration-300 active:scale-95 shadow-sm group"
    >
      <ShoppingCart className="w-4 h-4 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
      <span>เพิ่มลงตะกร้า</span>
    </button>
  );
}