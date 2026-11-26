import { FlashList } from '@shopify/flash-list'
import { useQueryClient } from '@tanstack/react-query'
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
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
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
import {
  OrderHistoryCard,
  type OrderHistoryCardLabels,
} from '@/components/order-history/order-history-card'
import { StickySectionHeader } from '@/components/ui/sticky-section-header'
import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import {
  orderHistoryQuery,
  useOrderHistory,
  useRunAfterTransition,
} from '@/hooks'
import { GlassHeaderButton } from '@/components/navigation/glass-header-button'
import { navigateNative } from '@/lib/navigation'
import {
  buildOrderSections,
  orderRowGap,
  type OrderSectionRow,
} from '@/lib/order-sections'
import { hexToRgba } from '@/lib/utils'
import { useNotificationStore, useUserStore } from '@/stores'
import { firstUnreadOrderPaidSlug } from '@/stores/selectors/notification.selectors'
import type { IOrder } from '@/types'
import { OrderStatus } from '@/types'
import { formatCurrency } from '@/utils'

import { OrderHistorySkeletonList } from './order-history-skeleton'
import { GlassSheetBackground } from '@/components/ui/glass-sheet-background'
import {
  QueryErrorState,
  shouldShowQueryError,
} from '@/components/ui/query-error-state'
import { Text } from '@/components/ui/text'

type Row = OrderSectionRow<IOrder>

const rowKey = (r: Row) => (r._kind === 'header' ? r.key : r.order.slug)
const rowType = (r: Row) => r._kind

/** Khoảng trống giữa hai dòng: thẻ→thẻ 10, thẻ→tiêu đề ngày mới 20. */
function OrderGap({
  leadingItem,
  trailingItem,
}: {
  leadingItem?: Row
  trailingItem?: Row
}) {
  const h = orderRowGap(leadingItem, trailingItem)
  return h > 0 ? <View style={{ height: h }} /> : null
}

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
      backgroundComponent={GlassSheetBackground}
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

  const userSlug = useUserStore((s) => s.userInfo?.slug ?? '')
  const [status, setStatus] = useState<OrderStatus>(OrderStatus.ALL)

  // Fetch sau khi transition xong → màn trượt ngay; dữ liệu tải trước lúc bấm
  // (prefetchOrderHistory) hoặc còn cache thì hiện luôn.
  const [allowFetch, setAllowFetch] = useState(false)
  useRunAfterTransition(() => setAllowFetch(true), [], {
    transitionType: 'stack',
  })
  const [dateFilter, setDateFilter] = useState<HistoryDateFilter>({
    fromDate: null,
    toDate: null,
  })
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const query = useMemo(
    () =>
      orderHistoryQuery(userSlug, {
        status: status === OrderStatus.ALL ? undefined : status,
        ...(dateFilter.fromDate
          ? { startDate: dayjs(dateFilter.fromDate).format('YYYY-MM-DD') }
          : {}),
        ...(dateFilter.toDate
          ? { endDate: dayjs(dateFilter.toDate).format('YYYY-MM-DD') }
          : {}),
      }),
    [userSlug, status, dateFilter],
  )
  const {
    data: orderPages,
    isLoading,
    refetch,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useOrderHistory(query, { enabled: allowFetch && !!userSlug })

  // ── Auto-refetch on FCM ORDER_PAID notification ──
  // Chỉ phản ứng với thông báo MỚI sau khi vào màn (thông báo cũ chưa đọc:
  // dữ liệu lúc vào màn đã mới), và chờ chuyển màn xong — refetch() chạy cả khi
  // query đang `enabled: false`.
  const paidNotificationSlug = useNotificationStore((s) =>
    firstUnreadOrderPaidSlug(s.notifications),
  )
  const processedRef = useRef<Set<string> | null>(null)
  if (processedRef.current === null) {
    processedRef.current = new Set(
      paidNotificationSlug ? [paidNotificationSlug] : [],
    )
  }
  useEffect(() => {
    if (!allowFetch || !userSlug) return
    const processed = processedRef.current
    if (!paidNotificationSlug || !processed) return
    if (processed.has(paidNotificationSlug)) return
    processed.add(paidNotificationSlug)
    void refetch()
  }, [paidNotificationSlug, refetch, allowFetch, userSlug])

  // Vòng quay kéo-làm-mới chỉ cho thao tác kéo của khách — đổi lọc / thông báo
  // cũng làm query "đang tải lại" nhưng không nên bật vòng quay.
  const [userRefreshing, setUserRefreshing] = useState(false)
  const handleUserRefresh = useCallback(() => {
    setUserRefreshing(true)
    void refetch().finally(() => setUserRefreshing(false))
  }, [refetch])

  const orders = useMemo(
    () => orderPages?.pages.flatMap((p) => p.result?.items ?? []) ?? [],
    [orderPages],
  )
  // Nhóm theo ngày — tiêu đề ngày nằm trong danh sách, cuộn đi theo (không
  // dính).
  const rows = useMemo(
    () => buildOrderSections(orders, new Date()).rows,
    [orders],
  )

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

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

  const cardLabels = useMemo<OrderHistoryCardLabels>(
    () => ({
      type: {
        'at-table': tProfile('profile.orderType.atTable'),
        'take-out': tProfile('profile.orderType.takeOut'),
        delivery: tProfile('profile.orderType.delivery'),
      },
      status: {
        unpaid: t('order.unpaid'),
        paid: t('order.paid'),
        completed: t('order.completed'),
        failed: t('order.failed'),
      },
      itemCount: (n: number) => t('menu.catalogItemCount', { count: n }),
      total: t('order.totalPayment'),
      formatPrice: formatCurrency,
    }),
    [t, tProfile],
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
  }, [])

  const handleFilterOpen = useCallback(() => setFilterSheetOpen(true), [])
  const handleFilterClose = useCallback(() => setFilterSheetOpen(false), [])
  const handleFilterApply = useCallback((v: HistoryDateFilter) => {
    setDateFilter(v)
    setFilterSheetOpen(false)
  }, [])

  const renderRow = useCallback(
    ({ item }: { item: Row }) => {
      if (item._kind === 'header') {
        const title =
          item.date === 'unknown'
            ? t('order.unknownDate')
            : item.day === 'today'
              ? t('order.today')
              : item.day === 'yesterday'
                ? t('order.yesterday')
                : dayjs(item.date).format('DD/MM/YYYY')
        return (
          <StickySectionHeader
            title={title}
            subtitle={t('order.orderCount', { count: item.count })}
            stuck={false}
            isDark={isDark}
          />
        )
      }
      return (
        <OrderHistoryCard
          order={item.order}
          primaryColor={primaryColor}
          isDark={isDark}
          labels={cardLabels}
          onPress={handleOrderPress}
        />
      )
    },
    [t, isDark, primaryColor, cardLabels, handleOrderPress],
  )

  const { bottom: bottomInset } = useSafeAreaInsets()
  const listContentStyle = useMemo(
    () => ({ paddingBottom: bottomInset + 24 }),
    [bottomInset],
  )

  const ListFooterComponent = useMemo(
    () =>
      isFetchingNextPage ? (
        <ActivityIndicator style={pageStyles.loadMore} color={primaryColor} />
      ) : null,
    [isFetchingNextPage, primaryColor],
  )

  const showLoadError = shouldShowQueryError({
    isError,
    hasData: !!orderPages,
  })
  // Chưa có dữ liệu (lần đầu, chưa tải trước, vừa đổi lọc): khung thẻ trong
  // vùng danh sách, header + chip lọc là thật → dữ liệu về không nhảy bố cục.
  const showSkeleton = !orderPages && !showLoadError

  const headerBg = isDark ? colors.card.dark : colors.white.light
  const headerBorder = isDark ? colors.border.dark : colors.gray[200]

  const ListEmptyComponent = useMemo(
    () =>
      showSkeleton ? (
        <OrderHistorySkeletonList cardBg={headerBg} />
      ) : showLoadError ? (
        <QueryErrorState onRetry={() => void refetch()} />
      ) : (
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
    [isDark, t, showLoadError, refetch, showSkeleton, headerBg],
  )

  const screenBg = isDark ? colors.background.dark : colors.background.light
  const isDateFilterActive =
    dateFilter.fromDate !== null || dateFilter.toDate !== null
  const filterTint = hexToRgba(primaryColor, 0.08)
  const filterTintBorder = hexToRgba(primaryColor, 0.19)

  return (
    <View style={[pageStyles.flex, { backgroundColor: screenBg }]}>
      {/* Header tự chừa thanh trạng thái (STATIC_TOP_INSET) và trải nền lên
          dưới nó như màn Menu. Không chừa safe-area đáy ở khung ngoài: danh
          sách chạy tới đáy màn, đệm cuối theo safe-area (không bị cắt ngang
          trên thanh home). */}
      <View style={pageStyles.flex}>
        {/* Header cố định (nền đặc), danh sách bắt đầu ngay dưới. */}
        <View
          style={[
            pageStyles.header,
            { backgroundColor: headerBg, borderBottomColor: headerBorder },
          ]}
        >
          <View
            style={[
              pageStyles.headerRow,
              { paddingTop: STATIC_TOP_INSET + 10 },
            ]}
          >
            <GlassHeaderButton isDark={isDark} onPress={navigateNative.back}>
              <ChevronLeft
                size={20}
                color={isDark ? colors.gray[50] : colors.gray[900]}
              />
            </GlassHeaderButton>

            <Text
              style={[
                pageStyles.headerTitle,
                { color: isDark ? colors.gray[50] : colors.gray[900] },
              ]}
            >
              {t('order.history', 'Lịch sử đơn hàng')}
            </Text>

            {/* Đang lọc thì nút mang nền nhấn màu thương hiệu, nên bỏ kính
                và bỏ shadow để màu đó không bị pha loãng. */}
            <GlassHeaderButton
              isDark={isDark}
              onPress={handleFilterOpen}
              hitSlop={4}
              solidColor={isDateFilterActive ? filterTint : undefined}
              withoutShadow={isDateFilterActive}
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
            </GlassHeaderButton>
          </View>

          {/* Filter chips */}
          <View style={pageStyles.filterRow}>
            <FilterBar
              status={status}
              isPending={isLoading}
              primaryColor={primaryColor}
              isDark={isDark}
              onSelect={handleFilterSelect}
              labels={filterBarLabels}
            />
          </View>

          {/* Active date chips */}
          {isDateFilterActive && (
            <View style={pageStyles.dateChipRow}>
              {dateFilter.fromDate && (
                <View
                  style={[
                    pageStyles.dateChip,
                    {
                      backgroundColor: filterTint,
                      borderColor: filterTintBorder,
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
                      backgroundColor: filterTint,
                      borderColor: filterTintBorder,
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
                onPress={() => setDateFilter({ fromDate: null, toDate: null })}
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

        <FlashList
          data={rows}
          renderItem={renderRow}
          keyExtractor={rowKey}
          getItemType={rowType}
          ItemSeparatorComponent={OrderGap}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.6}
          ListFooterComponent={ListFooterComponent}
          ListEmptyComponent={ListEmptyComponent}
          contentContainerStyle={listContentStyle}
          refreshControl={
            <RefreshControl
              refreshing={userRefreshing}
              onRefresh={handleUserRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        />
      </View>

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
  header: {
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  loadMore: { paddingVertical: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
