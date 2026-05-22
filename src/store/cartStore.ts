import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
  branchId: string;
}

interface CartState {
  items: CartItem[];
  activeBranchId: string | null;
  
  // Actions
  addItem: (item: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  
  // Getters (Helper functions)
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      activeBranchId: null,

      addItem: (item) => {
        const { items, activeBranchId } = get();

        // ตรวจสอบว่ามีสินค้าจากสาขาอื่นค้างอยู่ในตะกร้าหรือไม่
        if (activeBranchId && activeBranchId !== item.branchId) {
          if (window.confirm('คุณกำลังเลือกสินค้าจากสาขาอื่น ตะกร้าสินค้าเดิมของคุณจะถูกล้าง ต้องการดำเนินการต่อหรือไม่?')) {
            // ล้างของเก่าและใส่ของใหม่เข้าไปแทน
            set({ items: [item], activeBranchId: item.branchId });
          }
          return;
        }

        const existingItem = items.find((i) => i.id === item.id);
        if (existingItem) {
          set({
            items: items.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i)),
            activeBranchId: item.branchId,
          });
        } else {
          set({
            items: [...items, item],
            activeBranchId: item.branchId,
          });
        }
      },

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, quantity } : item)),
        }));
      },

      removeItem: (id) => {
        set((state) => {
          const newItems = state.items.filter((item) => item.id !== id);
          // ถ้าลบสินค้าชิ้นสุดท้ายออก ให้ปลดล็อกสาขาด้วย (จะได้ไปซื้อสาขาอื่นได้)
          return {
            items: newItems,
            activeBranchId: newItems.length === 0 ? null : state.activeBranchId,
          };
        });
      },

      clearCart: () => set({ items: [], activeBranchId: null }),

      getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),
      
      getTotalPrice: () => get().items.reduce((total, item) => total + item.price * item.quantity, 0),
    }),
    {
      name: 'cart-storage', // ชื่อ Key ที่จะถูกเซฟลง localStorage ของเบราว์เซอร์
    }
  )
);