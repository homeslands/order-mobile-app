import React from 'react'
import { View, ActivityIndicator, Text } from 'react-native'
import { cn } from '@/lib/utils'
import { colors } from '@/constants'

interface DataTableLoadingProps {
  message?: string
  className?: string
}

export function DataTableLoading({ message = 'Loading...', className }: DataTableLoadingProps) {
  return (
    <View className={cn('flex-1 items-center justify-center py-12', className)}>
      <ActivityIndicator size="large" color={colors.primary.light} />
      <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">{message}</Text>
    </View>
  )
}
