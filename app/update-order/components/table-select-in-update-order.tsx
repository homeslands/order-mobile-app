import { ChevronDown } from 'lucide-react-native'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, TouchableOpacity, useColorScheme } from 'react-native'

import { useTables } from '@/hooks'
import { cn } from '@/lib/utils'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { ITable, OrderTypeEnum } from '@/types'

import TableSelectSheetInUpdateOrder from './table-select-sheet-in-update-order'

interface TableSelectInUpdateOrderProps {
  tableOrder?: ITable | null
  orderType: string
}

export default function TableSelectInUpdateOrder({
  tableOrder,
  orderType,
}: TableSelectInUpdateOrderProps) {
  const { t } = useTranslation('table')
  const isDark = useColorScheme() === 'dark'
  const branch = useBranchStore((s) => s.branch)
  const userInfo = useUserStore((s) => s.userInfo)
  const updatingData = useOrderFlowStore((s) => s.updatingData)

  const branchSlug = branch?.slug || userInfo?.branch?.slug || ''
  const selectedTableId = updatingData?.updateDraft?.table ?? tableOrder?.slug ?? null

  const { data: tables } = useTables(branchSlug)
  const selectedTable = useMemo(() => {
    if (!selectedTableId || !tables?.result) return null
    return tables.result.find((tb) => tb.slug === selectedTableId)
  }, [selectedTableId, tables])

  const displayText = useMemo(() => {
    if (!selectedTable) return t('table.title')
    const statusLabel = selectedTable.status ? t(`table.${selectedTable.status}`) : ''
    return `${selectedTable.name} - ${statusLabel}`
  }, [selectedTable, t])

  if (orderType === OrderTypeEnum.TAKE_OUT) return null

  return (
    <>
      <TouchableOpacity
        onPress={() => TableSelectSheetInUpdateOrder.open()}
        className={cn(
          'flex-1 min-w-0 flex-row items-center gap-2 h-11 rounded-md px-3 py-2',
          'bg-white dark:bg-gray-800',
          'border border-gray-200 dark:border-gray-700',
          !selectedTableId && 'border-red-300 dark:border-red-700',
          'active:bg-gray-100/50 dark:active:bg-gray-700/50',
        )}
      >
        <Text
          numberOfLines={1}
          className={cn(
            'flex-1 text-sm',
            selectedTableId
              ? 'font-medium text-gray-900 dark:text-gray-50'
              : 'text-gray-500 dark:text-gray-400',
          )}
        >
          {displayText}
        </Text>
        <ChevronDown size={16} color={isDark ? '#9ca3af' : '#6b7280'} />
      </TouchableOpacity>
      <TableSelectSheetInUpdateOrder />
    </>
  )
}
