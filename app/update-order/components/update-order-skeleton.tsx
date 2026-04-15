import React from 'react'
import { ScrollView, View } from 'react-native'

import { ScreenContainer } from '@/components/layout'
import { Skeleton } from '@/components/ui'

/**
 * Skeleton cho màn Update Order - Phase 2.
 * Hiển thị khi đang fetch order, trước khi hydrate content.
 */
export default function UpdateOrderSkeleton() {
  return (
    <ScreenContainer edges={['top']} className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <Skeleton className="mr-3 h-8 w-8 rounded-full" />
        <Skeleton className="h-5 flex-1 rounded-md" />
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* Countdown placeholder */}
        <View className="mb-4 flex-row justify-center">
          <Skeleton className="h-10 w-32 rounded-md" />
        </View>
        {/* Order info */}
        <View className="mb-4 rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Skeleton className="mb-3 h-4 w-32 rounded-md" />
          <Skeleton className="mb-2 h-6 w-40 rounded-md" />
          <Skeleton className="mb-2 h-4 w-28 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </View>
        {/* Items list */}
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className="mb-4 flex-row gap-3 rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
          >
            <Skeleton className="h-16 w-16 rounded-lg" />
            <View className="flex-1 gap-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="mt-2 h-8 w-24 rounded-md" />
            </View>
          </View>
        ))}
        {/* Footer */}
        <View className="rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Skeleton className="mb-2 h-4 w-40 rounded-md" />
          <Skeleton className="h-11 w-full rounded-lg" />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}
