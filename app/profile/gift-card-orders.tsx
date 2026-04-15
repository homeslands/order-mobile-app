/**
 * Gift Card Orders screen — Lịch sử mua thẻ quà tặng.
 * Route: /profile/gift-card-orders
 *
 * Hiển thị lịch sử đơn hàng thẻ quà của khách với filter theo type.
 * Tap vào đơn → navigate tới order-success/[slug] để xem chi tiết.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list'
import dayjs from 'dayjs'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Gift,
  ShoppingBag,
  SlidersHorizontal,
  UserRound,
  Users,
  X,
} from 'lucide-react-native'
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
import DatePicker from 'react-native-date-picker'
import { TouchableOpacity as GHTouchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GiftCardOrderDetailSheet } from '@/components/gift-card/gift-card-order-detail-sheet'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { Skeleton } from '@/components/ui'
import { colors, GiftCardType } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { GIFT_CARD_ORDER_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { useCardOrdersInfinite } from '@/hooks/use-card-order'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { useRunAfterTransition } from '@/hooks/use-run-after-transition'
import { useUserStore } from '@/stores'
import type { ICardOrderResponse } from '@/types'
import { formatCurrency } from '@/utils'

// ─── Filter bar ───────────────────────────────────────────────────────────────

const FilterBar = memo(function FilterBar({
  selected,
  primaryColor,
  isDark,
  onSelect,
  filters,
}: {
  selected: string
  primaryColor: string
  isDark: boolean
  onSelect: (v: string) => void
  filters: { label: string; value: string }[]
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.filterScroll}
    >
      {filters.map((f) => {
        const active = selected === f.value
        return (
          <Pressable
            key={f.value}
            onPress={() => onSelect(f.value)}
            style={[
              s.filterChip,
              {
                backgroundColor: active ? primaryColor : (isDark ? colors.gray[800] : colors.gray[100]),
                borderColor: active ? primaryColor : (isDark ? colors.gray[700] : colors.gray[200]),
              },
            ]}
          >
            <Text style={[s.filterText, { color: active ? colors.white.light : (isDark ? colors.gray[300] : colors.gray[600]) }]}>
              {f.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
})

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const { t } = useTranslation('giftCard')
  const upper = (status ?? '').toUpperCase()
  let bg = isDark ? colors.gray[700] : colors.gray[200]
  let color = isDark ? colors.gray[400] : colors.gray[500]
  let label = status

  if (upper === 'COMPLETED' || upper === 'PAID') {
    bg = '#dcfce7'; color = '#16a34a'; label = t('orderStatus.completedShort')
  } else if (upper === 'PENDING') {
    bg = '#fef9c3'; color = '#b45309'; label = t('orderStatus.pendingShort')
  } else if (upper === 'CANCELLED') {
    bg = '#fee2e2'; color = '#dc2626'; label = t('orderStatus.cancelled')
  }

  return (
    <View style={[sb.wrap, { backgroundColor: bg }]}>
      <Text style={[sb.text, { color }]}>{label}</Text>
    </View>
  )
}

const sb = StyleSheet.create({
  wrap: { width: 68, paddingVertical: 3, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 10, fontWeight: '700' },
})

// ─── Type icon ────────────────────────────────────────────────────────────────

function TypeIcon({ type, color }: { type: string; color: string }) {
  const upper = (type ?? '').toUpperCase()
  if (upper === GiftCardType.GIFT) return <Users size={16} color={color} />
  if (upper === GiftCardType.BUY) return <ShoppingBag size={16} color={color} />
  return <UserRound size={16} color={color} />
}

// ─── Order list item ──────────────────────────────────────────────────────────

const ITEM_HEIGHT = 92

const OrderListItem = memo(function OrderListItem({
  item,
  primaryColor,
  isDark,
  onPress,
}: {
  item: ICardOrderResponse
  primaryColor: string
  isDark: boolean
  onPress: (slug: string) => void
}) {
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const bg = isDark ? colors.gray[900] : colors.white.light
  const borderColor = isDark ? colors.gray[700] : colors.gray[100]

  const { t } = useTranslation('giftCard')
  const handlePress = useCallback(() => onPress(item.slug), [item.slug, onPress])

  const dateLabel = useMemo(
    () => new Date(item.orderDate ?? item.createdAt ?? '').toLocaleDateString('vi-VN'),
    [item.orderDate, item.createdAt],
  )

  const typeLabel =
    item.type === GiftCardType.GIFT ? t('type.gift')
    : item.type === GiftCardType.BUY ? t('type.buy')
    : t('type.self')

  return (
    <Pressable
      onPress={handlePress}
      style={[s.item, { backgroundColor: bg, borderColor }]}
    >
      {/* Left icon */}
      <View style={[s.itemIcon, { backgroundColor: `${primaryColor}15` }]}>
        <TypeIcon type={item.type} color={primaryColor} />
      </View>

      {/* Content */}
      <View style={s.itemContent}>
        <View style={s.itemTopRow}>
          <Text style={[s.itemName, { color: textColor }]} numberOfLines={1}>
            {item.cardTitle}
          </Text>
          <StatusBadge status={item.paymentStatus} isDark={isDark} />
        </View>
        <Text style={[s.itemType, { color: subColor }]}>
          {typeLabel} · {t('orders.cards', { count: item.quantity })} · {formatCurrency(item.totalAmount)}
        </Text>
        <View style={s.itemMeta}>
          <Clock size={11} color={subColor} />
          <Text style={[s.itemDate, { color: subColor }]}>
            {dateLabel}
          </Text>
          {item.code && (
            <Text style={[s.itemCode, { color: subColor }]}>· #{item.code}</Text>
          )}
        </View>
      </View>
    </Pressable>
  )
})

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonList() {
  return (
    <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 10 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="w-full rounded-2xl" style={{ height: ITEM_HEIGHT }} />
      ))}
    </View>
  )
}

// ─── Stable separator ────────────────────────────────────────────────────────

const ItemSeparator = () => <View style={{ height: 10 }} />

// ─── Date filter sheet ───────────────────────────────────────────────────────

interface DateFilter { fromDate: Date | null; toDate: Date | null }

const DATE_SNAP = ['50%']

const DateFilterSheet = memo(function DateFilterSheet({
  visible,
  value,
  primaryColor,
  isDark,
  onClose,
  onApply,
}: {
  visible: boolean
  value: DateFilter
  primaryColor: string
  isDark: boolean
  onClose: () => void
  onApply: (v: DateFilter) => void
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom } = useSafeAreaInsets()
  const { t } = useTranslation('giftCard')
  const { t: tCommon } = useTranslation('common')

  const [localFrom, setLocalFrom] = useState<Date | null>(value.fromDate)
  const [localTo,   setLocalTo]   = useState<Date | null>(value.toDate)
  const [fromOpen,  setFromOpen]  = useState(false)
  const [toOpen,    setToOpen]    = useState(false)

  const bg       = isDark ? colors.gray[900]  : colors.white.light
  const textColor = isDark ? colors.gray[50]  : colors.gray[900]
  const subColor  = isDark ? colors.gray[400] : colors.gray[500]
  const chipBg    = isDark ? colors.gray[800] : colors.gray[100]
  const dateBg    = isDark ? colors.gray[800] : colors.gray[50]
  const dateBorder = isDark ? colors.gray[700] : colors.gray[200]

  const defaultNow = useMemo(() => new Date(), [])

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} pressBehavior="close" />
    ),
    [],
  )

  const handleApply = useCallback(() => {
    onApply({ fromDate: localFrom, toDate: localTo })
    sheetRef.current?.dismiss()
  }, [localFrom, localTo, onApply])

  const handleReset = useCallback(() => {
    onApply({ fromDate: null, toDate: null })
    sheetRef.current?.dismiss()
  }, [onApply])

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={DATE_SNAP}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: bg }}
      handleIndicatorStyle={{ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }}
      onDismiss={onClose}
    >
          <View style={[ds.content, { paddingBottom: bottom + 16 }]}>
            <View>
              <Text style={[ds.title, { color: textColor }]}>{t('orders.filterTitle')}</Text>
              <Text style={[ds.sectionLabel, { color: subColor }]}>{t('orders.dateRange')}</Text>

              <View style={ds.dateRow}>
                {/* From */}
                <View style={ds.dateWrap}>
                  <GHTouchable
                    onPress={() => setFromOpen(true)}
                    activeOpacity={0.7}
                    style={[ds.datePicker, { backgroundColor: dateBg, borderColor: localFrom ? primaryColor : dateBorder }]}
                  >
                    <CalendarDays size={13} color={localFrom ? primaryColor : subColor} />
                    <View style={ds.dateText}>
                      <Text style={[ds.dateHint, { color: subColor }]}>{t('orders.fromDate')}</Text>
                      <Text style={[ds.dateVal, { color: localFrom ? textColor : subColor }]}>
                        {localFrom ? dayjs(localFrom).format('DD/MM/YYYY') : '––/––/––––'}
                      </Text>
                    </View>
                    {localFrom && (
                      <GHTouchable onPress={() => setLocalFrom(null)} hitSlop={10}>
                        <X size={12} color={subColor} />
                      </GHTouchable>
                    )}
                  </GHTouchable>
                </View>

                <ArrowRight size={16} color={subColor} />

                {/* To */}
                <View style={ds.dateWrap}>
                  <GHTouchable
                    onPress={() => setToOpen(true)}
                    activeOpacity={0.7}
                    style={[ds.datePicker, { backgroundColor: dateBg, borderColor: localTo ? primaryColor : dateBorder }]}
                  >
                    <CalendarDays size={13} color={localTo ? primaryColor : subColor} />
                    <View style={ds.dateText}>
                      <Text style={[ds.dateHint, { color: subColor }]}>{t('orders.toDate')}</Text>
                      <Text style={[ds.dateVal, { color: localTo ? textColor : subColor }]}>
                        {localTo ? dayjs(localTo).format('DD/MM/YYYY') : '––/––/––––'}
                      </Text>
                    </View>
                    {localTo && (
                      <GHTouchable onPress={() => setLocalTo(null)} hitSlop={10}>
                        <X size={12} color={subColor} />
                      </GHTouchable>
                    )}
                  </GHTouchable>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={ds.footer}>
              <View style={ds.btnWrap}>
                <GHTouchable onPress={handleReset} activeOpacity={0.8} style={[ds.btn, { backgroundColor: chipBg }]}>
                  <Text style={[ds.btnText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>
                    {tCommon('common.reset')}
                  </Text>
                </GHTouchable>
              </View>
              <View style={ds.btnWrap}>
                <GHTouchable onPress={handleApply} activeOpacity={0.8} style={[ds.btn, { backgroundColor: primaryColor }]}>
                  <Text style={[ds.btnText, { color: colors.white.light }]}>{t('orders.apply')}</Text>
                </GHTouchable>
              </View>
            </View>
          </View>

          <DatePicker
            modal open={fromOpen} date={localFrom ?? defaultNow} mode="date"
            maximumDate={localTo ?? defaultNow}
            onConfirm={(d) => { setLocalFrom(d); setFromOpen(false) }}
            onCancel={() => setFromOpen(false)}
            confirmText={tCommon('common.confirm')} cancelText={tCommon('common.cancel')}
            theme={isDark ? 'dark' : 'light'}
          />
          <DatePicker
            modal open={toOpen} date={localTo ?? defaultNow} mode="date"
            minimumDate={localFrom ?? undefined} maximumDate={defaultNow}
            onConfirm={(d) => { setLocalTo(d); setToOpen(false) }}
            onCancel={() => setToOpen(false)}
            confirmText={tCommon('common.confirm')} cancelText={tCommon('common.cancel')}
            theme={isDark ? 'dark' : 'light'}
          />
    </BottomSheetModal>
  )
})

const ds = StyleSheet.create({
  content:     { flex: 1, paddingHorizontal: 20, paddingTop: 8, justifyContent: 'space-between' },
  title:       { fontSize: 17, fontWeight: '700', marginBottom: 20 },
  sectionLabel:{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateWrap:    { flex: 1 },
  datePicker:  { flexDirection: 'row', alignItems: 'center', gap: 7, height: 52, borderRadius: 10, paddingHorizontal: 10, borderWidth: 1 },
  dateText:    { flex: 1, gap: 2 },
  dateHint:    { fontSize: 10, fontWeight: '500' },
  dateVal:     { fontSize: 13, fontWeight: '600' },
  footer:      { flexDirection: 'row', gap: 10 },
  btnWrap:     { flex: 1 },
  btn:         { height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText:     { fontSize: 15, fontWeight: '700' },
})

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function GiftCardOrdersScreen() {
  const { t } = useTranslation('giftCard')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = usePrimaryColor()
  const { bottom } = useSafeAreaInsets()
  const userSlug = useUserStore((s) => s.userInfo?.slug)

  const listContentStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingBottom: bottom + 24,
    }),
    [bottom],
  )

  const TYPE_FILTERS = useMemo(() => [
    { label: t('orders.types.all'), value: 'ALL' },
    { label: t('type.self'),        value: GiftCardType.SELF },
    { label: t('type.gift'),        value: GiftCardType.GIFT },
    { label: t('type.buy'),         value: GiftCardType.BUY },
  ], [t])

  const [ready, setReady] = useState(false)
  const [selectedType, setSelectedType] = useState('ALL')
  const [detailSlug, setDetailSlug] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter>({ fromDate: null, toDate: null })
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const flashListRef = useRef<FlashListRef<ICardOrderResponse>>(null)

  useRunAfterTransition(() => setReady(true), [])

  const queryParams = useMemo(
    () => ({
      customerSlug: userSlug,
      sort: '-createdAt',
      ...(dateFilter.fromDate ? { fromDate: dayjs(dateFilter.fromDate).format('YYYY-MM-DD') } : {}),
      ...(dateFilter.toDate ? { toDate: dayjs(dateFilter.toDate).format('YYYY-MM-DD') } : {}),
    }),
    [userSlug, dateFilter],
  )

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useCardOrdersInfinite(queryParams, { enabled: ready && !!userSlug })

  const allItems = useMemo(
    () => data?.pages.flatMap((p) => p.result.items) ?? [],
    [data],
  )

  const items = useMemo(
    () => selectedType === 'ALL'
      ? allItems
      : allItems.filter((o) => (o.type ?? '').toUpperCase() === selectedType),
    [allItems, selectedType],
  )

  // Reset scroll khi đổi filter / sort
  useEffect(() => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [selectedType])

  useEffect(() => {
    flashListRef.current?.scrollToOffset({ offset: 0, animated: false })
  }, [dateFilter])


  const bg = isDark ? colors.background.dark : colors.background.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]

  const handlePress = useCallback((slug: string) => setDetailSlug(slug), [])
  const handleTypeSelect = useCallback((v: string) => setSelectedType(v), [])
  const handleFilterOpen = useCallback(() => setFilterSheetOpen(true), [])
  const handleFilterClose = useCallback(() => setFilterSheetOpen(false), [])
  const handleFilterApply = useCallback((v: DateFilter) => {
    setDateFilter(v)
    setFilterSheetOpen(false)
  }, [])

  const isDateActive = dateFilter.fromDate !== null || dateFilter.toDate !== null

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const renderItem: ListRenderItem<ICardOrderResponse> = useCallback(
    ({ item }) => (
      <OrderListItem
        item={item}
        primaryColor={primaryColor}
        isDark={isDark}
        onPress={handlePress}
      />
    ),
    [primaryColor, isDark, handlePress],
  )

  const keyExtractor = useCallback((item: ICardOrderResponse) => item.slug, [])

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => { layout.size = GIFT_CARD_ORDER_ITEM_HEIGHT },
    [],
  )

  const borderColor = isDark ? colors.gray[700] : colors.gray[200]

  const ListFooter = isFetchingNextPage
    ? <ActivityIndicator color={primaryColor} style={{ paddingVertical: 16 }} />
    : null

  const ListEmpty = !isLoading ? (
    <View style={s.emptyWrap}>
      <Gift size={40} color={colors.gray[400]} />
      <Text style={[s.emptyTitle, { color: textColor }]}>{t('orders.empty.noOrders')}</Text>
      <Text style={[s.emptyHint, { color: subColor }]}>
        {selectedType === 'ALL'
          ? t('orders.empty.noOwned')
          : t('orders.empty.noType', { type: TYPE_FILTERS.find(f => f.value === selectedType)?.label })}
      </Text>
    </View>
  ) : null

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <FloatingHeader
        title={t('orders.title')}
        disableBlur
        rightElement={
          <Pressable
            onPress={handleFilterOpen}
            style={[s.headerIconBtn, { backgroundColor: isDateActive ? `${primaryColor}15` : (isDark ? colors.gray[800] : colors.white.light) }]}
          >
            <SlidersHorizontal size={16} color={isDateActive ? primaryColor : (isDark ? colors.gray[300] : colors.gray[600])} />
            {isDateActive && <View style={[s.activeDot, { backgroundColor: primaryColor }]} />}
          </Pressable>
        }
      />

      {/* ── Fixed filter bar ─────────────────────────────────────────── */}
      <View style={[s.filterBarFixed, { paddingTop: STATIC_TOP_INSET + 64, backgroundColor: bg, borderBottomColor: borderColor }]}>
        <View style={s.filterRow}>
          <FilterBar
            selected={selectedType}
            primaryColor={primaryColor}
            isDark={isDark}
            onSelect={handleTypeSelect}
            filters={TYPE_FILTERS}
          />
        </View>
        {isDateActive && (
          <View style={s.dateChipRow}>
            {dateFilter.fromDate && (
              <View style={[s.dateChip, { backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}30` }]}>
                <Text style={[s.dateChipText, { color: primaryColor }]}>
                  {t('orders.fromDate')}: {dayjs(dateFilter.fromDate).format('DD/MM/YYYY')}
                </Text>
              </View>
            )}
            {dateFilter.toDate && (
              <View style={[s.dateChip, { backgroundColor: `${primaryColor}15`, borderColor: `${primaryColor}30` }]}>
                <Text style={[s.dateChipText, { color: primaryColor }]}>
                  {t('orders.toDate')}: {dayjs(dateFilter.toDate).format('DD/MM/YYYY')}
                </Text>
              </View>
            )}
            <Pressable onPress={() => setDateFilter({ fromDate: null, toDate: null })} hitSlop={8}>
              <X size={14} color={isDark ? colors.gray[400] : colors.gray[500]} />
            </Pressable>
          </View>
        )}
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
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={ListFooter}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ItemSeparator}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refetch}
              tintColor={primaryColor}
            />
          }
        />
      )}

      <GiftCardOrderDetailSheet
        visible={!!detailSlug}
        orderSlug={detailSlug}
        onClose={() => setDetailSlug(null)}
      />

      <DateFilterSheet
        visible={filterSheetOpen}
        value={dateFilter}
        primaryColor={primaryColor}
        isDark={isDark}
        onClose={handleFilterClose}
        onApply={handleFilterApply}
      />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1 },
  filterBarFixed: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterRow: { flexDirection: 'row', alignItems: 'center', paddingRight: 12 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  activeDot: {
    width: 6, height: 6, borderRadius: 3,
    position: 'absolute', top: 6, right: 6,
  },
  dateChipRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 6, paddingHorizontal: 12, paddingBottom: 8,
  },
  dateChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  dateChipText: { fontSize: 11, fontWeight: '600' },
  filterScroll: { paddingVertical: 12, paddingHorizontal: 12, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: ITEM_HEIGHT,
  },
  itemIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemContent: { flex: 1, gap: 4 },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemName: { flex: 1, fontSize: 14, fontWeight: '700' },
  itemType: { fontSize: 12 },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemDate: { fontSize: 11 },
  itemCode: { fontSize: 11 },
  emptyWrap: { paddingTop: 60, alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyHint: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },
})
