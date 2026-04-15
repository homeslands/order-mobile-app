import { IBranch, IBranchStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSafeStorage } from '@/utils/storage'

export const useBranchStore = create<IBranchStore>()(
  persist(
    (set) => ({
      branch: undefined,
      setBranch: (branch?: IBranch) => set({ branch }),
      removeBranch: () => set({ branch: undefined }),
    }),
    {
      name: 'branch-storage',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
