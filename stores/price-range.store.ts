import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { FILTER_VALUE } from '@/constants'
import { IPriceRangeStore } from '@/types'
import { createSafeStorage } from '@/utils/storage'

export const usePriceRangeStore = create<IPriceRangeStore>()(
  persist(
    (set) => ({
      minPrice: FILTER_VALUE.MIN_PRICE,
      maxPrice: FILTER_VALUE.MAX_PRICE,
      setPriceRange: (minPrice: number, maxPrice: number) => {
        set({ minPrice, maxPrice })
      },
      clearPriceRange: () => {
        set({
          minPrice: FILTER_VALUE.MIN_PRICE,
          maxPrice: FILTER_VALUE.MAX_PRICE,
        })
      },
    }),
    {
      name: 'price-range-store',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
