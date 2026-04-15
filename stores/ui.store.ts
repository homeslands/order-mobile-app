import { create } from 'zustand'

interface IUIStore {
  isBottomBarVisible: boolean
  setIsBottomBarVisible: (visible: boolean) => void
}

export const useUIStore = create<IUIStore>((set) => ({
  isBottomBarVisible: true,
  setIsBottomBarVisible: (visible: boolean) => set({ isBottomBarVisible: visible }),
}))

