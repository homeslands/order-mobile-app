import { Clock, MapPin, Notebook, Phone, Receipt } from 'lucide-react-native'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { Badge } from '@/components/ui'
import { IOrderingData } from '@/stores'
import { OrderTypeEnum } from '@/types'

interface OrderInfoSectionProps {
  order: IOrderingData | null
}

function OrderInfoSectionInner({ order }: OrderInfoSectionProps) {
  const { t } = useTranslation(['menu'])

  return (
    <View className="flex-col gap-2">
      <View className="flex-row items-center justify-between rounded-md border bg-gray-100 px-2 py-3 text-sm dark:bg-gray-900">
        <View className="flex-row items-center gap-2">
          <Receipt size={16} color="#6b7280" />
          <Text className="text-gray-600 dark:text-gray-400">
            {t('order.orderType')}
          </Text>
        </View>
        <Badge
          className={`shadow-none ${order?.type === OrderTypeEnum.AT_TABLE ? '' : 'bg-blue-500/20'}`}
        >
          <Text
            className={
              order?.type !== OrderTypeEnum.AT_TABLE ? 'text-blue-500' : ''
            }
          >
            {order?.type === OrderTypeEnum.AT_TABLE
              ? t('menu.dineIn')
              : order?.type === OrderTypeEnum.DELIVERY
                ? t('menu.delivery')
                : t('menu.takeAway')}
          </Text>
        </Badge>
      </View>
      {order?.timeLeftTakeOut !== undefined && (
        <View className="flex-row justify-between rounded-md border bg-gray-100 px-2 py-3 text-sm dark:bg-gray-900">
          <View className="flex-row items-center gap-2">
            <Clock size={16} color="#6b7280" />
            <Text className="text-gray-600 dark:text-gray-400">
              {t('menu.pickupTime')}
            </Text>
          </View>
          <Badge>
            <Text className="font-medium">
              {order.timeLeftTakeOut === 0
                ? t('menu.immediately')
                : `${order.timeLeftTakeOut} ${t('menu.minutes')}`}
            </Text>
          </Badge>
        </View>
      )}
      {order?.tableName && (
        <View className="flex-row justify-between rounded-md border bg-gray-100 px-2 py-3 text-sm dark:bg-gray-900">
          <View className="flex-row items-center gap-2">
            <MapPin size={16} color="#6b7280" />
            <Text className="text-gray-600 dark:text-gray-400">
              {t('menu.tableName')}
            </Text>
          </View>
          <Text className="font-medium">{`Bàn số ${order.tableName}`}</Text>
        </View>
      )}
      {order?.type === OrderTypeEnum.DELIVERY && order?.deliveryAddress && (
        <View className="flex-row justify-between rounded-md border bg-gray-100 px-2 py-3 text-sm dark:bg-gray-900">
          <View className="flex-row items-center gap-2">
            <MapPin size={16} color="#6b7280" />
            <Text className="text-gray-600 dark:text-gray-400">
              {t('menu.deliveryAddress')}
            </Text>
          </View>
          <Text className="max-w-[70%] text-right font-medium">
            {order.deliveryAddress}
          </Text>
        </View>
      )}
      {order?.type === OrderTypeEnum.DELIVERY && order?.deliveryPhone && (
        <View className="flex-row justify-between rounded-md border bg-gray-100 px-2 py-3 text-sm dark:bg-gray-900">
          <View className="flex-row items-center gap-2">
            <Phone size={16} color="#6b7280" />
            <Text className="text-gray-600 dark:text-gray-400">
              {t('menu.deliveryPhone')}
            </Text>
          </View>
          <Text className="font-medium">{order.deliveryPhone}</Text>
        </View>
      )}
      {order?.description && (
        <View className="flex-row justify-between rounded-md border bg-gray-100 px-2 py-3 text-sm dark:bg-gray-900">
          <View className="flex-row items-center gap-2">
            <Notebook size={16} color="#6b7280" />
            <Text className="text-gray-600 dark:text-gray-400">
              {t('order.note')}
            </Text>
          </View>
          <Text className="font-medium">{order.description}</Text>
        </View>
      )}
    </View>
  )
}

export const OrderInfoSection = memo(OrderInfoSectionInner)
