import { Check } from 'lucide-react-native'
import { memo } from 'react'
import { Text, TouchableOpacity, View, useColorScheme } from 'react-native'

import { TableStatus } from '@/constants'
import { cn } from '@/lib/utils'
import { ITable } from '@/types'

interface Props {
  table: ITable
  isSelected: boolean
  statusLabel?: string
  onPress: () => void
}

function TableRow({ table, isSelected, statusLabel, onPress }: Props) {
  const isDark = useColorScheme() === 'dark'
  const isAvailable = table.status === TableStatus.AVAILABLE
  const isReserved = table.status === TableStatus.RESERVED

  return (
    <TouchableOpacity
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 px-4 py-3',
        'border-b border-gray-100 dark:border-gray-800',
        isSelected && 'bg-gray-50 dark:bg-gray-800/50',
        'active:bg-gray-100 dark:active:bg-gray-700',
      )}
    >
      {/* Indicator dot để phân biệt trạng thái bàn */}
      <View
        className={cn(
          'h-2.5 w-2.5 rounded-full',
          isAvailable
            ? 'bg-green-500'
            : isReserved
              ? 'bg-red-500'
              : 'bg-gray-400',
        )}
      />

      <View className="flex-1">
        <Text
          numberOfLines={1}
          className={cn(
            'text-sm font-medium',
            isReserved
              ? 'text-red-600 dark:text-red-400'
              : isSelected
                ? 'text-primary dark:text-primary'
                : 'text-gray-900 dark:text-gray-50',
          )}
        >
          {table.name}
        </Text>
        {!!statusLabel && (
          <Text className="mt-1 text-xs text-gray-600 dark:text-gray-300">
            {statusLabel}
          </Text>
        )}
      </View>

      {isSelected && <Check size={16} color={isDark ? '#9ca3af' : '#6b7280'} />}
    </TouchableOpacity>
  )
}

export default memo(TableRow)
