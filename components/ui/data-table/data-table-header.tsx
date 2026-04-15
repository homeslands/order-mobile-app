import { cn } from '@/lib/utils'
import { colors } from '@/constants'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react-native'
import React, { useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useDataTableContext } from './data-table-context'
import type { DataTableColumnResolved } from './types'

/** Sticky header: sort indicators, no logic (toggleSort from context). */
export function DataTableHeader() {
  const { columns, sortKey, sortDirection, toggleSort, totalWidth } =
    useDataTableContext()
  const visibleColumns = columns.filter((c) => c.visible)

  const renderCell = useCallback(
    (col: DataTableColumnResolved<unknown>) => {
      const isSorted = sortKey === col.key
      const dir = isSorted ? sortDirection : 'none'
      const canSort = col.sortable !== false

      return (
        <Pressable
          key={col.key}
          onPress={() => canSort && toggleSort(col.key)}
          className={cn(
            'flex-row items-center gap-1 border-r border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50',
            canSort && 'active:opacity-70',
          )}
          style={{ width: col.widthResolved, minWidth: col.widthResolved }}
        >
          <Text
            className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300"
            numberOfLines={1}
          >
            {col.title}
          </Text>
          {canSort && (
            <View className="opacity-60">
              {dir === 'asc' && <ArrowUp size={14} color={colors.gray[500]} />}
              {dir === 'desc' && <ArrowDown size={14} color={colors.gray[500]} />}
              {dir === 'none' && <ChevronsUpDown size={14} color={colors.gray[500]} />}
            </View>
          )}
        </Pressable>
      )
    },
    [sortKey, sortDirection, toggleSort],
  )

  return (
    <View
      style={{ width: totalWidth, minWidth: totalWidth }}
      className="flex-row border-b border-gray-200 dark:border-gray-700"
    >
      {visibleColumns.map((col) => renderCell(col))}
    </View>
  )
}
