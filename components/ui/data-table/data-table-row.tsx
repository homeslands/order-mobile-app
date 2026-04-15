import React from 'react'
import { View, Pressable } from 'react-native'
import { DataTableCell } from './data-table-cell'
import { Checkbox } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { DataTableColumnResolved } from './types'

function getValue<T>(row: T, key: string, accessor?: (row: T) => unknown): unknown {
  if (accessor) return accessor(row)
  return (row as Record<string, unknown>)[key]
}

interface DataTableRowProps<T> {
  row: T
  index: number
  columns: DataTableColumnResolved<T>[]
  rowId: string | number
  selected: boolean
  selectable: boolean
  onToggleSelection: (id: string | number) => void
  onPress?: (row: T) => void
}

/** Presentational row: renders cells, optional onPress, optional checkbox when selectable. No business logic. */
export function DataTableRow<T>({
  row,
  columns,
  rowId,
  selected,
  selectable,
  onToggleSelection,
  onPress,
}: DataTableRowProps<T>) {
  const totalWidth = columns.reduce((s, c) => s + c.widthResolved, 0)
  const content = (
    <View style={{ width: totalWidth, minWidth: totalWidth }} className="flex-row">
      {columns.map((col) => (
        <DataTableCell
          key={col.key}
          column={col}
          row={row}
          value={getValue(row, col.key, col.accessor)}
        />
      ))}
    </View>
  )

  const rowClassName = cn(
    'flex-row items-center border-b border-gray-100 dark:border-gray-800',
    selected && 'bg-primary/10 dark:bg-primary/20'
  )

  if (selectable) {
    return (
      <View className={rowClassName}>
        <View className="pl-2 pr-1 py-2">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelection(rowId)}
          />
        </View>
        {content}
      </View>
    )
  }

  if (onPress) {
    return (
      <Pressable onPress={() => onPress(row)} className={cn(rowClassName, 'active:opacity-80')}>
        {content}
      </Pressable>
    )
  }

  return <View className={rowClassName}>{content}</View>
}
