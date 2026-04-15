import React from 'react'
import { useTranslation } from 'react-i18next'
import { View, Text } from 'react-native'
import { useDataTableContext } from './data-table-context'
import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'

interface DataTableToolbarProps {
  className?: string
  showFilters?: boolean
}

/** Presentational toolbar: filter inputs only, setFilter from context. */
export function DataTableToolbar({ className, showFilters = true }: DataTableToolbarProps) {
  const { t } = useTranslation('common')
  const { columns, filters, setFilter } = useDataTableContext()
  const filterableColumns = columns.filter((c) => c.visible && c.filterable)

  if (!showFilters || filterableColumns.length === 0) return null

  const filterPlaceholder = t('dataTable.search')

  return (
    <View
      className={cn(
        'flex-row flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30',
        className
      )}
    >
      {filterableColumns.map((col) => (
        <View key={col.key} className="min-w-[120px] max-w-[200px]">
          <Text className="mb-0.5 text-xs text-gray-500 dark:text-gray-400">{col.title}</Text>
          <Input
            value={filters[col.key] ?? ''}
            onChangeText={(v) => setFilter(col.key, v)}
            placeholder={filterPlaceholder ? `${filterPlaceholder} ${col.title}...` : `Filter ${col.title}...`}
            className="h-8 text-sm"
          />
        </View>
      ))}
    </View>
  )
}
