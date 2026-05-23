import { createContext, useContext, useMemo } from 'react'

import { useFontScaleStore } from '@/stores/font-scale.store'

const FontScaleContext = createContext(1.0)

export function useFontScale(): number {
  return useContext(FontScaleContext)
}

export function FontScaleProvider({ children }: { children: React.ReactNode }) {
  const scale = useFontScaleStore((s) => s.scale)
  const value = useMemo(() => scale, [scale])
  return (
    <FontScaleContext.Provider value={value}>
      {children}
    </FontScaleContext.Provider>
  )
}
