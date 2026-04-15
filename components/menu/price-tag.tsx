import React from 'react'
import { Text, View } from 'react-native'

import { formatCurrency } from '@/utils'

interface PriceTagProps {
  price: number | null
  finalPrice: number | null
  hasPromotion: boolean
  discountValue?: number
  chooseSizeLabel: string
}

/** Hiển thị giá sản phẩm — memo để tránh re-render khi parent scroll */
export const PriceTag = React.memo(function PriceTag({
  price,
  finalPrice,
  hasPromotion,
  discountValue = 0,
  chooseSizeLabel,
}: PriceTagProps) {
  if (!price) {
    return (
      <Text className="font-semibold text-primary dark:text-primary">
        {chooseSizeLabel}
      </Text>
    )
  }

  if (hasPromotion) {
    return (
      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="text-2xl font-extrabold text-primary dark:text-primary">
          {formatCurrency(finalPrice ?? 0)}
        </Text>
        <Text className="rounded-full bg-red-500 px-2 py-1 text-xs text-white">
          {discountValue}%
        </Text>
        <Text className="text-base text-gray-400 line-through">
          {formatCurrency(price)}
        </Text>
      </View>
    )
  }

  return (
    <Text className="text-xl font-semibold text-primary dark:text-primary">
      {formatCurrency(price)}
    </Text>
  )
})
