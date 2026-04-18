import { Minus, Plus } from 'lucide-react-native'
import React from 'react'
import { Text, View } from 'react-native'

import { PressableWithFeedback } from '@/components/navigation'
import { HIT_SLOP_SMALL } from '@/lib/navigation/constants'

interface NonPropQuantitySelectorProps {
  quantity: number
  onChange: (quantity: number) => void
  isLimit?: boolean
  disabled?: boolean
  currentQuantity?: number
  maxQuantity?: number
}

export default function NonPropQuantitySelector({
  quantity,
  onChange,
  isLimit = false,
  disabled = false,
  currentQuantity,
  maxQuantity,
}: NonPropQuantitySelectorProps) {
  const handleIncrement = () => {
    if (disabled) return
    const newQuantity = quantity + 1
    // Check stock limit if isLimit is true
    if (
      isLimit &&
      currentQuantity !== undefined &&
      newQuantity > currentQuantity
    ) {
      return
    }
    // Check max quantity if provided
    if (maxQuantity !== undefined && newQuantity > maxQuantity) {
      return
    }
    onChange(newQuantity)
  }

  const handleDecrement = () => {
    if (disabled) return
    const newQuantity = Math.max(1, quantity - 1)
    onChange(newQuantity)
  }

  const isDecrementDisabled = disabled || quantity <= 1
  const isIncrementDisabled =
    disabled ||
    (isLimit && currentQuantity !== undefined && quantity >= currentQuantity) ||
    (maxQuantity !== undefined && quantity >= maxQuantity)

  const decrementClassName = `p-2 rounded-full border ${
    isDecrementDisabled
      ? 'border-gray-300 dark:border-gray-700 opacity-50'
      : 'border-gray-500 dark:border-gray-400'
  }`
  const incrementClassName = `p-2 rounded-full border ${
    isIncrementDisabled
      ? 'border-gray-300 dark:border-gray-700 opacity-50'
      : 'border-gray-500 dark:border-gray-400'
  }`

  return (
    <View className="flex-row items-center gap-2">
      <PressableWithFeedback
        onPress={handleDecrement}
        disabled={isDecrementDisabled}
        hitSlop={HIT_SLOP_SMALL}
        className={decrementClassName}
      >
        <Minus size={16} color={isDecrementDisabled ? '#9ca3af' : '#374151'} />
      </PressableWithFeedback>
      <Text className="w-8 text-center text-base font-semibold text-gray-900 dark:text-white">
        {quantity}
      </Text>
      <PressableWithFeedback
        onPress={handleIncrement}
        disabled={isIncrementDisabled}
        hitSlop={HIT_SLOP_SMALL}
        className={incrementClassName}
      >
        <Plus size={16} color={isIncrementDisabled ? '#9ca3af' : '#374151'} />
      </PressableWithFeedback>
    </View>
  )
}
