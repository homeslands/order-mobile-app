import { ScreenContainer } from '@/components/layout'
import { FlashList } from '@shopify/flash-list'
import { useQueryClient } from '@tanstack/react-query'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  Package,
  SlidersHorizontal,
  X,
} from 'lucide-react-native'
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import dayjs from 'dayjs'
import DatePicker from 'react-native-date-picker'
import { TouchableOpacity as GHTouchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getOrderBySlug } from '@/api'
import { colors, NotificationMessageCode } from '@/constants'
import { ORDER_HISTORY_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { useOrders, useRunAfterTransition } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { useNotificationStore, useUserStore } from '@/stores'
import type { IOrder } from '@/types'
import { OrderStatus } from '@/types'
import { paymentStatus } from '@/constants'
import { calculateOrderDisplayAndTotals } from '@/utils'

import OrderCard from './order-card'
import type { OrderDisplayData } from './order-card'
import { OrderHistorySkeleton } from './order-history-skeleton'

// ─── Filter bar ───────────────────────────────────────────────────────────────

const FilterBar = React.memo(function FilterBar({
  status,
  isPending,
  primaryColor,
  isDark,
  onSelect,
  labels,
}: {
  status: OrderStatus
  isPending: boolean
  primaryColor: string
  isDark: boolean
  onSelect: (s: OrderStatus) => void
  labels: { all: string; pending: string; completed: string }
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={pageStyles.filterScroll}
    >
      {STATUS_FILTER_OPTIONS.map((opt) => {
        const sel = status === opt.value
        const label =
          opt.labelKey === 'all'
            ? labels.all
            : opt.labelKey === 'pending'
              ? labels.pending
              : labels.completed
        return (
          <Pressable
            key={opt.value}
            onPress={isPending ? undefined : () => onSelect(opt.value)}
            style={[
              pageStyles.filterChip,
              sel
                ? { borderColor: primaryColor, backgroundColor: primaryColor }
                : {
                    borderColor: isDark ? colors.border.dark : colors.gray[200],
                    backgroundColor: isDark
                      ? colors.border.dark
                      : colors.white.light,
                  },
              isPending && !sel && { opacity: 0.5 },
            ]}
          >
            <Text
              style={[
                pageStyles.filterChipText,
                {
                  color: sel
                    ? colors.white.light
                    : isDark
                      ? colors.gray[300]
                      : colors.gray[700],
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
})

// ─── History date filter types ────────────────────────────────────────────────

interface HistoryDateFilter {
  fromDate: Date | null
  toDate: Date | null
}

// ─── History date filter sheet ────────────────────────────────────────────────

const HISTORY_FILTER_SNAP = ['50%']

const HistoryDateFilterSheet = memo(function HistoryDateFilterSheet({
  visible,
  value,
  primaryColor,
  isDark,
  onClose,
  onApply,
}: {
  visible: boolean
  value: HistoryDateFilter
  primaryColor: string
  isDark: boolean
  onClose: () => void
  onApply: (v: HistoryDateFilter) => void
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom } = useSafeAreaInsets()
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')

  const [localFrom, setLocalFrom] = useState<Date | null>(value.fromDate)
  const [localTo, setLocalTo] = useState<Date | null>(value.toDate)
  const [fromOpen, setFromOpen] = useState(false)
  const [toOpen, setToOpen] = useState(false)
  const defaultNow = useMemo(() => new Date(), [])

  const bg = isDark ? colors.card.dark : colors.white.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const chipBg = isDark ? colors.border.dark : colors.gray[100]
  const dateBg = isDark ? colors.background.dark : colors.gray[50]
  const dateBorder = isDark ? colors.border.dark : colors.gray[200]

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

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

  const handleApply = useCallback(() => {
    onApply({ fromDate: localFrom, toDate: localTo })
    sheetRef.current?.dismiss()
  }, [localFrom, localTo, onApply])

  const handleReset = useCallback(() => {
    onApply({ fromDate: null, toDate: null })
    sheetRef.current?.dismiss()
  }, [onApply])

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={HISTORY_FILTER_SNAP}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: bg }}
      handleIndicatorStyle={{
        backgroundColor: isDark ? colors.gray[600] : colors.gray[300],
      }}
      onDismiss={onClose}
    >
      <View style={[hfs.content, { paddingBottom: bottom + 16 }]}>
        <View>
          <Text style={[hfs.title, { color: textColor }]}>
            {t('order.filterTitle')}
          </Text>
          <Text style={[hfs.sectionLabel, { color: subColor }]}>
            {t('order.dateRange')}
          </Text>
          <View style={hfs.dateRow}>
            {/* From */}
            <View style={hfs.dateWrap}>
              <GHTouchable
                onPress={() => setFromOpen(true)}
                activeOpacity={0.7}
                style={[
                  hfs.datePicker,
                  {
                    backgroundColor: dateBg,
                    borderColor: localFrom ? primaryColor : dateBorder,
                  },
                ]}
              >
                <CalendarDays
                  size={13}
                  color={localFrom ? primaryColor : subColor}
                />
                <View style={hfs.dateText}>
                  <Text style={[hfs.dateHint, { color: subColor }]}>
                    {t('order.fromDate')}
                  </Text>
                  <Text
                    style={[
                      hfs.dateVal,
                      { color: localFrom ? textColor : subColor },
                    ]}
                  >
                    {localFrom
                      ? dayjs(localFrom).format('DD/MM/YYYY')
                      : '––/––/––––'}
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
            <View style={hfs.dateWrap}>
              <GHTouchable
                onPress={() => setToOpen(true)}
                activeOpacity={0.7}
                style={[
                  hfs.datePicker,
                  {
                    backgroundColor: dateBg,
                    borderColor: localTo ? primaryColor : dateBorder,
                  },
                ]}
              >
                <CalendarDays
                  size={13}
                  color={localTo ? primaryColor : subColor}
                />
                <View style={hfs.dateText}>
                  <Text style={[hfs.dateHint, { color: subColor }]}>
                    {t('order.toDate')}
                  </Text>
                  <Text
                    style={[
                      hfs.dateVal,
                      { color: localTo ? textColor : subColor },
                    ]}
                  >
                    {localTo
                      ? dayjs(localTo).format('DD/MM/YYYY')
                      : '––/––/––––'}
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
        <View style={hfs.footer}>
          <View style={hfs.btnWrap}>
            <GHTouchable
              onPress={handleReset}
              activeOpacity={0.8}
              style={[hfs.btn, { backgroundColor: chipBg }]}
            >
              <Text
                style={[
                  hfs.btnText,
                  { color: isDark ? colors.gray[50] : colors.gray[700] },
                ]}
              >
                {tCommon('common.reset')}
              </Text>
            </GHTouchable>
          </View>
          <View style={hfs.btnWrap}>
            <GHTouchable
              onPress={handleApply}
              activeOpacity={0.8}
              style={[hfs.btn, { backgroundColor: primaryColor }]}
            >
              <Text style={[hfs.btnText, { color: colors.white.light }]}>
                {t('order.filterApply')}
              </Text>
            </GHTouchable>
          </View>
        </View>
      </View>

      <DatePicker
        modal
        open={fromOpen}
        date={localFrom ?? defaultNow}
        mode="date"
        maximumDate={localTo ?? defaultNow}
        onConfirm={(d) => {
          setLocalFrom(d)
          setFromOpen(false)
        }}
        onCancel={() => setFromOpen(false)}
        confirmText={tCommon('common.confirm')}
        cancelText={tCommon('common.cancel')}
        theme={isDark ? 'dark' : 'light'}
      />
      <DatePicker
        modal
        open={toOpen}
        date={localTo ?? defaultNow}
        mode="date"
        minimumDate={localFrom ?? undefined}
        maximumDate={defaultNow}
        onConfirm={(d) => {
          setLocalTo(d)
          setToOpen(false)
        }}
        onCancel={() => setToOpen(false)}
        confirmText={tCommon('common.confirm')}
        cancelText={tCommon('common.cancel')}
        theme={isDark ? 'dark' : 'light'}
      />
    </BottomSheetModal>
  )
})

const hfs = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateWrap: { flex: 1 },
  datePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 52,
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  dateText: { flex: 1, gap: 2 },
  dateHint: { fontSize: 10, fontWeight: '500' },
  dateVal: { fontSize: 13, fontWeight: '600' },
  footer: { flexDirection: 'row', gap: 10 },
  btnWrap: { flex: 1 },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
})

function OrderHistoryPage() {
  const { t } = useTranslation('menu')
  const { t: tProfile } = useTranslation('profile')
  const queryClient = useQueryClient()
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const userInfo = useUserStore((s) => s.userInfo)
  const [status, setStatus] = useState<OrderStatus>(OrderStatus.ALL)
  const [page, setPage] = useState(1)
  const pageSize = 10

  // Fetch sau khi transition xong → màn trượt ngay, skeleton hiện, data load không block animation
  const [allowFetch, setAllowFetch] = useState(false)
  useRunAfterTransition(() => setAllowFetch(true), [])
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>({
    fromDate: null,
    toDate: null,
  })
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const {
    data: orderResponse,
    isPending,
    refetch,
    isRefetching,
  } = useOrders(
    {
      page,
      size: pageSize,
      owner: userInfo?.slug,
      order: 'DESC',
      hasPaging: true,
      status: status === OrderStatus.ALL ? undefined : status,
      ...(dateFilter.fromDate
        ? { startDate: dayjs(dateFilter.fromDate).format('YYYY-MM-DD') }
        : {}),
      ...(dateFilter.toDate
        ? { endDate: dayjs(dateFilter.toDate).format('YYYY-MM-DD') }
        : {}),
    },
    { enabled: allowFetch && !!userInfo?.slug },
  )

  // ── Auto-refetch on FCM ORDER_PAID notification ──
  const processedRef = useRef<Set<string>>(new Set())
  const latestNotification = useNotificationStore((s) => s.notifications[0])
  useEffect(() => {
    if (!latestNotification || latestNotification.isRead) return
    if (processedRef.current.has(latestNotification.slug)) return
    if (latestNotification.message === NotificationMessageCode.ORDER_PAID) {
      processedRef.current.add(latestNotification.slug)
      refetch()
    }
  }, [latestNotification, refetch])

  const orders = useMemo(
    () => orderResponse?.items || [],
    [orderResponse?.items],
  )

  // Pre-compute display data once when orders change — O(1) lookup in renderItem
  const orderDisplayMap = useMemo(() => {
    const map = new Map<string, OrderDisplayData>()
    for (const order of orders) {
      const items = order.orderItems || []
      const voucher = order.voucher || null
      const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
        items,
        voucher,
      )
      const diMap = new Map<string, (typeof displayItems)[number]>()
      for (const di of displayItems) diMap.set(di.slug, di)
      map.set(order.slug, { displayItemMap: diMap, cartTotals })
    }
    return map
  }, [orders])

  const hasNext = orderResponse?.hasNext || false
  const hasPrevious = orderResponse?.hasPrevious || false
  const currentPage = orderResponse?.page || 1
  const totalPages = orderResponse?.totalPages || 0

  const handleOrderPress = useCallback(
    (orderSlug: string) => {
      if (orderSlug) {
        queryClient.prefetchQuery({
          queryKey: ['order', orderSlug],
          queryFn: () => getOrderBySlug(orderSlug),
        })
      }
      navigateNative.push(
        `/order/${orderSlug}` as Parameters<typeof navigateNative.push>[0],
      )
    },
    [queryClient],
  )

  // Badge chỉ thể hiện trạng thái thanh toán
  const getStatusLabel = useCallback(
    (order: IOrder) => {
      const pStatus = order.payment?.statusCode
      if (pStatus === paymentStatus.COMPLETED) {
        return t('order.paid', 'Đã thanh toán')
      }
      return t('order.unpaid', 'Chưa thanh toán')
    },
    [t],
  )

  const orderCardLabels = useMemo(
    () => ({
      subtotal: t('order.subtotal', 'Tổng tiền hàng'),
      promotionDiscount: t('order.promotionDiscount', 'Giảm giá khuyến mãi'),
      voucher: t('order.voucher', 'Mã giảm giá'),
      loyaltyPoint: t('order.loyaltyPoint', 'Điểm tích lũy'),
      deliveryFee: t('order.deliveryFee', 'Phí giao hàng'),
      totalPayment: t('order.totalPayment', 'Tổng thanh toán'),
      moreItems: t('order.moreItems', 'sản phẩm khác'),
    }),
    [t],
  )

  const filterBarLabels = useMemo(
    () => ({
      all: tProfile('profile.all', 'Tất cả'),
      pending: t('order.unpaid', 'Chưa thanh toán'),
      completed: t('order.paid', 'Đã thanh toán'),
    }),
    [t, tProfile],
  )

  const handleFilterSelect = useCallback((s: OrderStatus) => {
    setStatus(s)
    setPage(1)
  }, [])

  const handleFilterOpen = useCallback(() => setFilterSheetOpen(true), [])
  const handleFilterClose = useCallback(() => setFilterSheetOpen(false), [])
  const handleFilterApply = useCallback((v: HistoryDateFilter) => {
    setDateFilter(v)
    setPage(1)
    setFilterSheetOpen(false)
  }, [])

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => {
      layout.size = ORDER_HISTORY_ITEM_HEIGHT
    },
    [],
  )

  const renderOrderItem = useCallback(
    ({ item: orderItem }: { item: IOrder }) => (
      <OrderCard
        order={orderItem}
        displayData={orderDisplayMap.get(orderItem.slug) ?? null}
        primaryColor={primaryColor}
        isDark={isDark}
        statusLabel={getStatusLabel(orderItem)}
        onPress={handleOrderPress}
        labels={orderCardLabels}
      />
    ),
    [
      orderDisplayMap,
      primaryColor,
      isDark,
      getStatusLabel,
      handleOrderPress,
      orderCardLabels,
    ],
  )

  const keyExtractor = useCallback((item: IOrder) => item.slug ?? '', [])

  const ListFooterComponent = useMemo(() => {
    if (totalPages <= 1) return null
    return (
      <View style={pageStyles.paginationRow}>
        <Pressable
          onPress={() => setPage(page - 1)}
          disabled={!hasPrevious}
          style={[
            pageStyles.pageBtn,
            {
              backgroundColor: isDark ? colors.card.dark : colors.white.light,
              borderColor: isDark ? colors.border.dark : colors.gray[200],
            },
            !hasPrevious && { opacity: 0.5 },
          ]}
        >
          <Text
            style={[
              pageStyles.pageBtnText,
              {
                color: hasPrevious
                  ? isDark
                    ? colors.gray[50]
                    : colors.gray[900]
                  : colors.gray[400],
              },
            ]}
          >
            {t('order.previous', 'Trước')}
          </Text>
        </Pressable>
        <Text
          style={[
            pageStyles.pageInfo,
            { color: isDark ? colors.gray[400] : colors.gray[600] },
          ]}
        >
          {currentPage} / {totalPages}
        </Text>
        <Pressable
          onPress={() => setPage(page + 1)}
          disabled={!hasNext}
          style={[
            pageStyles.pageBtn,
            {
              backgroundColor: isDark ? colors.card.dark : colors.white.light,
              borderColor: isDark ? colors.border.dark : colors.gray[200],
            },
            !hasNext && { opacity: 0.5 },
          ]}
        >
          <Text
            style={[
              pageStyles.pageBtnText,
              {
                color: hasNext
                  ? isDark
                    ? colors.gray[50]
                    : colors.gray[900]
                  : colors.gray[400],
              },
            ]}
          >
            {t('order.next', 'Sau')}
          </Text>
        </Pressable>
      </View>
    )
  }, [totalPages, hasPrevious, hasNext, page, currentPage, t, isDark])

  const ListEmptyComponent = useMemo(
    () => (
      <View style={pageStyles.emptyWrap}>
        <Package
          size={64}
          color={isDark ? colors.gray[400] : colors.gray[500]}
        />
        <Text
          style={[
            pageStyles.emptyTitle,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
        >
          {t('order.noOrders', 'Chưa có đơn hàng')}
        </Text>
        <Text
          style={[
            pageStyles.emptyDesc,
            { color: isDark ? colors.gray[400] : colors.gray[600] },
          ]}
        >
          {t('order.noOrdersDescription', 'Bạn chưa có đơn hàng nào')}
        </Text>
      </View>
    ),
    [isDark, t],
  )

  const screenBg = isDark ? colors.background.dark : colors.background.light
  const isDateFilterActive =
    dateFilter.fromDate !== null || dateFilter.toDate !== null

  const listPaddingStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingTop: isDateFilterActive ? 168 : 130,
      paddingBottom: 24,
    }),
    [isDateFilterActive],
  )
  const headerBg = isDark ? colors.card.dark : colors.white.light
  const headerBorder = isDark ? colors.border.dark : colors.gray[200]
  const gradientColors = useMemo(
    () =>
      [
        screenBg,
        `${screenBg}E6`,
        `${screenBg}B0`,
        `${screenBg}50`,
        `${screenBg}00`,
      ] as const,
    [screenBg],
  )

  const showSkeleton = !allowFetch || (isPending && page === 1)
  if (showSkeleton) {
    return (
      <OrderHistorySkeleton
        screenBg={screenBg}
        headerBg={headerBg}
        headerBorder={headerBorder}
      />
    )
  }

  return (
    <View style={[pageStyles.flex, { backgroundColor: screenBg }]}>
      <ScreenContainer edges={['top', 'bottom']} style={pageStyles.flex}>
        {/* List — full screen, content padded to clear floating header */}
        <FlashList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={keyExtractor}
          overrideItemLayout={overrideItemLayout}
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={listPaddingStyle}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        />

        {/* Floating header — blur + gradient overlay */}
        <View style={pageStyles.floatingHeader} pointerEvents="box-none">
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <LinearGradient
              colors={gradientColors}
              locations={[0, 0.3, 0.62, 0.85, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Row: back + title + spacer */}
          <View
            style={[
              pageStyles.headerRow,
              { paddingTop: STATIC_TOP_INSET + 10 },
            ]}
            pointerEvents="auto"
          >
            <Pressable
              onPress={navigateNative.back}
              hitSlop={8}
              style={[
                pageStyles.circleBtn,
                {
                  backgroundColor: isDark
                    ? colors.card.dark
                    : colors.white.light,
                },
                pageStyles.shadow,
              ]}
            >
              <ChevronLeft
                size={20}
                color={isDark ? colors.gray[50] : colors.gray[900]}
              />
            </Pressable>

            <Text
              style={[
                pageStyles.headerTitle,
                { color: isDark ? colors.gray[50] : colors.gray[900] },
              ]}
            >
              {t('order.history', 'Lịch sử đơn hàng')}
            </Text>

            <Pressable
              onPress={handleFilterOpen}
              hitSlop={4}
              style={[
                pageStyles.circleBtn,
                {
                  backgroundColor: isDateFilterActive
                    ? `${primaryColor}15`
                    : isDark
                      ? colors.card.dark
                      : colors.white.light,
                },
                !isDateFilterActive && pageStyles.shadow,
              ]}
            >
              <SlidersHorizontal
                size={18}
                color={
                  isDateFilterActive
                    ? primaryColor
                    : isDark
                      ? colors.gray[50]
                      : colors.gray[900]
                }
              />
              {isDateFilterActive && (
                <View
                  style={[
                    pageStyles.filterActiveDot,
                    { backgroundColor: primaryColor },
                  ]}
                />
              )}
            </Pressable>
          </View>

          {/* Filter chips */}
          <View style={pageStyles.filterRow} pointerEvents="auto">
            <FilterBar
              status={status}
              isPending={isPending}
              primaryColor={primaryColor}
              isDark={isDark}
              onSelect={handleFilterSelect}
              labels={filterBarLabels}
            />
          </View>

          {/* Active date chips */}
          {isDateFilterActive && (
            <View style={pageStyles.dateChipRow} pointerEvents="auto">
              {dateFilter.fromDate && (
                <View
                  style={[
                    pageStyles.dateChip,
                    {
                      backgroundColor: `${primaryColor}15`,
                      borderColor: `${primaryColor}30`,
                    },
                  ]}
                >
                  <Text
                    style={[pageStyles.dateChipText, { color: primaryColor }]}
                  >
                    {t('order.fromDate')}:{' '}
                    {dayjs(dateFilter.fromDate).format('DD/MM/YYYY')}
                  </Text>
                </View>
              )}
              {dateFilter.toDate && (
                <View
                  style={[
                    pageStyles.dateChip,
                    {
                      backgroundColor: `${primaryColor}15`,
                      borderColor: `${primaryColor}30`,
                    },
                  ]}
                >
                  <Text
                    style={[pageStyles.dateChipText, { color: primaryColor }]}
                  >
                    {t('order.toDate')}:{' '}
                    {dayjs(dateFilter.toDate).format('DD/MM/YYYY')}
                  </Text>
                </View>
              )}
              <Pressable
                onPress={() => {
                  setDateFilter({ fromDate: null, toDate: null })
                  setPage(1)
                }}
                hitSlop={8}
              >
                <X
                  size={14}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              </Pressable>
            </View>
          )}
        </View>
      </ScreenContainer>

      <HistoryDateFilterSheet
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

OrderHistoryPage.displayName = 'OrderHistoryPage'
export default React.memo(OrderHistoryPage)

// ─── Module-level constants ─────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS = [
  { value: OrderStatus.ALL, labelKey: 'all' as const },
  { value: OrderStatus.PENDING, labelKey: 'pending' as const },
  { value: OrderStatus.PAID, labelKey: 'completed' as const },
]

const pageStyles = StyleSheet.create({
  flex: { flex: 1 },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 2,
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  filterRow: { paddingTop: 10, paddingBottom: 4 },
  filterScroll: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  filterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipText: { fontSize: 14, fontWeight: '500' },
  paginationRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  pageBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  pageBtnText: { fontSize: 14, fontWeight: '500' },
  pageInfo: { fontSize: 14 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 64,
  },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '600' },
  emptyDesc: { marginTop: 8, fontSize: 14, textAlign: 'center' },
  filterActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    top: 6,
    right: 6,
  },
  dateChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateChipText: { fontSize: 11, fontWeight: '600' },
})
