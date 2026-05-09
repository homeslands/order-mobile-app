import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlashList,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import type { ListRenderItem } from '@shopify/flash-list'
import { CheckCircle } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { colors } from '@/constants'
import { TABLE_SELECT_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { useTables } from '@/hooks'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import type { ITable } from '@/types'

const SNAP_POINTS = ['50%']
// item height (48) + separator (8)
const ESTIMATED_ITEM_SIZE = TABLE_SELECT_ITEM_HEIGHT + 8

export const SimpleTableSheetInUpdateOrder = memo(
  function SimpleTableSheetInUpdateOrder({
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

    const selectedTableSlug = useOrderFlowStore(
      (s) => s.updatingData?.updateDraft?.table ?? null,
    )
    const setDraftTable = useOrderFlowStore((s) => s.setDraftTable)
    const branchFromStore = useBranchStore((s) => s.branch?.slug)
    const branchFromUser = useUserStore((s) => s.userInfo?.branch?.slug)
    const branchSlug = branchFromStore || branchFromUser

    const { data: tablesRes, isLoading } = useTables(
      visible ? branchSlug : undefined,
    )
    const allTables = useMemo(
      () => tablesRes?.result ?? [],
      [tablesRes?.result],
    )

    const handleSelect = useCallback(
      (table: ITable) => {
        setDraftTable(table)
        sheetRef.current?.dismiss()
      },
      [setDraftTable],
    )

    const renderItem: ListRenderItem<ITable> = useCallback(
      ({ item: table }) => {
        const selected = selectedTableSlug === table.slug
        const isAvailable = table.status === 'available'
        const statusColor = isAvailable ? '#22c55e' : '#ef4444'
        return (
          <Pressable
            onPress={() => handleSelect(table)}
            style={[
              s.tableItem,
              {
                borderColor: selected
                  ? primaryColor
                  : isDark
                    ? colors.gray[700]
                    : colors.gray[200],
                backgroundColor: selected ? `${primaryColor}10` : 'transparent',
              },
            ]}
          >
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
            <View style={s.tableNameRow}>
              <Text
                style={[
                  s.tableName,
                  {
                    color: isDark ? colors.gray[50] : colors.gray[900],
                    fontWeight: selected ? '600' : '400',
                  },
                ]}
                numberOfLines={1}
              >
                Bàn {table.name}
              </Text>
              <Text style={[s.tableStatus, { color: statusColor }]}>
                · {isAvailable ? 'Trống' : 'Đã đặt'}
              </Text>
            </View>
            {selected && <CheckCircle size={16} color={primaryColor} />}
          </Pressable>
        )
      },
      [selectedTableSlug, primaryColor, isDark, handleSelect],
    )

    const keyExtractor = useCallback((item: ITable) => item.slug, [])

    const ListHeader = useMemo(
      () => (
        <Text
          style={[
            s.title,
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
          <View style={s.loadingWrap}>
            <ActivityIndicator
              size="small"
              color={isDark ? '#9ca3af' : '#6b7280'}
            />
            <Text
              style={[
                s.loadingText,
                { color: isDark ? colors.gray[400] : colors.gray[500] },
              ]}
            >
              Đang tải...
            </Text>
          </View>
        ) : (
          <Text
            style={[
              s.emptyText,
              { color: isDark ? colors.gray[400] : colors.gray[500] },
            ]}
          >
            Không có bàn nào
          </Text>
        ),
      [isLoading, isDark],
    )

    const ItemSeparator = useCallback(() => <View style={s.separator} />, [])

    const bgStyle = useMemo(
      () => ({
        backgroundColor: isDark ? colors.card.dark : colors.white.light,
      }),
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
      if (visible) {
        sheetRef.current?.present()
      } else {
        sheetRef.current?.dismiss()
      }
    }, [visible])

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
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
          estimatedItemSize={ESTIMATED_ITEM_SIZE}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          ItemSeparatorComponent={ItemSeparator}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        />
      </BottomSheetModal>
    )
  },
)

const s = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  separator: {
    height: 8,
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
  tableName: { fontSize: 14 },
  tableStatus: { fontSize: 12, fontWeight: '500' },
})
