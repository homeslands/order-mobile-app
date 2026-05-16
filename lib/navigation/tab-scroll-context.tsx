import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

type TabScrollContextValue = {
  scrollY: SharedValue<number>
  collapseFraction: SharedValue<number>
}

const TabScrollContext = createContext<TabScrollContextValue | null>(null)

export function TabScrollProvider({ children }: { children: ReactNode }) {
  const scrollY = useSharedValue(0)
  const collapseFraction = useSharedValue(0)
  // Both SharedValues have stable refs — memo never invalidates
  const value = useMemo(() => ({ scrollY, collapseFraction }), [scrollY, collapseFraction])
  return (
    <TabScrollContext.Provider value={value}>
      {children}
    </TabScrollContext.Provider>
  )
}

export function useTabScrollContext(): TabScrollContextValue {
  const ctx = useContext(TabScrollContext)
  if (!ctx) throw new Error('useTabScrollContext requires TabScrollProvider')
  return ctx
}
