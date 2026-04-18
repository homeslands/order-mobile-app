import { colors } from '@/constants'
import { useTables } from '@/hooks/use-table'
import { useBranchStore, useOrderFlowStore } from '@/stores'
import type { ITable } from '@/types'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { CheckCircle } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'

const TABLE_SHEET_SNAP = ['50%']
const TABLE_PAGE_SIZE = 12

export const SimpleTableSheet = memo(function SimpleTableSheet({
  visible,
  onClose,
  isDark,
  primaryColor,
}: {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { t } = useTranslation('table')
  const selectedTable = useOrderFlowStore((s) => s.orderingData?.table)
  const branchSlug = useBranchStore((s) => s.branch?.slug)

  // Fetch only when visible
  const { data: tablesRes, isLoading } = useTables(
    visible ? branchSlug : undefined,
  )
  const allTables = useMemo(() => tablesRes?.result ?? [], [tablesRes?.result])

  // Pagination
  const [visibleCount, setVisibleCount] = useState(TABLE_PAGE_SIZE)
  const visibleTables = useMemo(
    () => allTables.slice(0, visibleCount),
    [allTables, visibleCount],
  )
  const hasMore = visibleCount < allTables.length

  // Reset handled by key prop in parent — remounts when visible changes

  const handleLoadMore = useCallback(() => {
    if (hasMore) setVisibleCount((c) => c + TABLE_PAGE_SIZE)
  }, [hasMore])

  const handleSelect = useCallback((table: ITable) => {
    useOrderFlowStore.getState().setOrderingTable(table)
    sheetRef.current?.dismiss()
  }, [])

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    [],
  )
  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={TABLE_SHEET_SNAP}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        style={{ paddingHorizontal: 20, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            tableSheetStyles.title,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
        >
          {t('table.title', 'Chọn bàn')}
        </Text>

        {isLoading && (
          <View style={tableSheetStyles.loadingWrap}>
            <ActivityIndicator
              size="small"
              color={isDark ? '#9ca3af' : '#6b7280'}
            />
            <Text
              style={{
                fontSize: 13,
                color: isDark ? colors.gray[400] : colors.gray[500],
                marginTop: 8,
              }}
            >
              Đang tải...
            </Text>
          </View>
        )}

        {!isLoading && allTables.length === 0 && (
          <Text
            style={{
              fontSize: 14,
              color: isDark ? colors.gray[400] : colors.gray[500],
              textAlign: 'center',
              paddingVertical: 24,
            }}
          >
            Không có bàn nào
          </Text>
        )}

        <View style={tableSheetStyles.grid}>
          {visibleTables.map((table: ITable) => {
            const selected = selectedTable === table.slug
            const isAvailable = table.status === 'available'
            const statusColor = isAvailable ? '#22c55e' : '#ef4444'
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                key={table.slug}
                onPress={() => handleSelect(table)}
                style={[
                  tableSheetStyles.tableItem,
                  {
                    borderColor: selected
                      ? primaryColor
                      : isDark
                        ? colors.gray[700]
                        : colors.gray[200],
                    backgroundColor: selected
                      ? `${primaryColor}10`
                      : 'transparent',
                  },
                ]}
              >
                <View
                  style={[
                    tableSheetStyles.statusDot,
                    { backgroundColor: statusColor },
                  ]}
                />
                <View style={tableSheetStyles.tableNameRow}>
                  <Text
                    style={[
                      tableSheetStyles.tableName,
                      {
                        color: isDark ? colors.gray[50] : colors.gray[900],
                        fontWeight: selected ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    Bàn {table.name}
                  </Text>
                  <Text
                    style={[
                      tableSheetStyles.tableStatus,
                      { color: statusColor },
                    ]}
                  >
                    · {isAvailable ? 'Trống' : 'Đã đặt'}
                  </Text>
                </View>
                {selected && <CheckCircle size={16} color={primaryColor} />}
              </TouchableOpacity>
            )
          })}
        </View>

        {hasMore && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleLoadMore}
            style={tableSheetStyles.loadMoreBtn}
          >
            <Text
              style={{ fontSize: 13, fontWeight: '600', color: primaryColor }}
            >
              Tải thêm
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 20 }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const tableSheetStyles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  grid: {
    gap: 8,
  },
  tableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tableNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tableName: {
    fontSize: 14,
  },
  tableStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
})
