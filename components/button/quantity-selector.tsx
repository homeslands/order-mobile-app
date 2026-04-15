import { Minus, Plus } from 'lucide-react-native'
import React from 'react'
import { Text, View } from 'react-native'

import { Button } from '@/components/ui'

interface QuantitySelectorProps {
  value: number
  onChange: (value: number) => void
  min?: number
  disabled?: boolean
}

// Presentational component only: nhận value + onChange, không truy cập store
export default function QuantitySelector({
  value,
  onChange,
  min = 1,
  disabled,
}: QuantitySelectorProps) {
  const handleIncrement = () => {
    onChange(value + 1)
  }

  const handleDecrement = () => {
    const newQuantity = Math.max(value - 1, min)
    onChange(newQuantity)
  }

  return (
    <View className="flex items-center gap-1.5 w-full">
      <View className="flex-row items-center gap-1.5 w-full">
        <Button
          variant="outline"
          size="sm"
          onPress={handleDecrement}
          className="p-1.5 rounded-full border border-gray-300 dark:border-gray-700 h-fit w-fit"
          disabled={disabled || value <= min}
        >
          <Minus size={12} color="#6b7280" />
        </Button>
        <Text className="w-4 text-sm text-center text-gray-900 dark:text-white">{value}</Text>
        <Button
          variant="outline"
          size="sm"
          onPress={handleIncrement}
          className="p-1.5 rounded-full border border-gray-300 dark:border-gray-700 h-fit w-fit"
          disabled={disabled}
        >
          <Plus size={12} color="#6b7280" />
        </Button>
      </View>
    </View>
  )
}
