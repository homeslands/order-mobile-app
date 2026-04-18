import { memo, useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import type { LucideIcon } from 'lucide-react-native'

import { Input, Label, RadioGroupItem } from '@/components/ui'
import { PaymentMethod } from '@/constants'
import { cn } from '@/lib/utils'

interface PaymentMethodOptionProps {
  method: PaymentMethod
  icon: LucideIcon
  label: string
  isSupported: boolean
  isDark: boolean
  disabledReason?: string
  onSelect: (method: PaymentMethod) => void
  /** Called when user taps an unsupported method (e.g. voucher conflict) */
  onSelectDisabled?: (method: PaymentMethod) => void
  /** For credit card: show transaction ID input */
  showTransactionInput?: boolean
  transactionId?: string
  onTransactionIdChange?: (id: string) => void
  transactionPlaceholder?: string
  /** For point payment: renders a column layout with balance info */
  pointLayout?: boolean
  /** Additional content rendered below the label row */
  children?: React.ReactNode
}

export const PaymentMethodOption = memo(function PaymentMethodOption({
  method,
  icon: Icon,
  label,
  isSupported,
  isDark,
  disabledReason,
  onSelect,
  onSelectDisabled,
  showTransactionInput,
  transactionId,
  onTransactionIdChange,
  transactionPlaceholder,
  pointLayout,
  children,
}: PaymentMethodOptionProps) {
  const handlePress = useCallback(() => {
    if (isSupported) {
      onSelect(method)
    } else if (onSelectDisabled) {
      onSelectDisabled(method)
    }
  }, [isSupported, onSelect, onSelectDisabled, method])

  const iconColor = isDark ? '#9ca3af' : '#6b7280'

  if (pointLayout) {
    return (
      <View className="flex-row gap-2">
        <RadioGroupItem
          value={method}
          disabled={!isSupported}
          className="mt-0.5"
        />
        <Pressable onPress={handlePress} className="flex-1">
          <View className="flex-col gap-1">
            <View
              className={cn(
                'flex-row items-center gap-1 pl-2',
                isSupported ? 'opacity-100' : 'opacity-50',
              )}
            >
              <Icon size={20} color={iconColor} />
              <Label
                className={cn(
                  'flex-row items-center gap-1',
                  !isSupported && 'opacity-50',
                )}
              >
                <View className="flex-col">
                  <Text className="text-gray-700 dark:text-gray-300">
                    {label}
                  </Text>
                  {!isSupported && disabledReason && (
                    <Text className="text-xs text-orange-500">
                      ({disabledReason})
                    </Text>
                  )}
                </View>
              </Label>
            </View>
            {children}
          </View>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-row items-center gap-2">
      <View className="flex-col gap-2">
        <View className="flex-row items-center gap-2">
          <RadioGroupItem value={method} disabled={!isSupported} />
          <Pressable onPress={handlePress}>
            <View
              className={cn(
                'flex-row items-center gap-1 pl-2',
                isSupported ? 'opacity-100' : 'opacity-50',
              )}
            >
              <Icon size={20} color={iconColor} />
              <Label
                className={cn(
                  'flex-row items-center gap-1',
                  !isSupported && 'opacity-50',
                )}
              >
                <Text className="text-gray-700 dark:text-gray-300">
                  {label}
                </Text>
                {!isSupported && disabledReason && (
                  <Text className="ml-1 text-xs text-orange-500">
                    ({disabledReason})
                  </Text>
                )}
              </Label>
            </View>
          </Pressable>
        </View>
        {showTransactionInput && (
          <View className="ml-6">
            <Input
              placeholder={transactionPlaceholder}
              className="h-9 text-sm"
              value={transactionId}
              onChangeText={onTransactionIdChange}
              editable={isSupported}
            />
          </View>
        )}
      </View>
    </View>
  )
})
