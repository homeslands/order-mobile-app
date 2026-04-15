import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Badge } from '@/components/ui'
import { IOrderingData } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { calculateCartDisplayAndTotals, formatCurrency } from '@/utils'

interface OrderItemsListProps {
  order: IOrderingData | null
  displayItemsBySlug: Map<
    string,
    ReturnType<typeof calculateCartDisplayAndTotals>['displayItems'][number]
  >
  cartTotals: {
    subTotalBeforeDiscount: number
    promotionDiscount: number
    voucherDiscount: number
    finalTotal: number
  }
  deliveryFee: number
  /** When true, render only the pricing summary (subtotal, discounts, total) without the items list. */
  pricingSummaryOnly?: boolean
}

function OrderItemsListInner({
  order,
  displayItemsBySlug,
  cartTotals,
  deliveryFee,
  pricingSummaryOnly = false,
}: OrderItemsListProps) {
  const { t } = useTranslation(['menu'])

  return (
    <>
      {!pricingSummaryOnly && (
      <View className="mt-6 flex-col gap-4 border-t border-dashed border-gray-300 px-2 py-4 dark:border-gray-600">
        {order?.orderItems.map((item) => (
          <View
            key={item.id}
            className="flex-row items-center justify-between"
          >
            <View className="flex-1 flex-col gap-2">
              <Text className="font-bold">{item.name}</Text>
              <View className="flex-row gap-2">
                <Badge className="w-fit text-xs" variant="outline">
                  <Text className="text-gray-600 dark:text-gray-400">
                    Size {item.size.toUpperCase()}
                  </Text>
                </Badge>
                <Text className="text-sm text-gray-600 dark:text-gray-400">
                  x{item.quantity}
                </Text>
              </View>
            </View>
            {(() => {
              const finalPrice =
                (displayItemsBySlug.get(item.slug ?? '')?.finalPrice ??
                  0) * item.quantity
              const original =
                (item.originalPrice ?? item.originalPrice ?? 0) *
                item.quantity

              const hasDiscount = original > finalPrice

              return (
                <View className="flex-row items-center gap-1">
                  {hasDiscount ? (
                    <>
                      <Text className="mr-1 text-gray-400 line-through">
                        {formatCurrency(original)}
                      </Text>
                      <Text className="font-bold text-primary dark:text-primary">
                        {formatCurrency(finalPrice)}
                      </Text>
                    </>
                  ) : (
                    <Text className="font-bold text-primary dark:text-primary">
                      {formatCurrency(finalPrice)}
                    </Text>
                  )}
                </View>
              )
            })()}
          </View>
        ))}
      </View>
      )}

      {/* Pricing Summary */}
      <View className="w-full flex-col items-start justify-start gap-1">
        <View className="w-full flex-row items-center justify-between gap-2">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {t('order.subtotal')}:{' '}
          </Text>
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {formatCurrency(cartTotals.subTotalBeforeDiscount)}
          </Text>
        </View>
        {cartTotals.promotionDiscount > 0 && (
          <View className="w-full flex-row items-center justify-between gap-2">
            <Text className="text-sm italic text-yellow-600">
              {t('order.promotionDiscount')}:
            </Text>
            <Text className="text-sm italic text-yellow-600">
              -{formatCurrency(cartTotals.promotionDiscount)}
            </Text>
          </View>
        )}
        <View className="w-full flex-row items-center justify-between gap-2">
          <Text className="text-sm italic text-green-500">
            {t('order.voucher')}:
          </Text>
          <Text className="text-sm italic text-green-500">
            -{formatCurrency(cartTotals.voucherDiscount)}
          </Text>
        </View>
        {order?.type === OrderTypeEnum.DELIVERY && (
          <View className="w-full flex-row items-center justify-between gap-2">
            <Text className="text-sm italic text-gray-600 dark:text-gray-400">
              {t('order.deliveryFee')}:
            </Text>
            <Text className="text-sm italic text-gray-600 dark:text-gray-400">
              {formatCurrency(deliveryFee)}
            </Text>
          </View>
        )}
        <View className="mt-4 w-full flex-row items-center justify-between gap-2 border-t border-gray-200 pt-2 dark:border-gray-700">
          <Text className="text-base font-semibold">
            {t('order.totalPayment')}:{' '}
          </Text>
          <Text className="text-2xl font-extrabold text-primary">
            {formatCurrency(
              cartTotals.finalTotal + deliveryFee,
            )}
          </Text>
        </View>
      </View>
    </>
  )
}

export const OrderItemsList = memo(OrderItemsListInner)
