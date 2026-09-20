import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSafeStorage } from '@/utils/storage'

interface GlassState {
  /** 0 = nền đặc như giao diện cũ, 1 = kính nguyên bản của Apple. */
  level: number
  setLevel: (level: number) => void
}

export const useGlassStore = create<GlassState>()(
  persist(
    (set) => ({
      level: 1,
      setLevel: (level) => {
        if (!Number.isFinite(level)) return
        set({ level: Math.min(1, Math.max(0, level)) })
      },
    }),
    {
      name: 'glass-storage',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
