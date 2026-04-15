/**
 * Generic ScreenShell — lightweight skeleton cho Post-Transition Hydration.
 * 0 store, 0 query, minimal layout. Dùng làm default shell cho withDeferredRendering.
 */
import React from 'react'
import { View } from 'react-native'

import { ScreenContainer } from '@/components/layout/screen-container'
import { Skeleton } from '@/components/ui'

export function ScreenShell() {
  return (
    <ScreenContainer edges={['top']} className="flex-1 bg-white dark:bg-gray-900">
      <View className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <Skeleton className="h-8 w-24 rounded-md" />
      </View>
      <View className="flex-1 px-4 py-6 gap-4">
        <Skeleton className="w-full h-40 rounded-xl" />
        <Skeleton className="h-5 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <View className="mt-4 gap-3">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </View>
      </View>
    </ScreenContainer>
  )
}
