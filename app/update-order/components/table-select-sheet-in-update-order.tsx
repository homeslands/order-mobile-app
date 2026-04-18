import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFlatList,
} from '@gorhom/bottom-sheet'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, useColorScheme, View } from 'react-native'

import TableRow from '@/components/select/table-row'
import { TableStatus } from '@/constants'
import { useTables } from '@/hooks'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { ITable } from '@/types'

let sheetRef: BottomSheet | null = null

function TableSelectSheetInUpdateOrder() {
  const { t } = useTranslation('table')
  const isDark = useColorScheme() === 'dark'
  const bottomSheetRef = useRef<BottomSheet>(null)
  const branch = useBranchStore((s) => s.branch)
  const userInfo = useUserStore((s) => s.userInfo)
  const updatingData = useOrderFlowStore((s) => s.updatingData)
  const setDraftTable = useOrderFlowStore((s) => s.setDraftTable)

  const branchSlug = branch?.slug || userInfo?.branch?.slug || ''
  const selectedTableId = updatingData?.updateDraft?.table ?? null

  useEffect(() => {
    const currentRef = bottomSheetRef.current
    if (currentRef) sheetRef = currentRef
    return () => {
      if (sheetRef === currentRef) sheetRef = null
    }
  }, [])

  const snapPoints = useMemo(() => ['50%'], [])
  const { data, isLoading } = useTables(branchSlug)
  const tables = data?.result || []

  const statusLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    Object.values(TableStatus).forEach((status) => {
      map[status] = t(`table.${status}`)
    })
    return map
  }, [t])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  )

  const renderItem = useCallback(
    ({ item }: { item: ITable }) => (
      <TableRow
        table={item}
        isSelected={selectedTableId === item.slug}
        statusLabel={statusLabelMap[item.status] || item.status}
        onPress={() => {
          setDraftTable(item)
          bottomSheetRef.current?.close()
        }}
      />
    ),
    [setDraftTable, selectedTableId, statusLabelMap],
  )

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: isDark ? '#111827' : '#ffffff' }}
      containerStyle={{ zIndex: 9999, elevation: 9999 }}
    >
      <View className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <Text className="text-base font-semibold text-gray-900 dark:text-gray-50">
          {t('table.title')}
        </Text>
      </View>
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator
            size="small"
            color={isDark ? '#9ca3af' : '#6b7280'}
          />
          <Text className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {t('table.loading', 'Đang tải...')}
          </Text>
        </View>
      ) : tables.length > 0 ? (
        <BottomSheetFlatList
          data={tables}
          keyExtractor={(item: ITable) => item.slug}
          renderItem={renderItem}
        />
      ) : (
        <View className="flex-1 items-center justify-center py-12">
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {t('table.noTables', 'Không có bàn nào')}
          </Text>
        </View>
      )}
    </BottomSheet>
  )
}

TableSelectSheetInUpdateOrder.open = () => {
  sheetRef?.snapToIndex(0)
}

export default TableSelectSheetInUpdateOrder
