import { Check, ShoppingBag } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, View, useColorScheme } from 'react-native'

import { colors } from '@/constants'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui'
import { useOrderTypeOptionsForUpdateOrder } from '@/hooks/use-order-type-options-for-update-order'
import { cn } from '@/lib/utils'

interface OrderTypeSelectInUpdateOrderProps {
  typeOrder: string
}

export default function OrderTypeSelectInUpdateOrder({
  typeOrder,
}: OrderTypeSelectInUpdateOrderProps) {
  const { t } = useTranslation('menu')
  const isDark = useColorScheme() === 'dark'
  const { orderTypes, selectedType, handleChange } =
    useOrderTypeOptionsForUpdateOrder()

  const displayLabel =
    selectedType?.label ??
    typeOrder ??
    t('menu.selectOrderType', 'Chọn loại đơn')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchableOpacity
          className={cn(
            'h-11 min-w-0 flex-1 flex-row items-center gap-2 rounded-md px-3 py-2',
            'bg-white dark:bg-gray-800',
            'border border-gray-200 dark:border-gray-700',
            'active:bg-gray-100/50 dark:active:bg-gray-700/50',
          )}
        >
          <ShoppingBag
            size={16}
            color={isDark ? colors.gray[400] : colors.gray[500]}
          />
          <Text
            className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-50"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {displayLabel}
          </Text>
        </TouchableOpacity>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-full"
        align="start"
        side="bottom"
        sideOffset={4}
      >
        <View className="border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <Text className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            {t('menu.selectOrderType', 'Chọn loại đơn')}
          </Text>
        </View>
        <View className="max-h-[400px]">
          {orderTypes?.map((type, index) => {
            const isSelected = selectedType?.value === type.value
            const isLast = index === orderTypes.length - 1
            return (
              <TouchableOpacity
                key={type.value}
                onPress={() => handleChange(type.value)}
                className={cn(
                  'flex-row items-center gap-3 px-4 py-3',
                  !isLast && 'border-b border-gray-100 dark:border-gray-800',
                  isSelected && 'bg-gray-50 dark:bg-gray-800/50',
                  'active:bg-gray-100 dark:active:bg-gray-700',
                )}
              >
                <View className="mt-0.5">
                  <ShoppingBag
                    size={18}
                    color={isDark ? colors.gray[400] : colors.gray[500]}
                  />
                </View>
                <View className="flex-1 flex-row items-center gap-2">
                  <Text
                    className={cn(
                      'flex-1 text-sm font-medium',
                      isSelected
                        ? 'text-primary'
                        : 'text-gray-900 dark:text-gray-50',
                    )}
                    numberOfLines={1}
                  >
                    {type.label}
                  </Text>
                  {isSelected && (
                    <Check
                      size={16}
                      color={isDark ? colors.gray[400] : colors.gray[500]}
                    />
                  )}
                </View>
              </TouchableOpacity>
            )
          })}
        </View>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
