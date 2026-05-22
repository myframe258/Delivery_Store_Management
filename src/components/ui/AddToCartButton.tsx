'use client';

import { ShoppingCart, Plus, Minus } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

interface ProductProps {
  id: string;
  name: string;
  price: number;
  image_url?: string;
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

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (addItem) {
      addItem({ ...product, branchId, quantity: 1 });
    } else {
      alert('ฟังก์ชันเพิ่มลงตะกร้ายังไม่พร้อมใช้งาน');
    }
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (updateQuantity) {
      updateQuantity(product.id, quantity + 1);
    }
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (quantity > 1 && updateQuantity) {
      updateQuantity(product.id, quantity - 1);
    } else if (quantity === 1 && removeItem) {
      removeItem(product.id);
    }
  };

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
        <span className="font-bold text-sm sm:text-base text-blue-800 w-8 text-center select-none">
          {quantity}
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