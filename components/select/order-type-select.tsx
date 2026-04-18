import { ShoppingBag } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, useColorScheme } from 'react-native'

import { useOrderTypeOptions } from '@/hooks'
import { cn } from '@/lib/utils'

interface OrderTypeSelectProps {
  /** B2: Khi false, không fetch feature flags — defer đến khi cần. */
  fetchEnabled?: boolean
  /** Gọi trước open() — dùng cho lazy mount: set activeSheet để mount OrderTypeSheet */
  onBeforeOpen?: () => void
  /** true = chỉ gọi onBeforeOpen, không load/open sheet (parent render sheet với openOnMount) */
  useMountOpen?: boolean
}

export default function OrderTypeSelect({
  fetchEnabled = true,
  onBeforeOpen,
  useMountOpen = false,
}: OrderTypeSelectProps) {
  const { t } = useTranslation('menu')
  const isDark = useColorScheme() === 'dark'
  const { selectedType } = useOrderTypeOptions({ enabled: fetchEnabled })

  const selectedOrderTypeLabel = selectedType?.label || null

  const handlePress = () => {
    onBeforeOpen?.()
    if (useMountOpen) return
    import('./order-type-sheet').then((m) => m.openOrderTypeSheet())
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={cn(
        'h-11 flex-row items-center gap-2 rounded-md px-3 py-2',
        'bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        'active:bg-gray-100/50 dark:active:bg-gray-700/50',
        'w-full',
      )}
    >
      <ShoppingBag size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
      {selectedOrderTypeLabel ? (
        <Text
          className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-50"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {selectedOrderTypeLabel}
        </Text>
      ) : (
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {t('menu.selectOrderType', 'Chọn loại đơn')}
        </Text>
      )}
    </TouchableOpacity>
  )
}
