import { ISelectedOrderStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSafeStorage } from '@/utils/storage'

export const useSelectedOrderStore = create<ISelectedOrderStore>()(
  persist(
    (set) => ({
      orderSlug: '',
      selectedRow: '',
      isSheetOpen: false,
      setOrderSlug: (slug: string) => set({ orderSlug: slug }),
      setSelectedRow: (row: string) => set({ selectedRow: row }),
      setIsSheetOpen: (isOpen: boolean) => set({ isSheetOpen: isOpen }),
      clearSelectedOrder: () =>
        set({
          orderSlug: '',
          selectedRow: '',
          isSheetOpen: false,
        }),
    }),
    {
      name: 'selected-order-store',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
