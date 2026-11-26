import { IBranch, IBranchStore } from '@/types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSafeStorage } from '@/utils/storage'

export const useBranchStore = create<IBranchStore>()(
  persist(
    (set) => ({
      branch: undefined,
      autoPicked: false,
      setBranch: (branch?: IBranch) => set({ branch, autoPicked: false }),
      setAutoPickedBranch: (branch: IBranch) =>
        set({ branch, autoPicked: true }),
      dismissBranchHint: () => set({ autoPicked: false }),
      removeBranch: () => set({ branch: undefined, autoPicked: false }),
    }),
    {
      name: 'branch-storage',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
