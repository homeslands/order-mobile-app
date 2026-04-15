/**
 * Loyalty Point Hub
 * Route: /profile/loyalty-point-hub
 *
 * Layout:
 *   [Hero — cố định, gradient fade]
 *   [Filter bar — cố định, type chips + filter button + active date]
 *   [Danh sách — flex:1, scroll độc lập, infinite load 20/trang]
 */
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list'
import dayjs from 'dayjs'
import {
  ChevronRight,
  Coins,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react-native'
import { useFocusEffect } from '@react-navigation/native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LoyaltyPointDetailHistoryDialog } from '@/app/profile/loyalty-point-detail-dialog'
import {
  DEFAULT_LOYALTY_FILTER,
  isLoyaltyFilterActive,
  LoyaltyPointFilterSheet,
  type LoyaltyPointFilter,
} from '@/components/loyalty-point/loyalty-point-filter-sheet'
import { LoyaltyPointTransactionCard } from '@/components/loyalty-point/loyalty-point-transaction-card'
import { Skeleton } from '@/components/ui'
import { colors, LoyaltyPointHistoryType } from '@/constants'
import { LOYALTY_HUB_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useLoyaltyPointHistoryInfinite, useLoyaltyPoints } from '@/hooks/use-loyalty-point'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useRunAfterTransition } from '@/hooks/use-run-after-transition'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import type { ILoyaltyPointHistory } from '@/types'
import { formatPoints } from '@/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const ALL_TYPES = [
  LoyaltyPointHistoryType.ADD,
  LoyaltyPointHistoryType.USE,
  LoyaltyPointHistoryType.RESERVE,
  LoyaltyPointHistoryType.REFUND,
]
// Hero = status bar + back button row + balance content + bottom padding
const HERO_HEIGHT = 260

// ─── Type filter bar ──────────────────────────────────────────────────────────

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

  const OPTS = useMemo(() => [
    { label: tCommon('common.all'),              value: null },
    { label: t('profile.points.add'),     value: LoyaltyPointHistoryType.ADD },
    { label: t('profile.points.use'),     value: LoyaltyPointHistoryType.USE },
    { label: t('profile.points.reserve'), value: LoyaltyPointHistoryType.RESERVE },
    { label: t('profile.points.refund'),  value: LoyaltyPointHistoryType.REFUND },
  ], [t, tCommon])

  const chipBg   = isDark ? colors.gray[800] : colors.white.light
  const inactive = isDark ? colors.gray[400] : colors.gray[500]

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tf.scroll}>
      {OPTS.map((opt) => {
        const active = selected === opt.value
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onSelect(opt.value)}
            style={[tf.chip, { backgroundColor: active ? primaryColor : chipBg }]}
          >
            <Text style={[tf.chipText, {
              color: active ? colors.white.light : inactive,
              fontWeight: active ? '700' : '500',
            }]}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
})

const tf = StyleSheet.create({
  scroll:   { gap: 6 },
  chip:     { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 12 },
})

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded-2xl" style={{ height: 100 }} />
      ))}
    </View>
  )
}

const ItemSeparator = () => <View style={{ height: 10 }} />

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function LoyaltyPointHubScreen() {
  const { t } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { bottom } = useSafeAreaInsets()
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const [ready, setReady] = useState(false)
  const [balanceVisible, setBalanceVisible] = useState(true)
  const [filter, setFilter] = useState<LoyaltyPointFilter>(DEFAULT_LOYALTY_FILTER)
  const [quickType, setQuickType] = useState<LoyaltyPointHistoryType | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedHistory, setSelectedHistory] = useState<ILoyaltyPointHistory | null>(null)

  const flashListRef = useRef<FlashListRef<ILoyaltyPointHistory>>(null)

  useRunAfterTransition(() => setReady(true), [])

  const isFilterActive = isLoyaltyFilterActive(filter)

  const bg          = isDark ? colors.background.dark : colors.background.light
  const textColor   = isDark ? colors.gray[50]        : colors.gray[900]
  const subColor    = isDark ? colors.gray[400]       : colors.gray[500]
  const borderColor = isDark ? colors.gray[700]       : colors.gray[200]

  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: bottom + 24,
    }),
    [bottom],
  )

  const effectiveTypes = useMemo(() => {
    if (quickType !== null) return [quickType]
    if (filter.types.length > 0) return filter.types
    return ALL_TYPES
  }, [quickType, filter.types])

  // ── Data ─────────────────────────────────────────────────────────────────────

  const {
    data: loyaltyPointData,
    isPending: loadingTotal,
    refetch: refetchTotal,
  } = useLoyaltyPoints(ready ? (userSlug ?? undefined) : undefined)
  const totalPoints = loyaltyPointData?.totalPoints ?? 0

  const {
    data: historyPages,
    isPending: loadingHistory,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchHistory,
  } = useLoyaltyPointHistoryInfinite({
    slug:     ready ? (userSlug ?? '') : '',
    size:     PAGE_SIZE,
    types:    effectiveTypes,
    fromDate: filter.fromDate ? dayjs(filter.fromDate).format('YYYY-MM-DD') : undefined,
    toDate:   filter.toDate   ? dayjs(filter.toDate).format('YYYY-MM-DD')   : undefined,
  })

  const historyList = useMemo(
    () => historyPages?.pages.flatMap((p) => p.result.items) ?? [],
    [historyPages],
  )

  const isLoading = !ready || loadingHistory

  // Reset scroll khi filter thay đổi
  useEffect(() => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [filter, quickType])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(() => {
    void refetchTotal()
    void refetchHistory()
  }, [refetchTotal, refetchHistory])

  useFocusEffect(
    useCallback(() => {
      if (ready) {
        void refetchTotal()
        void refetchHistory()
      }
    }, [ready, refetchTotal, refetchHistory]),
  )

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const handleRowPress = useCallback((item: ILoyaltyPointHistory) => {
    setSelectedHistory(item)
    setIsDetailOpen(true)
  }, [])

  const handleApplyFilter = useCallback((v: LoyaltyPointFilter) => {
    setFilter(v)
    if (v.types.length > 0) setQuickType(null)
  }, [])

  const handleQuickType = useCallback((v: LoyaltyPointHistoryType | null) => {
    setQuickType(v)
    setFilter((prev) => ({ ...prev, types: [] }))
  }, [])

  // ── Render helpers ────────────────────────────────────────────────────────────

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

  const keyExtractor = useCallback((item: ILoyaltyPointHistory) => item.slug ?? item.id, [])

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => { layout.size = LOYALTY_HUB_ITEM_HEIGHT },
    [],
  )

  const ListFooter = isFetchingNextPage ? (
    <ActivityIndicator color={primaryColor} style={{ paddingVertical: 16 }} />
  ) : null

  const ListEmpty = !isLoading ? (
    <View style={s.emptyWrap}>
      <Trophy size={40} color={colors.gray[400]} />
      <Text style={[s.emptyTitle, { color: textColor }]}>{t('profile.points.emptyTitle')}</Text>
      <Text style={[s.emptyHint, { color: subColor }]}>
        {isFilterActive ? t('profile.points.emptyFiltered') : t('profile.points.emptyHint')}
      </Text>
    </View>
  ) : null

  // ── Active date chips ─────────────────────────────────────────────────────────

  const dateParts: string[] = []
  if (filter.fromDate) dateParts.push(t('profile.points.from', { date: dayjs(filter.fromDate).format('DD/MM/YY') }))
  if (filter.toDate)   dateParts.push(t('profile.points.to',   { date: dayjs(filter.toDate).format('DD/MM/YY') }))

  return (
    <View style={[s.container, { backgroundColor: bg }]}>

      {/* ── Hero — cố định ───────────────────────────────────────────────── */}
      <View style={[s.hero, { height: HERO_HEIGHT, backgroundColor: primaryColor }]}>

        <Pressable
          onPress={navigateNative.back}
          hitSlop={12}
          style={[s.backBtn, { top: STATIC_TOP_INSET + 8 }]}
        >
          <ChevronRight
            size={20}
            color={colors.white.light}
            style={{ transform: [{ rotate: '180deg' }] }}
          />
        </Pressable>

        <View style={[s.heroContent, { paddingTop: STATIC_TOP_INSET + 44 }]}>
          <Text style={s.balanceLabel}>{t('profile.loyaltyPoint.hub.balance')}</Text>
          <View style={s.balanceRow}>
            <Coins size={20} color="rgba(255,255,255,0.8)" />
            {loadingTotal ? (
              <View style={s.balanceSkeleton} />
            ) : (
              <Text style={s.balanceValue}>
                {balanceVisible ? formatPoints(totalPoints) : '••••••'}
              </Text>
            )}
            <Pressable onPress={() => setBalanceVisible((v) => !v)} hitSlop={12}>
              {balanceVisible
                ? <EyeOff size={18} color="rgba(255,255,255,0.7)" />
                : <Eye    size={18} color="rgba(255,255,255,0.7)" />}
            </Pressable>
          </View>
        </View>
      </View>

      {/* ── Filter bar — cố định ─────────────────────────────────────────── */}
      <View style={[s.filterBar, { backgroundColor: bg, borderBottomColor: borderColor }]}>
        <View style={s.filterRow}>
          <View style={s.filterChipsWrap}>
            <TypeFilterBar
              selected={quickType}
              primaryColor={primaryColor}
              isDark={isDark}
              onSelect={handleQuickType}
            />
          </View>
          <Pressable
            onPress={() => setFilterSheetOpen(true)}
            hitSlop={8}
            style={[s.filterIconBtn, { backgroundColor: primaryColor, borderColor: primaryColor }]}
          >
            <SlidersHorizontal size={16} color={colors.white.light} />
            {isFilterActive && (
              <View style={[s.filterDot, { backgroundColor: colors.white.light }]} />
            )}
          </Pressable>
        </View>

        {dateParts.length > 0 && (
          <View style={s.dateParts}>
            {dateParts.map((p) => (
              <View key={p} style={[s.dateBadge, { backgroundColor: `${primaryColor}15` }]}>
                <Text style={[s.dateBadgeText, { color: primaryColor }]}>{p}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Danh sách — scroll độc lập ───────────────────────────────────── */}
      <View style={s.listArea}>
        {isLoading ? (
          <SkeletonList />
        ) : (
          <FlashList
            ref={flashListRef}
            data={historyList}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            overrideItemLayout={overrideItemLayout}
            ListEmptyComponent={ListEmpty}
            ListFooterComponent={ListFooter}
            contentContainerStyle={listContentStyle}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={ItemSeparator}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            refreshControl={
              <RefreshControl
                refreshing={false}
                onRefresh={handleRefresh}
                tintColor={primaryColor}
              />
            }
          />
        )}
      </View>

      {selectedHistory && (
        <LoyaltyPointDetailHistoryDialog
          isOpen={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          history={selectedHistory}
          onCloseSheet={() => setSelectedHistory(null)}
        />
      )}

      {filterSheetOpen && (
        <LoyaltyPointFilterSheet
          visible
          value={filter}
          primaryColor={primaryColor}
          isDark={isDark}
          onClose={() => setFilterSheetOpen(false)}
          onApply={handleApplyFilter}
        />
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },

  // ── Hero
  hero: {},

  backBtn: {
    position: 'absolute',
    left: 16,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 16,
  },

  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceValue: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.white.light,
    letterSpacing: -1,
  },
  balanceSkeleton: {
    height: 46,
    width: 140,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ── Filter bar
  filterBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterChipsWrap: { flex: 1 },
  filterIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  filterDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'white',
  },

  // ── Date badges
  dateParts: { flexDirection: 'row', gap: 6 },
  dateBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  dateBadgeText: { fontSize: 12, fontWeight: '600' },

  // ── List
  listArea: { flex: 1 },

  // ── Empty
  emptyWrap:  { paddingTop: 48, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint:  { fontSize: 13, textAlign: 'center', paddingHorizontal: 24, lineHeight: 18 },
})
