import React from 'react'
import { View, Text } from 'react-native'
import { FileQuestion } from 'lucide-react-native'
import { cn } from '@/lib/utils'
import { colors } from '@/constants'

interface DataTableEmptyProps {
  message?: string
  className?: string
}

export function DataTableEmpty({ message = 'No data', className }: DataTableEmptyProps) {
  return (
    <View className={cn('flex-1 items-center justify-center py-12 px-4', className)}>
      <FileQuestion size={40} color={colors.mutedForeground.dark} />
      <Text className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{message}</Text>
    </View>
  )
}
