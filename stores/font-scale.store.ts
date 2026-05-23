import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { createSafeStorage } from '@/utils/storage'

export type FontScalePreset = 'small' | 'normal' | 'large'

export const PRESET_SCALE: Record<FontScalePreset, number> = {
  small: 0.92,
  normal: 1.0,
  large: 1.1,
}

interface FontScaleState {
  preset: FontScalePreset
  scale: number
  setPreset: (preset: FontScalePreset) => void
}

export const useFontScaleStore = create<FontScaleState>()(
  persist(
    (set) => ({
      preset: 'normal',
      scale: 1.0,
      setPreset: (preset) =>
        set({ preset, scale: PRESET_SCALE[preset] }),
    }),
    {
      name: 'font-scale-storage',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
