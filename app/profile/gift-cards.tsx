/**
 * Gift Cards screen — Thẻ của tôi.
 * Route: /profile/gift-cards
 *
 * Hiển thị danh sách thẻ quà tặng của khách hàng.
 * Bộ lọc (trạng thái + ngày) qua GiftCardFilterSheet → server-side.
 * Tap vào thẻ → mở GiftCardDetailSheet.
 */
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list'
import dayjs from 'dayjs'
import { Check, Clock, Coins, Copy, Gift, History, SlidersHorizontal } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Clipboard,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { GiftCardDetailSheet } from '@/components/gift-card/gift-card-detail-sheet'
import {
  DEFAULT_GIFT_CARD_FILTER,
  GiftCardFilter,
  GiftCardFilterSheet,
  isFilterActive,
} from '@/components/gift-card/gift-card-filter-sheet'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { Skeleton } from '@/components/ui'
import { colors, GiftCardUsageStatus } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { GIFT_CARD_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { useUserGiftCards } from '@/hooks/use-gift-cards'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useRunAfterTransition } from '@/hooks/use-run-after-transition'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import type { IGiftCardDetail } from '@/types'
import { formatPoints } from '@/utils'

// ─── Stats strip ──────────────────────────────────────────────────────────────

const StatsStrip = memo(function StatsStrip({
  items,
  isDark,
}: {
  items: IGiftCardDetail[]
  isDark: boolean
}) {
  const { t } = useTranslation('giftCard')
  const available = items.filter((i) => i.status === GiftCardUsageStatus.AVAILABLE).length
  const used = items.filter((i) => i.status === GiftCardUsageStatus.USED).length
  const expired = items.filter((i) => i.status === GiftCardUsageStatus.EXPIRED).length

  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const bg = isDark ? colors.gray[800] : colors.gray[50]
  const borderColor = isDark ? colors.gray[700] : colors.gray[100]

  const stats = [
    { label: t('status.available'), count: available, color: '#16a34a' },
    { label: t('status.used'),      count: used,      color: subColor  },
    { label: t('status.expired'),   count: expired,   color: '#dc2626' },
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
          <Text style={[ss.count, { color: stat.color }]}>{stat.count}</Text>
          <Text style={[ss.label, { color: subColor }]}>{stat.label}</Text>
        </View>
      ))}
    </View>
  )
})

const ss = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2 },
  count: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '500' },
})

// ─── Status quick filter ──────────────────────────────────────────────────────

const StatusQuickFilter = memo(function StatusQuickFilter({
  value,
  onChange,
  primaryColor,
  isDark,
}: {
  value: GiftCardUsageStatus | null
  onChange: (v: GiftCardUsageStatus | null) => void
  primaryColor: string
  isDark: boolean
}) {
  const { t } = useTranslation('giftCard')
  const { t: tCommon } = useTranslation('common')
  const chipBg = isDark ? colors.gray[800] : colors.white.light
  const inactiveText = isDark ? colors.gray[400] : colors.gray[500]

  const STATUS_OPTIONS_QUICK = useMemo(() => [
    { label: tCommon('common.all'),    value: null                          },
    { label: t('status.available'),   value: GiftCardUsageStatus.AVAILABLE },
    { label: t('status.used'),        value: GiftCardUsageStatus.USED      },
    { label: t('status.expired'),     value: GiftCardUsageStatus.EXPIRED   },
  ], [t, tCommon])

  return (
    <View style={sqf.row}>
      {STATUS_OPTIONS_QUICK.map((opt) => {
        const active = value === opt.value
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            style={[sqf.chip, { backgroundColor: active ? primaryColor : chipBg }]}
          >
            <Text style={[sqf.chipText, { color: active ? colors.white.light : inactiveText, fontWeight: active ? '700' : '500' }]}>
              {opt.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
})

const sqf = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 12 },
})

// ─── Active date chips ────────────────────────────────────────────────────────

function ActiveDateBar({
  filter,
  primaryColor,
}: {
  filter: GiftCardFilter
  primaryColor: string
}) {
  const { t } = useTranslation('giftCard')
  const parts: string[] = []
  if (filter.fromDate) parts.push(t('list.dateFrom', { date: dayjs(filter.fromDate).format('DD/MM/YY') }))
  if (filter.toDate)   parts.push(t('list.dateTo', { date: dayjs(filter.toDate).format('DD/MM/YY') }))
  if (parts.length === 0) return null

  return (
    <View style={adb.row}>
      {parts.map((p) => (
        <View key={p} style={[adb.chip, { backgroundColor: `${primaryColor}15` }]}>
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

// ─── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status, isDark }: { status: string; isDark: boolean }) {
  const { t } = useTranslation('giftCard')
  const config =
    status === GiftCardUsageStatus.AVAILABLE
      ? { bg: '#dcfce7', text: '#16a34a', label: t('status.available') }
      : status === GiftCardUsageStatus.USED
        ? {
            bg: isDark ? colors.gray[700] : colors.gray[200],
            text: isDark ? colors.gray[400] : colors.gray[500],
            label: t('status.used'),
          }
        : { bg: '#fee2e2', text: '#dc2626', label: t('status.expired') }

  return (
    <View style={[pill.wrap, { backgroundColor: config.bg }]}>
      <Text style={[pill.text, { color: config.text }]}>{config.label}</Text>
    </View>
  )
}

const pill = StyleSheet.create({
  wrap: { width: 72, paddingVertical: 4, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 11, fontWeight: '700' },
})

// ─── Card list item ───────────────────────────────────────────────────────────

const SKELETON_HEIGHT = 136

const CardListItem = memo(function CardListItem({
  item,
  primaryColor,
  isDark,
  onPress,
}: {
  item: IGiftCardDetail
  primaryColor: string
  isDark: boolean
  onPress: (slug: string) => void
}) {
  const { t } = useTranslation('giftCard')
  const [codeCopied, setCodeCopied] = useState(false)
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const bg = isDark ? colors.gray[900] : colors.white.light
  const borderColor = isDark ? colors.gray[700] : colors.gray[100]

  const handlePress = useCallback(() => onPress(item.slug), [item.slug, onPress])

  const handleCopyCode = useCallback(() => {
    Clipboard.setString(item.code)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 1500)
  }, [item.code])

  const { createdDate, expiryDate } = useMemo(() => ({
    createdDate: dayjs(item.createdAt).format('HH:mm DD/MM/YYYY'),
    expiryDate: item.expiredAt ? dayjs(item.expiredAt).format('HH:mm DD/MM/YYYY') : null,
  }), [item.createdAt, item.expiredAt])

  return (
    <Pressable
      onPress={handlePress}
      style={[s.item, { backgroundColor: bg, borderColor }]}
    >
      {/* Top row: icon + status + date */}
      <View style={s.itemTopRow}>
        <View style={[s.itemIcon, { backgroundColor: `${primaryColor}15` }]}>
          <Gift size={15} color={primaryColor} />
        </View>
        <StatusPill status={item.status} isDark={isDark} />
        <View style={s.itemTopSpacer} />
        <View style={s.itemDateRow}>
          <Clock size={10} color={subColor} />
          <Text style={[s.itemDate, { color: subColor }]}>{createdDate}</Text>
        </View>
      </View>

      {/* Card name */}
      <Text style={[s.itemName, { color: textColor }]} numberOfLines={1}>
        {item.cardName.toUpperCase()}
      </Text>

      {/* Points */}
      <View style={s.itemInfoRow}>
        <Text style={[s.itemInfoLabel, { color: subColor }]}>{t('list.item.points') + ' '}</Text>
        <Text style={[s.itemInfoVal, { color: primaryColor, fontWeight: '700' }]}>
          {formatPoints(item.cardPoints)}
        </Text>
        <Coins size={13} color={primaryColor} />
      </View>

      {/* Expiry */}
      {expiryDate && (
        <View style={s.itemInfoRow}>
          <Text style={[s.itemInfoLabel, { color: subColor }]}>{t('list.item.expiry') + ' '}</Text>
          <Text style={[s.itemInfoVal, { color: textColor }]}>{expiryDate}</Text>
        </View>
      )}

      {/* Copy code */}
      <View style={s.itemInfoRow}>
        <Text style={[s.itemInfoLabel, { color: subColor }]}>{t('list.item.copyCode') + ' '}</Text>
        <Pressable onPress={handleCopyCode} hitSlop={8}>
          {codeCopied
            ? <Check size={14} color="#16a34a" />
            : <Copy size={14} color={subColor} />}
        </Pressable>
      </View>
    </Pressable>
  )
})

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 10 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded-2xl" style={{ height: SKELETON_HEIGHT }} />
      ))}
    </View>
  )
}

// ─── Stable separator ────────────────────────────────────────────────────────

const ItemSeparator = () => <View style={{ height: 10 }} />

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function GiftCardsScreen() {
  const { t } = useTranslation('giftCard')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { bottom } = useSafeAreaInsets()
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState<GiftCardFilter>(DEFAULT_GIFT_CARD_FILTER)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [detailSlug, setDetailSlug] = useState<string | null>(null)

  const flashListRef = useRef<FlashListRef<IGiftCardDetail>>(null)
  const shouldScrollToTop = useRef(false)

  useRunAfterTransition(() => setReady(true), [])

  const active = isFilterActive(filter)

  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingBottom: bottom + 24,
    }),
    [bottom],
  )

  const queryParams = useMemo(() => ({
    customerSlug: userSlug ?? '',
    page: 1,
    size: 50,
    status: filter.status ?? undefined,
    fromDate: filter.fromDate ? dayjs(filter.fromDate).format('YYYY-MM-DD') : undefined,
    toDate: filter.toDate ? dayjs(filter.toDate).format('YYYY-MM-DD') : undefined,
  }), [userSlug, filter.status, filter.fromDate, filter.toDate])

  const { data, isLoading, isFetching, refetch } = useUserGiftCards(
    queryParams,
    { enabled: ready && !!userSlug },
  )

  const items = data?.items ?? []

  const bg = isDark ? colors.background.dark : colors.background.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  // Scroll to top when filter changes or refresh completes with new data
  useEffect(() => {
    shouldScrollToTop.current = true
  }, [filter])

  useEffect(() => {
    if (!shouldScrollToTop.current || !data) return
    shouldScrollToTop.current = false
    flashListRef.current?.scrollToOffset({ offset: 0, animated: true })
  }, [data])

  const handleRefresh = useCallback(() => {
    shouldScrollToTop.current = true
    void refetch()
  }, [refetch])

  const handleOpenDetail = useCallback((slug: string) => setDetailSlug(slug), [])
  const handleCloseDetail = useCallback(() => setDetailSlug(null), [])
  const handleApplyFilter = useCallback((v: GiftCardFilter) => setFilter(v), [])
  const handleStatusFilter = useCallback(
    (status: GiftCardUsageStatus | null) => setFilter((prev) => ({ ...prev, status })),
    [],
  )

  const renderItem: ListRenderItem<IGiftCardDetail> = useCallback(
    ({ item }) => (
      <CardListItem
        item={item}
        primaryColor={primaryColor}
        isDark={isDark}
        onPress={handleOpenDetail}
      />
    ),
    [primaryColor, isDark, handleOpenDetail],
  )

  const keyExtractor = useCallback((item: IGiftCardDetail) => item.slug, [])

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => { layout.size = GIFT_CARD_ITEM_HEIGHT },
    [],
  )

  const ListHeader = (
    <>
      {!isLoading && !active && items.length > 0 && (
        <StatsStrip items={items} isDark={isDark} />
      )}
      <ActiveDateBar filter={filter} primaryColor={primaryColor} />
      {!isLoading && items.length > 0 && (
        <Text style={[s.totalText, { color: subColor }]}>{t('list.countCards', { count: items.length })}</Text>
      )}
    </>
  )

  const borderColor = isDark ? colors.gray[700] : colors.gray[200]

  const ListEmpty = !isLoading ? (
    <View style={s.emptyWrap}>
      <Gift size={40} color={colors.gray[400]} />
      <Text style={[s.emptyTitle, { color: textColor }]}>{t('list.empty.noCards')}</Text>
      <Text style={[s.emptyHint, { color: subColor }]}>
        {active
          ? t('list.empty.noMatches')
          : t('list.empty.noOwned')}
      </Text>
    </View>
  ) : null

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <FloatingHeader
        title={t('list.title')}
        rightElement={
          <View style={s.headerActions}>
            {/* Filter button */}
            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              hitSlop={8}
              style={s.headerBtn}
            >
              <SlidersHorizontal size={20} color={active ? primaryColor : subColor} />
              {active && <View style={[s.filterDot, { backgroundColor: primaryColor }]} />}
            </Pressable>

            {/* History button */}
            <Pressable
              onPress={() =>
                navigateNative.push(
                  '/profile/gift-card-orders' as Parameters<typeof navigateNative.push>[0],
                )
              }
              hitSlop={8}
              style={s.headerBtn}
            >
              <History size={20} color={subColor} />
            </Pressable>
          </View>
        }
        disableBlur
      />

      {/* ── Fixed status filter bar ─────────────────────────────────── */}
      <View style={[s.statusFilterBar, { paddingTop: STATIC_TOP_INSET + 64, backgroundColor: bg, borderBottomColor: borderColor }]}>
        <StatusQuickFilter
          value={filter.status}
          onChange={handleStatusFilter}
          primaryColor={primaryColor}
          isDark={isDark}
        />
      </View>

      {(!ready || isLoading) ? (
        <SkeletonList />
      ) : (
        <FlashList
          ref={flashListRef}
          data={items}
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
              refreshing={isFetching && !isLoading}
              onRefresh={handleRefresh}
              tintColor={primaryColor}
            />
          }
        />
      )}

      <GiftCardDetailSheet
        visible={!!detailSlug}
        giftCardSlug={detailSlug}
        onClose={handleCloseDetail}
      />

      <GiftCardFilterSheet
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

const s = StyleSheet.create({
  container: { flex: 1 },
  statusFilterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: {
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
  totalText: { fontSize: 12, fontWeight: '500', paddingBottom: 4 },
  item: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 6 },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTopSpacer: { flex: 1 },
  itemDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemDate: { fontSize: 10 },
  itemName: { fontSize: 13, fontWeight: '700' },
  itemInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  itemInfoLabel: { fontSize: 12 },
  itemInfoVal: { fontSize: 12 },
  emptyWrap: { paddingTop: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },
})
