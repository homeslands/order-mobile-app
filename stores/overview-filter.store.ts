import dayjs from 'dayjs'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { RevenueTypeQuery } from '@/constants'
import { IOverviewFilter, IOverviewFilterStore } from '@/types'
import { createSafeStorage } from '@/utils/storage'

const defaultOverviewFilter: IOverviewFilter = {
  branch: '',
  startDate: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  endDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  type: RevenueTypeQuery.HOURLY,
}

export const useOverviewFilterStore = create<IOverviewFilterStore>()(
  persist(
    (set) => ({
      overviewFilter: defaultOverviewFilter,
      setOverviewFilter: (
        overviewFilter:
          | IOverviewFilter
          | ((prev: IOverviewFilter) => IOverviewFilter),
      ) => {
        set((state) => ({
          overviewFilter:
            typeof overviewFilter === 'function'
              ? overviewFilter(state.overviewFilter)
              : overviewFilter,
        }))
      },
      clearOverviewFilter: () => {
        set({
          overviewFilter: defaultOverviewFilter,
        })
      },
      resetToDefault: () => {
        set({
          overviewFilter: defaultOverviewFilter,
        })
      },
    }),
    {
      name: 'overview-filter-store',
      storage: createJSONStorage(() => createSafeStorage()),
      // Clear store khi page refresh
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.overviewFilter = defaultOverviewFilter
        }
      },
    },
  ),
)
