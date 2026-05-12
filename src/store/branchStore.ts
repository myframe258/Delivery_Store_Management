import { create } from 'zustand';

export interface Branch {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
}

interface BranchState {
  activeBranch: Branch | null;
  setActiveBranch: (branch: Branch) => void;
}

export const useBranchStore = create<BranchState>((set) => ({
  activeBranch: null,
  setActiveBranch: (branch) => set({ activeBranch: branch }),
}));