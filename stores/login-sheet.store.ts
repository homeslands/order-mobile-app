import { create } from 'zustand'

type LoginSheetStore = {
  visible: boolean
  onSuccess: (() => void) | null
  open: (onSuccess?: () => void) => void
  close: () => void
}

export const useLoginSheetStore = create<LoginSheetStore>((set) => ({
  visible: false,
  onSuccess: null,
  open: (onSuccess) => set({ visible: true, onSuccess: onSuccess ?? null }),
  close: () => set({ visible: false, onSuccess: null }),
}))
