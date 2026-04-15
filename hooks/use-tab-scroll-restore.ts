/**
 * Hook lưu/khôi phục scroll position khi dùng detachInactiveScreens=true.
 * Dùng trong tab có ScrollView hoặc FlatList.
 */
import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useRef } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { ScrollView } from 'react-native'

import type { TabScrollKey } from '@/stores/scroll-position.store'
import { useScrollPositionStore } from '@/stores/scroll-position.store'

export function useTabScrollRestore(tabKey: TabScrollKey) {
  const scrollRef = useRef<ScrollView>(null)
  const save = useScrollPositionStore((s) => s.save)
  const getY = useScrollPositionStore((s) => s.get)

  useFocusEffect(
    useCallback(() => {
      const y = getY(tabKey)
      if (y > 0) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y, animated: false })
        })
      }
    }, [tabKey, getY]),
  )

  const onScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      save(tabKey, e.nativeEvent.contentOffset.y)
    },
    [tabKey, save],
  )

  // Chỉ lưu khi scroll dừng (onMomentumScrollEnd, onScrollEndDrag) — tránh Bridge overload khi scroll
  return { scrollRef, onScrollEnd }
}
