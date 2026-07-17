import { colors, TableStatus } from '@/constants'
import { useTables } from '@/hooks/use-table'
import { useBranchStore, useOrderFlowStore } from '@/stores'
import type { ITable } from '@/types'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlashList,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { CheckCircle } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmReservedTableSheet } from './confirm-reserved-table-sheet'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import type { ListRenderItem } from '@shopify/flash-list'
import { Text } from '@/components/ui/text'

const TABLE_SHEET_SNAP = ['50%']
const COLUMNS = 3
const CHIP_HEIGHT = 72

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
  const [pendingReservedTable, setPendingReservedTable] =
    useState<ITable | null>(null)

  const { data: tablesRes, isLoading } = useTables(
    visible ? branchSlug : undefined,
  )
  const allTables = useMemo(() => tablesRes?.result ?? [], [tablesRes?.result])

  const handleSelect = useCallback((table: ITable) => {
    if (table.status === TableStatus.AVAILABLE) {
      useOrderFlowStore.getState().setOrderingTable(table)
      sheetRef.current?.dismiss()
    } else {
      setPendingReservedTable(table)
    }
  }, [])

  /**
   * Modal confirm nằm CHỒNG LÊN modal bàn. Nếu dismiss cả hai trong cùng một
   * tick, modal stack của gorhom hỏng: modal bàn không bắn `onDismiss` →
   * `visible` ở parent kẹt `true` → lần sau bấm "Chọn bàn" thì
   * `setTableSheetVisible(true)` không đổi state → effect không chạy →
   * `present()` không được gọi → sheet không mở lại được.
   * Vì vậy: chỉ đóng modal confirm ở đây, và đợi nó đóng XONG (onDismiss) rồi
   * mới dismiss modal bàn.
   */
  const closeTableAfterConfirmRef = useRef(false)

  const handleConfirmReserved = useCallback(() => {
    if (!pendingReservedTable) return
    useOrderFlowStore.getState().setOrderingTable(pendingReservedTable)
    closeTableAfterConfirmRef.current = true
    setPendingReservedTable(null)
  }, [pendingReservedTable])

  /** Chạy khi modal confirm đã đóng hẳn (cả nút Huỷ, backdrop lẫn Xác nhận). */
  const handleReservedSheetDismissed = useCallback(() => {
    setPendingReservedTable(null)
    if (closeTableAfterConfirmRef.current) {
      closeTableAfterConfirmRef.current = false
      sheetRef.current?.dismiss()
    }
  }, [])

  const renderItem: ListRenderItem<ITable> = useCallback(
    ({ item: table }) => {
      const selected = selectedTable === table.slug
      const isAvailable = table.status === TableStatus.AVAILABLE
      const statusColor = isAvailable
        ? isDark
          ? colors.success.dark
          : colors.success.light
        : isDark
          ? colors.destructive.dark
          : colors.destructive.light

      return (
        // Opacity on a plain View — not on TouchableOpacity — to avoid
        // RNGH's animated opacity conflicting with FlashList view recycling.
        <View style={chipStyles.chipWrapper}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleSelect(table)}
            style={[
              chipStyles.chip,
              {
                borderColor: selected
                  ? primaryColor
                  : isDark
                    ? colors.border.dark
                    : colors.gray[200],
                backgroundColor: selected ? `${primaryColor}15` : 'transparent',
              },
            ]}
          >
            {selected && (
              <CheckCircle
                size={14}
                color={primaryColor}
                style={chipStyles.checkIcon}
              />
            )}
            <Text
              style={[
                chipStyles.chipName,
                {
                  color: isDark ? colors.gray[50] : colors.gray[900],
                  fontWeight: selected ? '700' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {table.name}
            </Text>
            <View style={chipStyles.statusRow}>
              <View
                style={[chipStyles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[chipStyles.statusText, { color: statusColor }]}>
                {isAvailable ? 'Trống' : 'Đặt'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )
    },
    [selectedTable, primaryColor, isDark, handleSelect],
  )

  const keyExtractor = useCallback((item: ITable) => item.slug, [])

  const ListHeader = useMemo(
    () => (
      <Text
        style={[
          chipStyles.title,
          { color: isDark ? colors.gray[50] : colors.gray[900] },
        ]}
      >
        {t('table.title', 'Chọn bàn')}
      </Text>
    ),
    [isDark, t],
  )

  const ListEmpty = useMemo(
    () =>
      isLoading ? (
        <View style={chipStyles.loadingWrap}>
          <ActivityIndicator
            size="small"
            color={
              isDark
                ? colors.mutedForeground.dark
                : colors.mutedForeground.light
            }
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
      ) : (
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
      ),
    [isLoading, isDark],
  )

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.card.dark : colors.white.light }),
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
    <>
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
        <BottomSheetFlashList
          data={allTables}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={COLUMNS}
          estimatedItemSize={CHIP_HEIGHT}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={chipStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        />
      </BottomSheetModal>
      <ConfirmReservedTableSheet
        visible={!!pendingReservedTable}
        tableName={pendingReservedTable?.name ?? ''}
        onConfirm={handleConfirmReserved}
        onCancel={handleReservedSheetDismissed}
      />
    </>
  )
})

const chipStyles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  chipWrapper: {
    flex: 1,
    margin: 4,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
  },
  checkIcon: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  chipName: {
    fontSize: 14,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
})
