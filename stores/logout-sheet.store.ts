/**
 * Store cho LogoutConfirmBottomSheet — mount modal chỉ khi mở, tránh 31ms render khi vào Profile.
 */
import { create } from 'zustand'

type LogoutSheetStore = {
  visible: boolean
  onConfirm: (() => void) | null
  open: (onConfirm: () => void) => void
  close: () => void
}

export const useLogoutSheetStore = create<LogoutSheetStore>((set) => ({
  visible: false,
  onConfirm: null,
  open: (onConfirm) => set({ visible: true, onConfirm }),
  close: () => set({ visible: false, onConfirm: null }),
}))
