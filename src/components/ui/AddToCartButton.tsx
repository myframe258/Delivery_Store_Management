'use client';

import { useCartStore } from '@/store/cartStore';

interface AddToCartButtonProps {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
  };
  branchId: string;
}

export default function AddToCartButton({ product, branchId }: AddToCartButtonProps) {
  const addItem = useCartStore((state) => state.addItem);

  const handleAdd = () => {
    addItem({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      quantity: 1,
      image_url: product.image_url,
      branch_id: branchId,
    });
    
    // แจ้งเตือนแบบง่าย (สามารถเปลี่ยนเป็น Toast UI ได้ในอนาคต)
    alert(`เพิ่ม ${product.name} ลงตะกร้าแล้ว`);
  };

  return (
    <button
      onClick={handleAdd}
      className="w-full bg-slate-800 text-white py-2 rounded-lg text-sm hover:bg-slate-700 transition shadow-sm font-medium active:scale-95"
    >
      เพิ่มลงตะกร้า
    </button>
  );
}