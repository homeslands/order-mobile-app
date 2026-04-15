import dayjs from 'dayjs'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { FILTER_VALUE } from '@/constants'
import { IMenuFilter, IMenuFilterStore } from '@/types'
import { createSafeStorage } from '@/utils/storage'

const defaultMenuFilter: IMenuFilter = {
  date: dayjs().format('YYYY-MM-DD'),
  branch: undefined,
  minPrice: FILTER_VALUE.MIN_PRICE,
  maxPrice: FILTER_VALUE.MAX_PRICE,
  catalog: undefined,
  productName: undefined,
  menu: undefined,
  isNewProduct: undefined,
  isTopSell: undefined,
}

export const useMenuFilterStore = create<IMenuFilterStore>()(
  persist(
    (set) => ({
      menuFilter: defaultMenuFilter,
      setMenuFilter: (
        menuFilter: IMenuFilter | ((prev: IMenuFilter) => IMenuFilter),
      ) => {
        set((state) => ({
          menuFilter:
            typeof menuFilter === 'function'
              ? menuFilter(state.menuFilter)
              : menuFilter,
        }))
      },
      clearMenuFilter: () => {
        set({
          menuFilter: {
            date: dayjs().format('YYYY-MM-DD'),
            branch: undefined,
            minPrice: FILTER_VALUE.MIN_PRICE,
            maxPrice: FILTER_VALUE.MAX_PRICE,
            catalog: undefined,
            productName: undefined,
            menu: undefined,
            isNewProduct: undefined,
            isTopSell: undefined,
          },
        })
      },
    }),
    {
      name: 'menu-filter-store',
      storage: createJSONStorage(() => createSafeStorage()),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const today = dayjs().format('YYYY-MM-DD')
          if (state.menuFilter.date !== today) {
            state.setMenuFilter((prev) => ({ ...prev, date: today }))
          }
        }
      },
    },
  ),
)
