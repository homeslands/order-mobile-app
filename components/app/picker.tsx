import React from 'react'
import { Text, View } from 'react-native'

interface SimpleDatePickerProps {
  value: string
  onChange: (value: string) => void
  disabledDates?: (date: Date) => boolean
  disableFutureDates?: boolean
}

/**
 * Stub date picker cho DataTable (React Native).
 * Trên mobile có thể thay bằng DateTimePicker từ @react-native-community/datetimepicker.
 */
export function SimpleDatePicker({ value }: SimpleDatePickerProps) {
  return (
    <View className="min-h-10 min-w-[120px] justify-center rounded-lg border border-gray-200 px-3 dark:border-gray-700">
      <Text className="text-sm text-gray-700 dark:text-gray-300">{value}</Text>
    </View>
  )
}
