/**
 * Loyalty Points screen — Điểm tích lũy.
 * Route: /profile/loyalty-point
 *
 * Hiển thị số dư điểm, summary earned/spent, lịch sử giao dịch.
 * Bộ lọc (loại giao dịch + ngày) qua LoyaltyPointFilterSheet → server-side.
 * Tap vào giao dịch → mở LoyaltyPointDetailSheet (chi tiết + đơn hàng liên quan).
 */
import {
  FlashList,
  type FlashListRef,
  type ListRenderItem,
} from '@shopify/flash-list'
import dayjs from 'dayjs'
import { Coins, SlidersHorizontal, Trophy } from 'lucide-react-native'
import { useFocusEffect } from '@react-navigation/native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoyaltyPointDetailHistorySheet } from '@/app/profile/loyalty-point-detail-sheet'
import {
  DEFAULT_LOYALTY_FILTER,
  isLoyaltyFilterActive,
  LoyaltyPointFilterSheet,
  type LoyaltyPointFilter,
} from '@/components/loyalty-point/loyalty-point-filter-sheet'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { LoyaltyPointTransactionCard } from '@/components/loyalty-point/loyalty-point-transaction-card'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { Skeleton } from '@/components/ui'
import { colors, LoyaltyPointHistoryType } from '@/constants'
import { LOYALTY_POINT_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import {
  useLoyaltyPointHistory,
  useLoyaltyPoints,
} from '@/hooks/use-loyalty-point'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useRunAfterTransition } from '@/hooks/use-run-after-transition'
import { useUserStore } from '@/stores'
import type { ILoyaltyPointHistory } from '@/types'
import { calculateTotalPoints, formatPoints } from '@/utils'

// ─── Stats strip ──────────────────────────────────────────────────────────────

const StatsStrip = memo(function StatsStrip({
  history,
  primaryColor,
  isDark,
}: {
  history: ILoyaltyPointHistory[]
  primaryColor: string
  isDark: boolean
}) {
  const { t } = useTranslation('profile')
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const bg = isDark ? colors.gray[800] : colors.gray[50]
  const borderColor = isDark ? colors.gray[700] : colors.gray[100]

  const { totalEarned, totalSpent, currentPoints } = useMemo(
    () => calculateTotalPoints(history),
    [history],
  )

  const stats = [
    {
      label: t('profile.totalEarned'),
      value: formatPoints(totalEarned),
      color: '#16a34a',
    },
    {
      label: t('profile.points.totalSpent'),
      value: formatPoints(totalSpent),
      color: isDark ? colors.destructive.dark : colors.destructive.light,
    },
    {
      label: t('profile.points.balance'),
      value: formatPoints(currentPoints),
      color: primaryColor,
    },
  ]

  return (
    <View style={[ss.row, { backgroundColor: bg, borderColor }]}>
      {stats.map((stat, i) => (
        <View
          key={stat.label}
          style={[
            ss.cell,
            i < stats.length - 1 && {
              borderRightWidth: StyleSheet.hairlineWidth,
              borderRightColor: borderColor,
            },
          ]}
        >
          <Text style={[ss.count, { color: stat.color }]}>{stat.value}</Text>
          <Text style={[ss.label, { color: subColor }]}>{stat.label}</Text>
        </View>
      ))}
    </View>
  )
})

const ss = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  count: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '500', textAlign: 'center' },
})

// ─── Type filter bar ──────────────────────────────────────────────────────────

const ALL_TYPES = [
  LoyaltyPointHistoryType.ADD,
  LoyaltyPointHistoryType.USE,
  LoyaltyPointHistoryType.RESERVE,
  LoyaltyPointHistoryType.REFUND,
]

const TypeFilterBar = memo(function TypeFilterBar({
  selected,
  primaryColor,
  isDark,
  onSelect,
}: {
  selected: LoyaltyPointHistoryType | null
  primaryColor: string
  isDark: boolean
  onSelect: (v: LoyaltyPointHistoryType | null) => void
}) {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')

  const OPTS = useMemo(
    () => [
      { label: tCommon('common.all'), value: null },
      { label: t('profile.points.add'), value: LoyaltyPointHistoryType.ADD },
      { label: t('profile.points.use'), value: LoyaltyPointHistoryType.USE },
      {
        label: t('profile.points.reserve'),
        value: LoyaltyPointHistoryType.RESERVE,
      },
      {
        label: t('profile.points.refund'),
        value: LoyaltyPointHistoryType.REFUND,
      },
    ],
    [t, tCommon],
  )

  const chipBg = isDark ? colors.gray[800] : colors.white.light
  const inactiveText = isDark ? colors.gray[400] : colors.gray[500]

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={tf.scroll}
    >
      {OPTS.map((opt) => {
        const active = selected === opt.value
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            style={[
              tf.chip,
              { backgroundColor: active ? primaryColor : chipBg },
            ]}
          >
            <Text
              style={[
                tf.chipText,
                {
                  color: active ? colors.white.light : inactiveText,
                  fontWeight: active ? '700' : '500',
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
})

const tf = StyleSheet.create({
  scroll: { paddingBottom: 10, gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 12 },
})

// ─── Active date chips ────────────────────────────────────────────────────────

function ActiveDateBar({
  filter,
  primaryColor,
}: {
  filter: LoyaltyPointFilter
  primaryColor: string
}) {
  const { t } = useTranslation('profile')
  const parts: string[] = []
  if (filter.fromDate)
    parts.push(
      t('profile.points.from', {
        date: dayjs(filter.fromDate).format('DD/MM/YY'),
      }),
    )
  if (filter.toDate)
    parts.push(
      t('profile.points.to', { date: dayjs(filter.toDate).format('DD/MM/YY') }),
    )
  if (parts.length === 0) return null

  return (
    <View style={adb.row}>
      {parts.map((p) => (
        <View
          key={p}
          style={[adb.chip, { backgroundColor: `${primaryColor}15` }]}
        >
          <Text style={[adb.chipText, { color: primaryColor }]}>{p}</Text>
        </View>
      ))}
    </View>
  )
}

const adb = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingBottom: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
})

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SKELETON_HEIGHT = 100

function SkeletonList() {
  return (
    <View style={{ gap: 10, paddingTop: 8 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          className="w-full rounded-2xl"
          style={{ height: SKELETON_HEIGHT }}
        />
      ))}
    </View>
  )
}

// ─── Item separator ───────────────────────────────────────────────────────────

const ItemSeparator = () => <View style={{ height: 10 }} />

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LoyaltyPointScreen() {
  const { t } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { bottom } = useSafeAreaInsets()
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<LoyaltyPointFilter>(
    DEFAULT_LOYALTY_FILTER,
  )
  const [quickType, setQuickType] = useState<LoyaltyPointHistoryType | null>(
    null,
  )
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedHistory, setSelectedHistory] =
    useState<ILoyaltyPointHistory | null>(null)

  const flashListRef = useRef<FlashListRef<ILoyaltyPointHistory>>(null)
  const shouldScrollToTop = useRef(false)

  useRunAfterTransition(() => setReady(true), [])

  const isActive = isLoyaltyFilterActive(filter)
  const bg = isDark ? colors.background.dark : colors.background.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  const listContentStyle = useMemo(
    () => ({
      paddingTop: STATIC_TOP_INSET + 64,
      paddingHorizontal: 16,
      paddingBottom: bottom + 24,
    }),
    [bottom],
  )

  // Tổng hợp types từ quickType và filter sheet
  const effectiveTypes = useMemo(() => {
    if (quickType !== null) return [quickType]
    if (filter.types.length > 0) return filter.types
    return ALL_TYPES
  }, [quickType, filter.types])

  // Fetch total points ngay lập tức (không chờ ready) để số điểm hiện đúng sớm
  const {
    data: loyaltyPointData,
    isPending: loadingTotal,
    refetch: refetchTotal,
  } = useLoyaltyPoints(userSlug ?? undefined)

  const totalPoints = loyaltyPointData?.totalPoints ?? 0

  const {
    data: historyData,
    isPending: loadingHistory,
    refetch: refetchHistory,
  } = useLoyaltyPointHistory({
    slug: ready ? (userSlug ?? '') : '',
    page: 1,
    size: 100,
    types: effectiveTypes,
    fromDate: filter.fromDate
      ? dayjs(filter.fromDate).format('YYYY-MM-DD')
      : undefined,
    toDate: filter.toDate
      ? dayjs(filter.toDate).format('YYYY-MM-DD')
      : undefined,
  })

  const historyList = historyData?.items ?? []
  const isLoading = !ready || loadingTotal || loadingHistory

  // Scroll to top khi filter thay đổi
  useEffect(() => {
    shouldScrollToTop.current = true
  }, [filter, quickType])
  useEffect(() => {
    if (!shouldScrollToTop.current || !historyData) return
    shouldScrollToTop.current = false
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [historyData])

  const handleRefresh = useCallback(() => {
    shouldScrollToTop.current = true
    void refetchTotal()
    void refetchHistory()
  }, [refetchTotal, refetchHistory])

  useFocusEffect(
    useCallback(() => {
      void refetchTotal()
      void refetchHistory()
    }, [refetchTotal, refetchHistory]),
  )

  const handleRowPress = useCallback((item: ILoyaltyPointHistory) => {
    setSelectedHistory(item)
    setIsDetailOpen(true)
  }, [])

  const handleApplyFilter = useCallback((v: LoyaltyPointFilter) => {
    setFilter(v)
    // filter sheet override quickType nếu có types
    if (v.types.length > 0) setQuickType(null)
  }, [])

  const handleQuickType = useCallback((v: LoyaltyPointHistoryType | null) => {
    setQuickType(v)
    // reset type filter từ sheet khi dùng quick chips
    setFilter((prev) => ({ ...prev, types: [] }))
  }, [])

  const renderItem: ListRenderItem<ILoyaltyPointHistory> = useCallback(
    ({ item }) => (
      <LoyaltyPointTransactionCard
        item={item}
        primaryColor={primaryColor}
        isDark={isDark}
        onPress={handleRowPress}
      />
    ),
    [primaryColor, isDark, handleRowPress],
  )

  const keyExtractor = useCallback(
    (item: ILoyaltyPointHistory) => item.slug ?? item.id,
    [],
  )

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = LOYALTY_POINT_ITEM_HEIGHT
    },
    [],
  )

  const ListHeader = (
    <>
      {/* Summary strip */}
      {!isLoading && historyList.length > 0 && (
        <StatsStrip
          history={historyList}
          primaryColor={primaryColor}
          isDark={isDark}
        />
      )}

      {/* Balance badge */}
      {!loadingTotal && (
        <View
          style={[sc.balanceBadge, { backgroundColor: `${primaryColor}15` }]}
        >
          <Coins size={14} color={primaryColor} />
          <Text style={[sc.balanceText, { color: primaryColor }]}>
            {t('profile.points.currentBalance')}:{' '}
            <Text style={{ fontWeight: '800' }}>
              {formatPoints(totalPoints)} {t('profile.points.point')}
            </Text>
          </Text>
        </View>
      )}

      {/* Quick type chips */}
      <TypeFilterBar
        selected={quickType}
        primaryColor={primaryColor}
        isDark={isDark}
        onSelect={handleQuickType}
      />

      {/* Active date bar */}
      <ActiveDateBar filter={filter} primaryColor={primaryColor} />

      {/* Total count */}
      {!isLoading && historyList.length > 0 && (
        <Text style={[sc.totalText, { color: subColor }]}>
          {t('profile.points.countTransactions', { count: historyList.length })}
        </Text>
      )}
    </>
  )

  const ListEmpty = !isLoading ? (
    <View style={sc.emptyWrap}>
      <Trophy size={40} color={colors.gray[400]} />
      <Text style={[sc.emptyTitle, { color: textColor }]}>
        {t('profile.points.emptyTitle')}
      </Text>
      <Text style={[sc.emptyHint, { color: subColor }]}>
        {isActive
          ? t('profile.points.emptyFiltered')
          : t('profile.points.emptyHint')}
      </Text>
    </View>
  ) : null

  return (
    <View style={[sc.container, { backgroundColor: bg }]}>
      <FloatingHeader
        title={t('profile.loyaltyPoint.title')}
        rightElement={
          <Pressable
            onPress={() => setFilterSheetOpen(true)}
            hitSlop={8}
            style={sc.filterBtn}
          >
            <SlidersHorizontal
              size={20}
              color={isActive ? primaryColor : subColor}
            />
            {isActive && (
              <View style={[sc.filterDot, { backgroundColor: primaryColor }]} />
            )}
          </Pressable>
        }
        disableBlur
      />

      {isLoading ? (
        <View
          style={{ paddingTop: STATIC_TOP_INSET + 64, paddingHorizontal: 16 }}
        >
          <SkeletonList />
        </View>
      ) : (
        <FlashList
          ref={flashListRef}
          data={historyList}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          overrideItemLayout={overrideItemLayout}
          contentContainerStyle={listContentStyle}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ItemSeparator}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
            />
          }
        />
      )}

      <LoyaltyPointDetailHistorySheet
        isOpen={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        history={selectedHistory}
        onCloseSheet={() => setSelectedHistory(null)}
      />

      <LoyaltyPointFilterSheet
        key={filterSheetOpen ? 'open' : 'closed'}
        visible={filterSheetOpen}
        value={filter}
        primaryColor={primaryColor}
        isDark={isDark}
        onClose={() => setFilterSheetOpen(false)}
        onApply={handleApplyFilter}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  container: { flex: 1 },
  filterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'white',
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 12,
  },
  balanceText: { fontSize: 13, fontWeight: '600' },
  totalText: { fontSize: 12, fontWeight: '500', paddingBottom: 4 },
  emptyWrap: { paddingTop: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 18,
  },
})
