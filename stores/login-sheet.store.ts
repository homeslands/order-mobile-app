import { create } from 'zustand'

export type LoginSheetCloseReason = 'success' | 'dismissed' | 'navigated'

type LoginSheetStore = {
  visible: boolean
  onSuccess: (() => void) | null
  onClose: ((reason: LoginSheetCloseReason) => void) | null
  open: (
    onSuccess?: () => void,
    onClose?: (reason: LoginSheetCloseReason) => void,
  ) => void
  close: (reason: LoginSheetCloseReason) => void
}

export const useLoginSheetStore = create<LoginSheetStore>((set, get) => ({
  visible: false,
  onSuccess: null,
  onClose: null,
  open: (onSuccess, onClose) =>
    set({
      visible: true,
      onSuccess: onSuccess ?? null,
      onClose: onClose ?? null,
    }),
  close: (reason) => {
    const { visible, onClose } = get()
    // First close wins: programmatic close also triggers the sheet's onDismiss
    if (!visible) return
    set({ visible: false, onSuccess: null, onClose: null })
    onClose?.(reason)
  },
}))
