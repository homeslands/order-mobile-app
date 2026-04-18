import React from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text, Pressable } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useDataTableContext } from './data-table-context'
import { Select } from '@/components/ui'
import { cn } from '@/lib/utils'
import { colors } from '@/constants'

const PAGE_SIZES = [10, 20, 30, 50, 100]

/** Presentational pagination: reads pagination from context. Rendered below the table when used as DataTable child. */
export function DataTablePagination() {
  const { t } = useTranslation('common')
  const { pagination } = useDataTableContext()
  if (!pagination) return null

  const {
    pageIndex,
    pageSize,
    totalRows,
    totalPages,
    canPreviousPage,
    canNextPage,
    setPageSize,
    previousPage,
    nextPage,
  } = pagination

  const rowsPerPageLabel = t('dataTable.rowsPerPage')
  const pageLabel = t('dataTable.page')
  const ofLabel = t('dataTable.of')
  const rowsLabel = t('dataTable.rows')

  return (
    <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-gray-50/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/30">
      <View className="flex-row items-center gap-2">
        <Text className="text-xs text-gray-600 dark:text-gray-400">
          {rowsPerPageLabel}
        </Text>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => setPageSize(Number(v))}
        >
          <Select.Trigger className="h-8 w-16">
            <Select.Value placeholder={String(pageSize)} />
          </Select.Trigger>
          <Select.Content>
            {PAGE_SIZES.map((size) => (
              <Select.Item key={size} value={String(size)}>
                {size}
              </Select.Item>
            ))}
          </Select.Content>
        </Select>
      </View>
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {pageLabel} {pageIndex + 1} {ofLabel} {totalPages} ({totalRows}{' '}
        {rowsLabel})
      </Text>
      <View className="flex-row items-center gap-1">
        <Pressable
          onPress={previousPage}
          disabled={!canPreviousPage}
          className={cn(
            'h-8 w-8 items-center justify-center rounded',
            canPreviousPage ? 'active:opacity-70' : 'opacity-40',
          )}
        >
          <ChevronLeft size={18} color={colors.gray[700]} />
        </Pressable>
        <Pressable
          onPress={nextPage}
          disabled={!canNextPage}
          className={cn(
            'h-8 w-8 items-center justify-center rounded',
            canNextPage ? 'active:opacity-70' : 'opacity-40',
          )}
        >
          <ChevronRight size={18} color={colors.gray[700]} />
        </Pressable>
      </View>
    </View>
  )
}
DataTablePagination.displayName = 'DataTablePagination'
