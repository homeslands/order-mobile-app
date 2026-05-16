import React, { createContext, useContext, useMemo } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

type TabScrollContextValue = {
  scrollY: SharedValue<number>
}

const TabScrollContext = createContext<TabScrollContextValue | null>(null)

export function TabScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useSharedValue(0)
  // useMemo → stable object reference, context consumers never re-render from this
  const value = useMemo(() => ({ scrollY }), [scrollY])
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
