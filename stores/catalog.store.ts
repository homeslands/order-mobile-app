import { ICatalog, ICatalogStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSafeStorage } from '@/utils/storage'

export const useCatalogStore = create<ICatalogStore>()(
  persist(
    (set) => ({
      catalog: undefined,
      setCatalog: (catalog?: ICatalog) => set({ catalog }),
      removeCatalog: () => set({ catalog: undefined }),
    }),
    {
      name: 'catalog-storage',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
