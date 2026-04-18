/**
 * LoyaltyPointDetailSheet — ZaloPay-style chi tiết giao dịch điểm tích lũy.
 * Hero căn giữa → info card → order section → nút xem chi tiết
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import dayjs from 'dayjs'
import {
  Check,
  Clock,
  Clipboard as ClipboardIcon,
  Coins,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Clipboard,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'

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

const SNAP_POINTS = ['80%']

const TYPE_CFG = {
  [LoyaltyPointHistoryType.ADD]: {
    color: '#16a34a',
    darkColor: colors.success.dark,
    bgL: colors.success.iconBgLight,
    bgD: colors.success.iconBgDark,
    prefix: '+',
    Icon: TrendingUp,
  },
  [LoyaltyPointHistoryType.USE]: {
    color: colors.destructive.dark,
    darkColor: colors.destructive.light,
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
    color: colors.warning.textLight,
    darkColor: colors.warning.dark,
    bgL: colors.warning.iconBgLight,
    bgD: colors.warning.iconBgDark,
    prefix: '+',
    Icon: RefreshCw,
  },
} as const

const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  [OrderStatus.PAID]: { bg: colors.success.iconBgLight, text: '#16a34a' },
  [OrderStatus.COMPLETED]: { bg: colors.success.iconBgLight, text: '#16a34a' },
  [OrderStatus.PENDING]: {
    bg: colors.warning.iconBgLight,
    text: colors.warning.textLight,
  },
  [OrderStatus.SHIPPING]: { bg: '#dbeafe', text: '#1d4ed8' },
  [OrderStatus.FAILED]: { bg: '#fee2e2', text: colors.destructive.dark },
}

// ─── CopyableInline ───────────────────────────────────────────────────────────

function CopyableInline({
  value,
  primaryColor,
  textColor,
}: {
  value: string
  primaryColor: string
  textColor: string
}) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    Clipboard.setString(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [value])

  return (
    <View style={ci.row}>
      <Text style={[ci.val, { color: textColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Pressable onPress={handleCopy} hitSlop={10}>
        {copied ? (
          <Check size={13} color={colors.success.light} />
        ) : (
          <ClipboardIcon size={13} color={primaryColor} />
        )}
      </Pressable>
    </View>
  )
}

const ci = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  val: { fontSize: 13, fontWeight: '600' },
})

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  subColor,
  children,
}: {
  label: string
  subColor: string
  children: React.ReactNode
}) {
  return (
    <View style={ir.row}>
      <Text style={[ir.label, { color: subColor }]}>{label}</Text>
      <View style={ir.right}>{children}</View>
    </View>
  )
}

const ir = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  label: { fontSize: 13 },
  right: { flexShrink: 1, marginLeft: 12, alignItems: 'flex-end' },
})

// ─── OrderItemRow ─────────────────────────────────────────────────────────────

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
      <Text style={[oi.qty, { color: subColor }]}>×{item.quantity}</Text>
      <Text style={[oi.price, { color: textColor }]}>
        {formatCurrency(item.subtotal)}
      </Text>
    </View>
  )
})

const oi = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  dot: { fontSize: 13, width: 10 },
  name: { flex: 1, fontSize: 13 },
  qty: { fontSize: 12, minWidth: 26, textAlign: 'right' },
  price: { fontSize: 13, fontWeight: '600', minWidth: 70, textAlign: 'right' },
})

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  history: ILoyaltyPointHistory | null
  onCloseSheet?: () => void
}

// ─── Sheet ────────────────────────────────────────────────────────────────────

export const LoyaltyPointDetailHistoryDialog = memo(
  function LoyaltyPointDetailHistoryDialog({
    isOpen,
    onOpenChange,
    history,
    onCloseSheet,
  }: Props) {
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

    // ── Derived ──────────────────────────────────────────────────────────────────
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
    const cardBg = isDark ? colors.gray[800] : colors.gray[50]

    const TypeIcon = cfg.Icon

    const formattedDate = useMemo(
      () => (history ? dayjs(history.date).format('HH:mm · DD/MM/YYYY') : '—'),
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
      const statusLabelMap: Record<string, string> = {
        [OrderStatus.PAID]: t('profile.orderStatus.completed'),
        [OrderStatus.COMPLETED]: t('profile.orderStatus.completed'),
        [OrderStatus.PENDING]: t('profile.orderStatus.pending'),
        [OrderStatus.SHIPPING]: t('profile.orderStatus.shipping'),
        [OrderStatus.FAILED]: t('profile.orderStatus.failed'),
      }
      const colors = ORDER_STATUS_COLORS[order.status]
      return colors
        ? { ...colors, label: statusLabelMap[order.status] ?? order.status }
        : { bg: cardBg, text: subColor, label: order.status }
    }, [order, t, cardBg, subColor])

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
              {/* ── Hero — căn giữa ────────────────────────────────────── */}
              <View style={s.hero}>
                <View style={[s.heroCircle, { backgroundColor: iconBg }]}>
                  <TypeIcon size={26} color={typeColor} />
                </View>
                <Text style={[s.heroTitle, { color: textColor }]}>
                  {typeLabel}
                </Text>
                <Text style={[s.heroAmount, { color: typeColor }]}>
                  {cfg.prefix}
                  {formatPoints(history.points)} {t('profile.points.point')}
                </Text>
                <Text style={[s.heroSub, { color: subColor }]}>
                  <Coins size={12} color={subColor} />{' '}
                  {t('profile.points.lastPoints')}:{' '}
                  {formatPoints(history.lastPoints)} {t('profile.points.point')}
                </Text>
              </View>

              {/* ── Info card ──────────────────────────────────────────── */}
              <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
                {/* Trạng thái */}
                <InfoRow label={t('profile.points.status')} subColor={subColor}>
                  <View
                    style={[
                      s.badge,
                      {
                        backgroundColor: isPending
                          ? colors.warning.iconBgLight
                          : colors.success.iconBgLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.badgeText,
                        {
                          color: isPending
                            ? colors.warning.textLight
                            : '#16a34a',
                        },
                      ]}
                    >
                      {isPending
                        ? t('profile.points.pendingStatus')
                        : t('profile.points.confirmedStatus')}
                    </Text>
                  </View>
                </InfoRow>

                <View style={[s.divider, { backgroundColor: borderColor }]} />

                {/* Ngày giao dịch */}
                <InfoRow
                  label={t('profile.points.transactionDate')}
                  subColor={subColor}
                >
                  <Text style={[s.rowVal, { color: textColor }]}>
                    {formattedDate}
                  </Text>
                </InfoRow>

                {/* Mã đơn hàng */}
                {hasOrder && (
                  <>
                    <View
                      style={[s.divider, { backgroundColor: borderColor }]}
                    />
                    <InfoRow
                      label={t('profile.points.orderSlug')}
                      subColor={subColor}
                    >
                      <CopyableInline
                        value={orderSlug}
                        primaryColor={primaryColor}
                        textColor={textColor}
                      />
                    </InfoRow>
                  </>
                )}
              </View>

              {/* ── Order section ──────────────────────────────────────── */}
              {hasOrder && (
                <>
                  <Text style={[s.sectionTitle, { color: subColor }]}>
                    {t('profile.points.relatedOrder')}
                  </Text>

                  {loadingOrder ? (
                    <View
                      style={[s.card, { backgroundColor: cardBg, borderColor }]}
                    >
                      <ActivityIndicator
                        size="small"
                        color={primaryColor}
                        style={{ paddingVertical: 16 }}
                      />
                    </View>
                  ) : order && orderStatusCfg ? (
                    <>
                      <View
                        style={[
                          s.card,
                          { backgroundColor: cardBg, borderColor },
                        ]}
                      >
                        {/* Order header */}
                        <View
                          style={[
                            s.orderHeader,
                            { borderBottomColor: borderColor },
                          ]}
                        >
                          <Text style={[s.orderType, { color: subColor }]}>
                            {orderTypeLabel}
                          </Text>
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

                        {/* Items */}
                        {orderItems.length > 0 && (
                          <View style={s.itemsWrap}>
                            {orderItems.map((item) => (
                              <OrderItemRow
                                key={item.slug}
                                item={item}
                                textColor={textColor}
                                subColor={subColor}
                              />
                            ))}
                          </View>
                        )}

                        <View
                          style={[s.divider, { backgroundColor: borderColor }]}
                        />

                        {/* Total */}
                        <InfoRow
                          label={t('profile.points.orderTotal')}
                          subColor={subColor}
                        >
                          <Text style={[s.rowVal, { color: textColor }]}>
                            {formatCurrency(order.subtotal)}
                          </Text>
                        </InfoRow>

                        {(order.accumulatedPointsToUse ?? 0) > 0 && (
                          <>
                            <View
                              style={[
                                s.divider,
                                { backgroundColor: borderColor },
                              ]}
                            />
                            <InfoRow
                              label={t('profile.points.pointsUsedInOrder')}
                              subColor={subColor}
                            >
                              <Text
                                style={[
                                  s.rowVal,
                                  {
                                    color: isDark
                                      ? colors.destructive.light
                                      : colors.destructive.dark,
                                  },
                                ]}
                              >
                                -{formatCurrency(order.accumulatedPointsToUse)}
                              </Text>
                            </InfoRow>
                          </>
                        )}
                      </View>

                      {/* View detail button */}
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
                      style={[s.card, { backgroundColor: cardBg, borderColor }]}
                    >
                      <Text style={[s.notFound, { color: subColor }]}>
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
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },

  // Hero
  hero: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  heroCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: { fontSize: 15, fontWeight: '600' },
  heroAmount: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { fontSize: 12 },

  // Card
  card: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth },

  // Info rows
  rowVal: { fontSize: 13, fontWeight: '600' },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // Section
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 4,
  },

  // Order header
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  orderType: { fontSize: 12 },

  // Order items
  itemsWrap: { paddingVertical: 8 },

  // Not found
  notFound: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },

  // View order button
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewBtnText: { fontSize: 14, fontWeight: '600' },
})
