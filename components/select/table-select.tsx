import { ChevronDown } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, useColorScheme } from 'react-native'

import { cn } from '@/lib/utils'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'

interface TableSelectProps {
  /** Gọi trước open() — hook phụ (analytics, v.v.) */
  onBeforeOpen?: () => void
  /** true = chỉ gọi onBeforeOpen, không load/open sheet (parent render sheet với openOnMount) */
  useMountOpen?: boolean
}

export default function TableSelect({
  onBeforeOpen,
  useMountOpen = false,
}: TableSelectProps) {
  const { t } = useTranslation('table')
  const isDark = useColorScheme() === 'dark'

  const getCartItems = useOrderFlowStore((s) => s.getCartItems)
  const cartItems = getCartItems()
  const cartType = cartItems?.type
  const selectedTableId = cartItems?.table
  const tableName = cartItems?.tableName

  // B3: Không fetch useTables — dùng tableName từ store. Fetch chỉ khi mở sheet.
  const displayText =
    selectedTableId && tableName ? tableName : t('table.title')

  // TAKE OUT không chọn bàn
  if (cartType === OrderTypeEnum.TAKE_OUT) return null

  const handlePress = () => {
    onBeforeOpen?.()
    if (useMountOpen) return
    import('./table-select-sheet').then((m) => {
      ;(m.default as { open?: () => void }).open?.()
    })
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={cn(
        'flex-row items-center gap-2 h-11 px-3 py-2 rounded-md w-full',
        'bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        !selectedTableId && 'border-red-300 dark:border-red-700',
        'active:bg-gray-100/50 dark:active:bg-gray-700/50'
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          'flex-1 text-sm',
          selectedTableId
            ? 'font-medium text-gray-900 dark:text-gray-50'
            : 'text-gray-500 dark:text-gray-400'
        )}
      >
        {displayText}
      </Text>

      <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
    </TouchableOpacity>
  )
}
