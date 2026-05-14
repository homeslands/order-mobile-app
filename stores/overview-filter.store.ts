import dayjs from 'dayjs'
import { create } from 'zustand'

import { RevenueTypeQuery } from '@/constants'
import { IOverviewFilter, IOverviewFilterStore } from '@/types'

const defaultOverviewFilter: IOverviewFilter = {
  branch: '',
  startDate: dayjs().startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  endDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  type: RevenueTypeQuery.HOURLY,
}

export const useOverviewFilterStore = create<IOverviewFilterStore>()((set) => ({
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
  clearOverviewFilter: () => set({ overviewFilter: defaultOverviewFilter }),
  resetToDefault: () => set({ overviewFilter: defaultOverviewFilter }),
}))
