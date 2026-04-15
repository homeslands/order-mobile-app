import React from 'react'
import { View, Text } from 'react-native'
import { cn } from '@/lib/utils'
import type { DataTableColumnResolved } from './types'

interface DataTableCellProps<T> {
  column: DataTableColumnResolved<T>
  row: T
  value: unknown
}

/** Presentational cell: no logic, only render value or column.render(row, value). */
export function DataTableCell<T>({ column, row, value }: DataTableCellProps<T>) {
  const content = column.render
    ? column.render(row, value)
    : (value != null && value !== '' ? String(value) : '—')

  const isPrimitive =
    content == null ||
    typeof content === 'string' ||
    typeof content === 'number'

  return (
    <View
      className={cn(
        'flex-1 justify-center px-3 py-2.5 border-r border-gray-100 dark:border-gray-800'
      )}
      style={{ width: column.widthResolved, minWidth: column.widthResolved }}
    >
      {isPrimitive ? (
        <Text className="text-sm text-gray-900 dark:text-gray-100" numberOfLines={1}>
          {content ?? '—'}
        </Text>
      ) : (
        content
      )}
    </View>
  )
}
