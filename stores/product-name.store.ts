import { IProductNameStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSafeStorage } from '@/utils/storage'

export const useProductNameStore = create<IProductNameStore>()(
  persist(
    (set) => ({
      productName: undefined,
      setProductName: (productName?: string) => set({ productName }),
      removeProductName: () => set({ productName: undefined }),
    }),
    {
      name: 'product-name-store',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
