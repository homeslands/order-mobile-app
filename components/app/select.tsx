import React from 'react'
import { Text, View } from 'react-native'

interface PeriodOfTimeSelectProps {
  periodOfTime?: string
  onChange: (periodOfTime: string) => void
}

/**
 * Stub period select cho DataTable (React Native).
 * Có thể thay bằng Select/Modal với các option: today, week, month, ...
 */
export function PeriodOfTimeSelect({
  periodOfTime = 'today',
}: PeriodOfTimeSelectProps) {
  return (
    <View className="min-h-10 min-w-[100px] justify-center rounded-lg border border-gray-200 px-3 dark:border-gray-700">
      <Text className="text-sm text-gray-700 dark:text-gray-300">
        {periodOfTime}
      </Text>
    </View>
  )
}
