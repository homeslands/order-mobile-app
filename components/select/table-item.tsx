import { Check, Circle } from 'lucide-react-native'
import { memo, useCallback } from 'react'
import { Text, TouchableOpacity, View } from 'react-native'

import { TableStatus } from '@/constants'
import { colors } from '@/constants/colors.constant'
import { cn } from '@/lib/utils'
import { ITable } from '@/types'

interface TableItemProps {
  table: ITable
  isSelected: boolean
  isDark: boolean
  statusLabel: string
  onSelect: (table: ITable) => void
}

const TableItem = memo(function TableItem({
  table,
  isSelected,
  statusLabel,
  onSelect,
}: TableItemProps) {
  const isReserved = table.status === TableStatus.RESERVED
  const isAvailable = table.status === TableStatus.AVAILABLE

  const handlePress = useCallback(() => {
    onSelect(table)
  }, [onSelect, table])

  return (
    <TouchableOpacity
      onPress={handlePress}
      className={cn(
        'mx-3 my-2 flex-row items-center gap-3 rounded-xl p-4',
        isSelected
          ? 'border border-primary/60 bg-primary/5'
          : 'border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900',
      )}
    >
      <View
        className={cn(
          'h-6 w-6 items-center justify-center rounded-full',
          isSelected ? 'bg-primary/10' : 'bg-gray-100 dark:bg-gray-800',
        )}
      >
        <Circle
          size={10}
          color={
            isReserved
              ? '#ef4444'
              : isAvailable
                ? '#22c55e'
                : colors.mutedForeground.light
          }
          fill={
            isReserved
              ? '#ef4444'
              : isAvailable
                ? '#22c55e'
                : 'transparent'
          }
        />
      </View>

      <View className="flex-1 flex-row items-center gap-2">
        <Text
          numberOfLines={1}
          className={cn(
            'flex-shrink text-base font-semibold',
            'text-gray-900 dark:text-gray-50',
          )}
        >
          {table.name}
        </Text>
        <Text className="text-sm text-gray-400 dark:text-gray-500">-</Text>
        <Text
          numberOfLines={1}
          className={cn(
            'flex-1 text-sm font-medium',
            isReserved
              ? 'text-red-600 dark:text-red-400'
              : isAvailable
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {statusLabel || table.status}
        </Text>
      </View>

      {isSelected && (
        <View className="ml-2 h-6 items-center justify-center rounded-full bg-primary/10 px-3">
          <Check size={14} color={colors.primary.light} />
        </View>
      )}
    </TouchableOpacity>
  )
})

export { TableItem }
export type { TableItemProps }
