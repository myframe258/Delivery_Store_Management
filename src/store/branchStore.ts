import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BranchState {
  activeBranchId: string | number | null;
  activeBranch: any | null;
  setActiveBranchId: (id: string | number) => void;
  setActiveBranch: (branch: any) => void;
  clearBranch: () => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      activeBranchId: null,
      activeBranch: null,
      
      setActiveBranchId: (id) => set({ activeBranchId: id }),
      
      setActiveBranch: (branch) => set({ 
        activeBranch: branch,
        activeBranchId: branch?.id || null 
      }),
      
      clearBranch: () => set({ activeBranchId: null, activeBranch: null }),
    }),
    {
      name: 'branch-storage', // จะถูกบันทึกลงใน localStorage อัตโนมัติ
    }
  )
);