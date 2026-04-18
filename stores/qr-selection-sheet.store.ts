import { create } from 'zustand'

type QRSelectionSheetStore = {
  visible: boolean
  open: () => void
  close: () => void
}

export const useQRSelectionSheetStore = create<QRSelectionSheetStore>(
  (set) => ({
    visible: false,
    open: () => set({ visible: true }),
    close: () => set({ visible: false }),
  }),
)
