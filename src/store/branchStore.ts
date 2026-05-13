import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BranchState {
  activeBranchId: string | null;
  setActiveBranchId: (id: string) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      activeBranchId: null,
      setActiveBranchId: (id) => set({ activeBranchId: id }),
    }),
    {
      name: 'branch-storage', // จะถูกบันทึกลงใน localStorage อัตโนมัติ
    }
  )
);