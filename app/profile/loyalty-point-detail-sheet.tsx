/**
 * LoyaltyPointDetailSheet — bottom sheet chi tiết giao dịch điểm tích lũy.
 * snap: 70% | date cùng hàng title | slug đơn | danh sách món | nút xem chi tiết
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import {
  Clock,
  Coins,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getOrderBySlug } from '@/api'
import {
  colors,
  LoyaltyPointHistoryType,
  LoyaltyPointTransactionStatus,
} from '@/constants'
import { useOrderBySlug } from '@/hooks/use-order'
import { usePrimaryColor } from '@/hooks/use-primary-color'
import { navigateNative } from '@/lib/navigation'
import type { ILoyaltyPointHistory } from '@/types'
import { OrderStatus, OrderTypeEnum, type IOrderDetail } from '@/types'
import { formatCurrency, formatPoints } from '@/utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const SNAP_POINTS = ['75%']

const TYPE_CFG = {
  [LoyaltyPointHistoryType.ADD]: {
    color: '#16a34a',
    darkColor: '#4ade80',
    bgL: '#dcfce7',
    bgD: '#14532d',
    prefix: '+',
    Icon: TrendingUp,
  },
  [LoyaltyPointHistoryType.USE]: {
    color: '#dc2626',
    darkColor: '#f87171',
    bgL: '#fee2e2',
    bgD: '#7f1d1d',
    prefix: '-',
    Icon: TrendingDown,
  },
  [LoyaltyPointHistoryType.RESERVE]: {
    color: colors.gray[500],
    darkColor: colors.gray[400],
    bgL: colors.gray[200],
    bgD: colors.gray[700],
    prefix: '-',
    Icon: Clock,
  },
  [LoyaltyPointHistoryType.REFUND]: {
    color: '#b45309',
    darkColor: '#fbbf24',
    bgL: '#fef9c3',
    bgD: '#713f12',
    prefix: '+',
    Icon: RefreshCw,
  },
} as const

const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  [OrderStatus.PAID]: { bg: '#dcfce7', text: '#16a34a' },
  [OrderStatus.COMPLETED]: { bg: '#dcfce7', text: '#16a34a' },
  [OrderStatus.PENDING]: { bg: '#fef9c3', text: '#b45309' },
  [OrderStatus.SHIPPING]: { bg: '#dbeafe', text: '#1d4ed8' },
  [OrderStatus.FAILED]: { bg: '#fee2e2', text: '#dc2626' },
}

// ─── Order item row ───────────────────────────────────────────────────────────

const OrderItemRow = memo(function OrderItemRow({
  item,
  textColor,
  subColor,
}: {
  item: IOrderDetail
  textColor: string
  subColor: string
}) {
  const productName = item.variant?.product?.name ?? '—'
  const sizeName = item.variant?.size?.name ?? ''
  const label = sizeName ? `${productName} (${sizeName})` : productName

  return (
    <View style={oi.row}>
      <Text style={[oi.dot, { color: subColor }]}>·</Text>
      <Text style={[oi.name, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[oi.qty, { color: subColor }]}>x{item.quantity}</Text>
      <Text style={[oi.price, { color: textColor }]}>
        {formatCurrency(item.subtotal)}
      </Text>
    </View>
  )
})

const oi = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { fontSize: 13, width: 10 },
  name: { flex: 1, fontSize: 13 },
  qty: { fontSize: 12, minWidth: 26, textAlign: 'right' },
  price: { fontSize: 13, fontWeight: '600', minWidth: 70, textAlign: 'right' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface LoyaltyPointDetailHistoryDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  history: ILoyaltyPointHistory | null
  onCloseSheet?: () => void
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export const LoyaltyPointDetailHistorySheet = memo(
  function LoyaltyPointDetailHistoryDialog({
    isOpen,
    onOpenChange,
    history,
    onCloseSheet,
  }: LoyaltyPointDetailHistoryDialogProps) {
    const sheetRef = useRef<BottomSheetModal>(null)
    const { bottom } = useSafeAreaInsets()
    const isDark = useColorScheme() === 'dark'
    const primaryColor = usePrimaryColor()
    const queryClient = useQueryClient()
    const { t } = useTranslation('profile')

    useEffect(() => {
      if (isOpen) sheetRef.current?.present()
      else sheetRef.current?.dismiss()
    }, [isOpen])

    const handleClose = useCallback(() => {
      onOpenChange(false)
      onCloseSheet?.()
    }, [onOpenChange, onCloseSheet])

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

    // Order fetch — chỉ khi sheet mở và có orderSlug
    const orderSlug = history?.orderSlug ?? ''
    const { data: orderRes, isPending: loadingOrder } = useOrderBySlug(
      isOpen && !!orderSlug ? orderSlug : null,
    )
    const order = orderRes?.result

    const handleViewOrder = useCallback(() => {
      if (!orderSlug) return
      queryClient.prefetchQuery({
        queryKey: ['order', orderSlug],
        queryFn: () => getOrderBySlug(orderSlug),
      })
      handleClose()
      navigateNative.push(
        `/order/${orderSlug}` as Parameters<typeof navigateNative.push>[0],
      )
    }, [orderSlug, queryClient, handleClose])

    // Derived
    const cfg = history
      ? (TYPE_CFG[history.type as LoyaltyPointHistoryType] ??
        TYPE_CFG[LoyaltyPointHistoryType.ADD])
      : TYPE_CFG[LoyaltyPointHistoryType.ADD]

    const typeColor = isDark ? cfg.darkColor : cfg.color
    const iconBg = isDark ? cfg.bgD : cfg.bgL
    const bg = isDark ? colors.gray[900] : colors.white.light
    const textColor = isDark ? colors.gray[50] : colors.gray[900]
    const subColor = isDark ? colors.gray[400] : colors.gray[500]
    const borderColor = isDark ? colors.gray[700] : colors.gray[200]
    const sectionBg = isDark ? colors.gray[800] : colors.gray[50]

    const TypeIcon = cfg.Icon

    const formattedDate = useMemo(
      () =>
        history?.date ? dayjs(history.date).format('HH:mm · DD/MM/YYYY') : '—',
      [history],
    )

    const typeLabel = useMemo(() => {
      const map: Record<string, string> = {
        [LoyaltyPointHistoryType.ADD]: 'profile.points.add',
        [LoyaltyPointHistoryType.USE]: 'profile.points.use',
        [LoyaltyPointHistoryType.RESERVE]: 'profile.points.reserve',
        [LoyaltyPointHistoryType.REFUND]: 'profile.points.refund',
      }
      const key = history?.type ? map[history.type] : undefined
      return key ? t(key) : (history?.type ?? '—')
    }, [history, t])

    const isPending = history?.status === LoyaltyPointTransactionStatus.PENDING
    const hasOrder = !!orderSlug
    const orderItems = order?.orderItems ?? []

    const orderStatusCfg = useMemo(() => {
      if (!order) return null
      const colors = ORDER_STATUS_COLORS[order.status]
      const labelMap: Record<string, string> = {
        [OrderStatus.PAID]: t('profile.orderStatus.completed'),
        [OrderStatus.COMPLETED]: t('profile.orderStatus.completed'),
        [OrderStatus.PENDING]: t('profile.orderStatus.pending'),
        [OrderStatus.SHIPPING]: t('profile.orderStatus.shipping'),
        [OrderStatus.FAILED]: t('profile.orderStatus.failed'),
      }
      return colors
        ? { ...colors, label: labelMap[order.status] ?? order.status }
        : { bg: sectionBg, text: subColor, label: order.status }
    }, [order, t, sectionBg, subColor])

    const orderTypeLabel = useMemo(() => {
      if (!order) return ''
      const typeMap: Record<string, string> = {
        [OrderTypeEnum.AT_TABLE]: t('profile.orderType.atTable'),
        [OrderTypeEnum.TAKE_OUT]: t('profile.orderType.takeOut'),
        [OrderTypeEnum.DELIVERY]: t('profile.orderType.delivery'),
      }
      return typeMap[order.type] ?? order.type
    }, [order, t])

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: bg }}
        handleIndicatorStyle={{
          backgroundColor: isDark ? colors.gray[600] : colors.gray[300],
        }}
        onDismiss={handleClose}
      >
        <BottomSheetScrollView
          contentContainerStyle={[s.content, { paddingBottom: bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {!history ? (
            <ActivityIndicator
              color={primaryColor}
              style={{ paddingVertical: 48 }}
            />
          ) : (
            <>
              {/* ── Header: icon | title + date cùng hàng ────────── */}
              <View style={s.header}>
                <View style={[s.iconCircle, { backgroundColor: iconBg }]}>
                  <TypeIcon size={18} color={typeColor} />
                </View>
                <Text style={[s.headerTitle, { color: textColor }]}>
                  {typeLabel}
                </Text>
                {isPending && (
                  <View style={[s.badge, { backgroundColor: sectionBg }]}>
                    <Text style={[s.badgeText, { color: subColor }]}>
                      {t('profile.orderStatus.pending')}
                    </Text>
                  </View>
                )}
                <Text style={[s.headerDate, { color: subColor }]}>
                  {formattedDate}
                </Text>
              </View>

              {/* ── Points box ────────────────────────────────────── */}
              <View
                style={[
                  s.box,
                  {
                    backgroundColor: `${typeColor}10`,
                    borderColor: `${typeColor}25`,
                  },
                ]}
              >
                <View style={s.boxRow}>
                  <Coins size={15} color={typeColor} />
                  <Text style={[s.boxPoints, { color: typeColor }]}>
                    {cfg.prefix}
                    {formatPoints(history.points)} {t('profile.points.point')}
                  </Text>
                </View>
                <Text style={[s.boxSub, { color: subColor }]}>
                  {t('profile.points.lastPoints')}:{' '}
                  {formatPoints(history.lastPoints)} {t('profile.points.point')}
                </Text>
              </View>

              {/* ── Order section ─────────────────────────────────── */}
              {hasOrder && (
                <>
                  {loadingOrder ? (
                    <View
                      style={[
                        s.section,
                        { backgroundColor: sectionBg, borderColor },
                      ]}
                    >
                      <ActivityIndicator
                        size="small"
                        color={primaryColor}
                        style={{ paddingVertical: 12 }}
                      />
                    </View>
                  ) : order && orderStatusCfg ? (
                    <>
                      {/* Order card — read-only, không pressable */}
                      <View
                        style={[
                          s.section,
                          { backgroundColor: sectionBg, borderColor },
                        ]}
                      >
                        {/* Slug + type + status */}
                        <View style={s.orderTop}>
                          <Text
                            style={[s.orderSlug, { color: textColor }]}
                            numberOfLines={1}
                          >
                            #{orderSlug}
                          </Text>
                          <Text style={[s.orderType, { color: subColor }]}>
                            · {orderTypeLabel}
                          </Text>
                          <View style={s.flex1} />
                          <View
                            style={[
                              s.badge,
                              { backgroundColor: orderStatusCfg.bg },
                            ]}
                          >
                            <Text
                              style={[
                                s.badgeText,
                                { color: orderStatusCfg.text },
                              ]}
                            >
                              {orderStatusCfg.label}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[s.divider, { backgroundColor: borderColor }]}
                        />

                        {/* Danh sách món */}
                        {orderItems.length > 0 && (
                          <>
                            {orderItems.map((item) => (
                              <OrderItemRow
                                key={item.slug}
                                item={item}
                                textColor={textColor}
                                subColor={subColor}
                              />
                            ))}
                            <View
                              style={[
                                s.divider,
                                { backgroundColor: borderColor },
                              ]}
                            />
                          </>
                        )}

                        {/* Tổng tiền + điểm dùng */}
                        <View style={s.orderRow}>
                          <Text style={[s.orderRowLabel, { color: subColor }]}>
                            {t('profile.points.orderTotal')}
                          </Text>
                          <Text style={[s.orderRowVal, { color: textColor }]}>
                            {formatCurrency(order.subtotal)}
                          </Text>
                        </View>
                        {(order.accumulatedPointsToUse ?? 0) > 0 && (
                          <View style={s.orderRow}>
                            <Text
                              style={[s.orderRowLabel, { color: subColor }]}
                            >
                              {t('profile.points.pointsUsedInOrder')}
                            </Text>
                            <Text
                              style={[
                                s.orderRowVal,
                                { color: isDark ? '#f87171' : '#dc2626' },
                              ]}
                            >
                              -{formatCurrency(order.accumulatedPointsToUse)}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Nút xem chi tiết — nằm ngoài card */}
                      <Pressable
                        onPress={handleViewOrder}
                        style={({ pressed }) => [
                          s.viewBtn,
                          {
                            borderColor: primaryColor,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[s.viewBtnText, { color: primaryColor }]}>
                          {t('profile.points.viewOrderDetail')}
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <View
                      style={[
                        s.section,
                        { backgroundColor: sectionBg, borderColor },
                      ]}
                    >
                      <Text style={[s.orderNotFound, { color: subColor }]}>
                        {t('profile.points.orderNotFound')}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  },
)

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 14 },

  // Header — title + date cùng hàng
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  headerDate: { fontSize: 12, flexShrink: 0 },

  // Points box
  box: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxPoints: { fontSize: 20, fontWeight: '800' },
  boxSub: { fontSize: 12 },

  // Section card
  section: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  divider: { height: StyleSheet.hairlineWidth },

  // Order top row
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  orderSlug: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  orderType: { fontSize: 12 },
  flex1: { flex: 1 },

  // Order summary rows
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderRowLabel: { fontSize: 13 },
  orderRowVal: { fontSize: 13, fontWeight: '600' },
  orderNotFound: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },

  // View order button (outline style, below card)
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewBtnText: { fontSize: 14, fontWeight: '600' },

  // Badge (status + pending)
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
})
