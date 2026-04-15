import { create } from 'zustand'

type ScanSheetStore = {
  visible: boolean
  open: () => void
  close: () => void
}

export const useScanSheetStore = create<ScanSheetStore>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}))
