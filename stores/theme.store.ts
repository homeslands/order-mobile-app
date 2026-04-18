import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Appearance } from 'react-native'

import { IThemeStore } from '@/types'
import { createSafeStorage } from '@/utils/storage'

export type ThemeMode = 'light' | 'dark' | 'system'

export function applyTheme(theme: ThemeMode) {
  if (theme === 'system') {
    Appearance.setColorScheme(null)
  } else {
    Appearance.setColorScheme(theme)
  }
}

export const useThemeStore = create<IThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme: string) => {
        set({ theme })
        applyTheme(theme as ThemeMode)
      },
      getTheme: () => get().theme,
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => createSafeStorage()),
    },
  ),
)
