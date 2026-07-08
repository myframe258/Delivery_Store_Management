import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Define interfaces for better type safety
export interface Branch {
  id: string | number;
  name: string;
  lat: number;
  lng: number;
  address: string;
}

interface UserLocation {
    lat: number;
    lng: number;
}

interface BranchState {
  // Persisted state
  activeBranchId: string | number | null;
  activeBranch: any | null; // Using 'any' to match existing code, but 'Branch | null' would be better
  
  // Non-persisted state
  userLocation: UserLocation | null;
  nearestBranch: Branch | null;

  // Actions
  setActiveBranchId: (id: string | number) => void;
  setActiveBranch: (branch: any) => void;
  clearBranch: () => void;
  setUserLocation: (location: UserLocation | null) => void;
  setNearestBranch: (branch: Branch | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      // Persisted state
      activeBranchId: null,
      activeBranch: null,
      
      // Non-persisted state
      userLocation: null,
      nearestBranch: null,
      
      // Actions
      setActiveBranchId: (id) => set({ activeBranchId: id }),
      
      setActiveBranch: (branch) => set({ 
        activeBranch: branch,
        activeBranchId: branch?.id || null 
      }),
      clearBranch: () => set({ activeBranchId: null, activeBranch: null }),
      setUserLocation: (location) => set({ userLocation: location }),
      setNearestBranch: (branch) => set({ nearestBranch: branch }),
    }),
    {
      name: 'branch-storage',
      // Only persist 'activeBranchId' and 'activeBranch'
      partialize: (state) => ({ 
        activeBranchId: state.activeBranchId, 
        activeBranch: state.activeBranch 
      }),
    }
  )
);