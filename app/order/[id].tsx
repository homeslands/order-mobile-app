import { ScreenContainer } from '@/components/layout'
import { FloatingHeader } from '@/components/navigation/floating-header'
import { useFocusEffect } from '@react-navigation/native'
import { useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams } from 'expo-router'
import { Copy } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native'
import { ScrollView as GestureScrollView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { getOrderBySlug } from '@/api'
import { CancelOrderDialog } from '@/components/dialog'
import { Skeleton } from '@/components/ui'
import { colors, PaymentMethod, ROUTE } from '@/constants'
import { FOOTER_BOTTOM_EXTRA, STATIC_TOP_INSET } from '@/constants/status-bar'
import { useOrderBySlug, useRunAfterTransition } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { useNotificationStore, useUserStore } from '@/stores'
import { firstUnreadOrderPaidSlug } from '@/stores/selectors/notification.selectors'
import { OrderStatus, OrderTypeEnum } from '@/types'
import {
  calculateOrderDisplayAndTotals,
  formatCurrency,
  formatDateTime,
  getPaymentStatusLabel,
  showErrorToast,
  showToast,
} from '@/utils'
import { formatPointQrPayer } from '@/utils/point-payment-qr'

import { InvoiceSection } from '@/app/payment/payment-invoice-section'
import { PaymentProductItem } from '@/app/payment/payment-product-item'
import { OrderStatusBadge } from '@/components/order-history/order-status-badge'
import {
  getOrderHistoryStatus,
  type OrderHistoryStatus,
} from '@/lib/order-history-status'
import { Text } from '@/components/ui/text'

// ─── Skeleton ───────────────────────────────────────────────────────────────

function OrderDetailSkeleton() {
  return (
    <ScreenContainer edges={['top']} style={{ flex: 1 }}>
      <View style={sk.header}>
        <Skeleton
          style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12 }}
        />
        <Skeleton style={{ height: 20, width: 192, borderRadius: 6 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View style={sk.card}>
          <Skeleton style={{ height: 16, width: 128, borderRadius: 6 }} />
          <Skeleton style={{ height: 24, width: 160, borderRadius: 6 }} />
          <Skeleton style={{ height: 16, width: 112, borderRadius: 6 }} />
        </View>
        <View style={sk.card}>
          <Skeleton style={{ height: 40, width: '100%', borderRadius: 8 }} />
          <Skeleton style={{ height: 40, width: '100%', borderRadius: 8 }} />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

const sk = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gray[100],
    padding: 16,
    gap: 12,
  },
})

/** Một dòng nhãn — giá trị trong phần thông tin / thanh toán. */
const ReceiptRow = React.memo(function ReceiptRow({
  label,
  value,
  valueColor,
  isDark,
}: {
  label: string
  value: string
  valueColor?: string
  isDark: boolean
}) {
  return (
    <View style={ds.receiptRow}>
      <Text
        style={[
          ds.receiptLabel,
          { color: isDark ? colors.gray[400] : colors.gray[500] },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          ds.receiptValue,
          ds.receiptValueFlex,
          {
            color: valueColor ?? (isDark ? colors.gray[50] : colors.gray[900]),
          },
        ]}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  )
})

const STATUS_LABEL_KEY: Record<OrderHistoryStatus, string> = {
  unpaid: 'unpaid',
  paid: 'paid',
  completed: 'completed',
  failed: 'failed',
}

// ─── Main Content ────────────────────────────────────────────────────────────

function OrderDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const screenBg = isDark ? colors.background.dark : colors.background.light

  const {
    data: orderResponse,
    isPending,
    refetch: refetchOrder,
  } = useOrderBySlug(id ?? '')
  const order = orderResponse?.result
  const orderItems = order?.orderItems ?? null
  const voucher = order?.voucher ?? null

  // ── Auto-refetch on FCM ORDER_PAID notification ──
  const processedRef = useRef<Set<string>>(new Set())
  const paidNotificationSlug = useNotificationStore((s) =>
    firstUnreadOrderPaidSlug(s.notifications, id),
  )
  useEffect(() => {
    if (!paidNotificationSlug) return
    if (processedRef.current.has(paidNotificationSlug)) return
    processedRef.current.add(paidNotificationSlug)
    refetchOrder()
  }, [paidNotificationSlug, refetchOrder])

  // Refetch khi screen regains focus (background FCM)
  useFocusEffect(
    useCallback(() => {
      void refetchOrder()
    }, [refetchOrder]),
  )

  // Vòng quay kéo-làm-mới chỉ cho thao tác kéo của khách — tải lại khi quay
  // về màn (useFocusEffect) / theo thông báo không nên bật vòng quay.
  const [userRefreshing, setUserRefreshing] = useState(false)
  const handleUserRefresh = useCallback(() => {
    setUserRefreshing(true)
    void refetchOrder().finally(() => setUserRefreshing(false))
  }, [refetchOrder])

  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const getUserInfo = useUserStore((s) => s.getUserInfo)
  const isPending_ = order?.status === OrderStatus.PENDING
  const isDelivery = order?.type === OrderTypeEnum.DELIVERY
  const discountColor = isDark ? colors.success.dark : colors.success.solid
  const dividerColor = isDark ? colors.gray[700] : colors.gray[100]
  const itemQty = (orderItems ?? []).reduce(
    (n, it) => n + (it.quantity ?? 0),
    0,
  )
  const paymentMethodLabel = !order?.payment
    ? t('paymentMethod.notPaid', 'Chưa thanh toán')
    : order.payment.paymentMethod === PaymentMethod.BANK_TRANSFER
      ? t('paymentMethod.bankTransfer', 'Chuyển khoản')
      : order.payment.paymentMethod === PaymentMethod.CASH
        ? t('paymentMethod.cash', 'Tiền mặt')
        : order.payment.paymentMethod === PaymentMethod.POINT
          ? t('paymentMethod.point', 'Điểm tích lũy')
          : t('paymentMethod.creditCard', 'Thẻ tín dụng')
  const paymentStatusLabel = order?.payment
    ? getPaymentStatusLabel(order.payment.statusCode)
    : ''

  const handlePayment = useCallback(() => {
    if (!id) return
    queryClient.prefetchQuery({
      queryKey: ['order', id],
      queryFn: () => getOrderBySlug(id),
    })
    navigateNative.push(
      `${ROUTE.CLIENT_PAYMENT.replace('[order]', id)}?from=history` as Parameters<
        typeof navigateNative.push
      >[0],
    )
  }, [id, queryClient])

  const handleUpdateOrder = useCallback(() => {
    if (!getUserInfo()?.slug) {
      showErrorToast(1042)
      navigateNative.push(ROUTE.LOGIN)
      return
    }
    if (!order?.slug) return
    queryClient.prefetchQuery({
      queryKey: ['order', order.slug],
      queryFn: () => getOrderBySlug(order.slug),
    })
    navigateNative.push(
      `${ROUTE.CLIENT_UPDATE_ORDER.replace('[slug]', order.slug)}` as Parameters<
        typeof navigateNative.push
      >[0],
    )
  }, [order, queryClient, getUserInfo])

  const orderCode = String(order?.referenceNumber ?? order?.slug ?? '')
  const handleCopyCode = useCallback(() => {
    if (!orderCode) return
    void Clipboard.setStringAsync(orderCode)
    showToast(tToast('toast.copyCodeSuccess'))
  }, [orderCode, tToast])

  const handleProductPress = useCallback((productSlug: string) => {
    navigateNative.push({
      pathname: ROUTE.CLIENT_PRODUCT_DETAIL,
      params: { id: productSlug },
    })
  }, [])

  const { displayItemMap, cartTotals } = useMemo(() => {
    if (!orderItems)
      return {
        displayItemMap: new Map<
          string,
          ReturnType<
            typeof calculateOrderDisplayAndTotals
          >['displayItems'][number]
        >(),
        cartTotals: null,
      }
    const { displayItems, cartTotals } = calculateOrderDisplayAndTotals(
      orderItems,
      voucher,
    )
    const map = new Map<string, (typeof displayItems)[number]>()
    for (const di of displayItems) map.set(di.slug, di)
    return { displayItemMap: map, cartTotals }
  }, [orderItems, voucher])

  if (isPending) return <OrderDetailSkeleton />

  if (!order) {
    return (
      <ScreenContainer
        edges={['top']}
        style={{ flex: 1, backgroundColor: screenBg }}
      >
        <FloatingHeader
          title={t('order.orderDetail', 'Chi tiết đơn hàng')}
          onBack={navigateNative.back}
          disableBlur
        />
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: isDark ? colors.gray[400] : colors.gray[600] }}>
            {t('order.orderNotFound', 'Không tìm thấy đơn hàng')}
          </Text>
        </View>
      </ScreenContainer>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      <ScreenContainer edges={['top']} style={{ flex: 1 }}>
        <GestureScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: STATIC_TOP_INSET + 60,
            paddingBottom: isPending_ ? 100 : 40,
          }}
          showsVerticalScrollIndicator={true}
          refreshControl={
            <RefreshControl
              refreshing={userRefreshing}
              onRefresh={handleUserRefresh}
              tintColor={primaryColor}
              colors={[primaryColor]}
            />
          }
        >
          <View style={ds.contentPad}>
            {/* Order Info */}
            <View
              style={[
                ds.card,
                {
                  backgroundColor: isDark
                    ? colors.card.dark
                    : colors.white.light,
                  borderColor: isDark ? colors.gray[700] : colors.gray[100],
                },
              ]}
            >
              <View style={ds.receiptHeader}>
                <View style={ds.receiptHeaderRow}>
                  {/* Mã đơn dễ đọc (số tham chiếu) — chạm để sao chép, tiện đọc
                      cho quầy. slug là chuỗi ngẫu nhiên, khách không dùng được. */}
                  <Pressable
                    onPress={handleCopyCode}
                    hitSlop={6}
                    accessibilityRole="button"
                    style={ds.codeRow}
                  >
                    <Text
                      style={[
                        ds.receiptTitle,
                        { color: isDark ? colors.gray[50] : colors.gray[900] },
                      ]}
                    >
                      {t('order.order', 'Đơn hàng')} #{orderCode}
                    </Text>
                    <Copy
                      size={14}
                      color={isDark ? colors.gray[400] : colors.gray[500]}
                    />
                  </Pressable>
                  <OrderStatusBadge
                    status={getOrderHistoryStatus(order)}
                    label={t(
                      `order.${STATUS_LABEL_KEY[getOrderHistoryStatus(order)]}`,
                    )}
                  />
                </View>
                <Text
                  style={[
                    ds.receiptTime,
                    { color: isDark ? colors.gray[400] : colors.gray[500] },
                  ]}
                >
                  {formatDateTime(order.createdAt)}
                </Text>
              </View>
              <View
                style={[
                  ds.receiptDivider,
                  {
                    backgroundColor: isDark
                      ? colors.gray[700]
                      : colors.gray[100],
                  },
                ]}
              />
              <View style={ds.receiptBody}>
                {/* Khách đang xem đơn của chính mình — tên / SĐT chỉ có ích
                    với đơn giao hàng (người nhận). */}
                {isDelivery && (
                  <>
                    <View style={ds.receiptRow}>
                      <Text
                        style={[
                          ds.receiptLabel,
                          {
                            color: isDark ? colors.gray[400] : colors.gray[500],
                          },
                        ]}
                      >
                        {t('order.customer', 'Khách hàng')}
                      </Text>
                      <Text
                        style={[
                          ds.receiptValue,
                          {
                            color: isDark ? colors.gray[50] : colors.gray[900],
                          },
                        ]}
                      >
                        {order.owner?.firstName || order.owner?.lastName
                          ? `${order.owner.firstName || ''} ${order.owner.lastName || ''}`.trim()
                          : '-'}
                      </Text>
                    </View>
                    {order.owner?.phonenumber && (
                      <View style={ds.receiptRow}>
                        <Text
                          style={[
                            ds.receiptLabel,
                            {
                              color: isDark
                                ? colors.gray[400]
                                : colors.gray[500],
                            },
                          ]}
                        >
                          {t('order.phone', 'Điện thoại')}
                        </Text>
                        <Text
                          style={[
                            ds.receiptValue,
                            {
                              color: isDark
                                ? colors.gray[50]
                                : colors.gray[900],
                            },
                          ]}
                        >
                          {order.owner.phonenumber}
                        </Text>
                      </View>
                    )}
                  </>
                )}
                <View style={ds.receiptRow}>
                  <Text
                    style={[
                      ds.receiptLabel,
                      { color: isDark ? colors.gray[400] : colors.gray[500] },
                    ]}
                  >
                    {t('order.orderType', 'Loại đơn')}
                  </Text>
                  <Text
                    style={[
                      ds.receiptValue,
                      { color: isDark ? colors.gray[50] : colors.gray[900] },
                    ]}
                  >
                    {order.type === OrderTypeEnum.AT_TABLE
                      ? `${t('order.dineIn', 'Tại bàn')} - ${t('order.tableNumber', 'Bàn')} ${order.table?.name || '-'}`
                      : order.type === OrderTypeEnum.DELIVERY
                        ? t('menu.delivery', 'Giao hàng')
                        : t('order.takeAway', 'Mang đi')}
                  </Text>
                </View>
                {order.type === OrderTypeEnum.DELIVERY &&
                  order.deliveryTo?.formattedAddress && (
                    <View style={ds.receiptRow}>
                      <Text
                        style={[
                          ds.receiptLabel,
                          {
                            color: isDark ? colors.gray[400] : colors.gray[500],
                          },
                        ]}
                      >
                        {t('order.deliveryAddress', 'Địa chỉ')}
                      </Text>
                      <Text
                        style={[
                          ds.receiptValue,
                          {
                            color: isDark ? colors.gray[50] : colors.gray[900],
                            flex: 1,
                            textAlign: 'right',
                          },
                        ]}
                      >
                        {order.deliveryTo.formattedAddress}
                      </Text>
                    </View>
                  )}
                {order.description ? (
                  <View style={ds.receiptRow}>
                    <Text
                      style={[
                        ds.receiptLabel,
                        { color: isDark ? colors.gray[400] : colors.gray[500] },
                      ]}
                    >
                      {t('order.note', 'Ghi chú')}
                    </Text>
                    <Text
                      style={[
                        ds.receiptValue,
                        {
                          color: isDark ? colors.gray[50] : colors.gray[900],
                          flex: 1,
                          textAlign: 'right',
                        },
                      ]}
                    >
                      {order.description}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Order Items — tap product image to view detail */}
            <View
              style={[
                ds.card,
                {
                  backgroundColor: isDark
                    ? colors.card.dark
                    : colors.white.light,
                  borderColor: isDark ? colors.gray[700] : colors.gray[100],
                  padding: 16,
                },
              ]}
            >
              {(orderItems ?? []).map((item, index) => (
                <Pressable
                  key={item.slug || index}
                  onPress={() =>
                    handleProductPress(item.variant?.product?.slug ?? '')
                  }
                  style={({ pressed }) =>
                    pressed ? { opacity: 0.7 } : undefined
                  }
                >
                  <PaymentProductItem
                    item={item}
                    displayItem={displayItemMap.get(item.slug) ?? null}
                    voucher={voucher}
                    primaryColor={primaryColor}
                    isDark={isDark}
                    isLast={index === (orderItems ?? []).length - 1}
                  />
                </Pressable>
              ))}
            </View>

            {/* Payment Summary */}
            <View
              style={[
                ds.card,
                {
                  backgroundColor: isDark
                    ? colors.card.dark
                    : colors.white.light,
                  borderColor: isDark ? colors.gray[700] : colors.gray[100],
                },
              ]}
            >
              <View style={ds.receiptHeader}>
                <Text
                  style={[
                    ds.receiptTitle,
                    { color: isDark ? colors.gray[50] : colors.gray[900] },
                  ]}
                >
                  {t('order.paymentInformation', 'Thông tin thanh toán')}
                </Text>
              </View>
              <View
                style={[
                  ds.receiptDivider,
                  {
                    backgroundColor: isDark
                      ? colors.gray[700]
                      : colors.gray[100],
                  },
                ]}
              />
              <View style={ds.receiptBody}>
                {/* Tiền: tạm tính, giảm trừ (cùng một màu), phí → tổng nổi bật */}
                <ReceiptRow
                  label={t('order.subTotal', 'Tổng tiền hàng')}
                  value={formatCurrency(
                    cartTotals?.subTotalBeforeDiscount || 0,
                  )}
                  isDark={isDark}
                />
                {(cartTotals?.promotionDiscount ?? 0) > 0 && (
                  <ReceiptRow
                    label={t('order.discount', 'Khuyến mãi')}
                    value={`-${formatCurrency(cartTotals?.promotionDiscount || 0)}`}
                    valueColor={discountColor}
                    isDark={isDark}
                  />
                )}
                {order.voucher && (cartTotals?.voucherDiscount ?? 0) > 0 && (
                  <ReceiptRow
                    label={t('order.voucher', 'Mã giảm giá')}
                    value={`-${formatCurrency(cartTotals?.voucherDiscount || 0)}`}
                    valueColor={discountColor}
                    isDark={isDark}
                  />
                )}
                {order.accumulatedPointsToUse > 0 && (
                  <ReceiptRow
                    label={t('order.loyaltyPoint', 'Điểm tích lũy')}
                    value={`-${formatCurrency(order.accumulatedPointsToUse)}`}
                    valueColor={discountColor}
                    isDark={isDark}
                  />
                )}
                {isDelivery && order.deliveryFee > 0 && (
                  <ReceiptRow
                    label={t('order.deliveryFee', 'Phí giao hàng')}
                    value={formatCurrency(order.deliveryFee)}
                    isDark={isDark}
                  />
                )}
                {order.loss > 0 && (
                  <ReceiptRow
                    label={t(
                      'order.invoiceAutoDiscountUnderThreshold',
                      'Giảm giá tự động',
                    )}
                    value={`-${formatCurrency(order.loss)}`}
                    valueColor={discountColor}
                    isDark={isDark}
                  />
                )}

                <View
                  style={[
                    ds.receiptDivider,
                    { backgroundColor: dividerColor, marginHorizontal: 0 },
                  ]}
                />

                <View style={ds.totalRow}>
                  <View>
                    <Text
                      style={[
                        ds.semibold,
                        { color: isDark ? colors.gray[50] : colors.gray[900] },
                      ]}
                    >
                      {t('order.totalPayment', 'Tổng thanh toán')}
                    </Text>
                    <Text
                      style={[
                        ds.xsText,
                        { color: isDark ? colors.gray[400] : colors.gray[500] },
                      ]}
                    >
                      {t('menu.catalogItemCount', { count: itemQty })}
                    </Text>
                  </View>
                  <Text style={[ds.totalPrice, { color: primaryColor }]}>
                    {formatCurrency(order.subtotal || 0)}
                  </Text>
                </View>

                <View
                  style={[
                    ds.receiptDivider,
                    { backgroundColor: dividerColor, marginHorizontal: 0 },
                  ]}
                />

                {/* Cách trả: phương thức + trạng thái gộp một dòng */}
                <ReceiptRow
                  label={t('paymentMethod.title', 'Phương thức')}
                  value={[paymentMethodLabel, paymentStatusLabel]
                    .filter(Boolean)
                    .join(' · ')}
                  isDark={isDark}
                />
                {order.payment?.pointPaymentQr?.paidBy && (
                  <ReceiptRow
                    label={t('paymentMethod.paidBy', 'Người trả')}
                    value={formatPointQrPayer(
                      order.payment.pointPaymentQr.paidBy,
                    )}
                    isDark={isDark}
                  />
                )}
                {order.payment?.paymentMethod === PaymentMethod.CREDIT_CARD &&
                  order.payment.transactionId && (
                    <ReceiptRow
                      label={t('paymentMethod.transactionId', 'Mã giao dịch')}
                      value={order.payment.transactionId}
                      isDark={isDark}
                    />
                  )}
              </View>
            </View>

            {/* Invoice */}
            <InvoiceSection
              order={order}
              primaryColor={primaryColor}
              isDark={isDark}
            />

            {/* Update order — inline at bottom of scroll content, muted style */}
            {isPending_ && (
              <Pressable
                onPress={handleUpdateOrder}
                style={[ds.updateBtn, { borderColor: primaryColor }]}
              >
                <Text style={[ds.updateBtnText, { color: primaryColor }]}>
                  {t('order.updateOrder', 'Cập nhật đơn hàng')}
                </Text>
              </Pressable>
            )}
          </View>
        </GestureScrollView>
        {/* Sticky footer — cancel + payment */}
        {isPending_ && (
          <View
            style={[
              ds.bottomBar,
              {
                paddingBottom: insets.bottom + FOOTER_BOTTOM_EXTRA,
                backgroundColor: isDark ? colors.card.dark : colors.white.light,
                borderTopColor: isDark ? colors.gray[700] : colors.gray[200],
              },
            ]}
          >
            <View style={ds.footerRow}>
              <CancelOrderDialog order={order} />
              <Pressable
                onPress={handlePayment}
                style={[
                  ds.actionBtnFilled,
                  { backgroundColor: primaryColor, flex: 1 },
                ]}
              >
                <Text
                  style={[
                    ds.actionBtnFilledText,
                    { color: colors.white.light },
                  ]}
                >
                  {t('order.payment', 'Thanh toán')}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
        <FloatingHeader
          title={t('order.orderDetail', 'Chi tiết đơn hàng')}
          onBack={navigateNative.back}
          disableBlur
        />
      </ScreenContainer>
    </View>
  )
}

const ds = StyleSheet.create({
  contentPad: { paddingHorizontal: 16, paddingVertical: 16 },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  receiptHeader: { padding: 16, gap: 4 },
  receiptTitle: { fontSize: 16, fontWeight: '700' },
  receiptTime: { fontSize: 12 },
  receiptDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  receiptBody: { padding: 16, gap: 10 },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  receiptLabel: { fontSize: 13 },
  receiptValue: { fontSize: 13, fontWeight: '500' },
  receiptHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  semibold: { fontSize: 16, fontWeight: '600' },
  totalPrice: { fontSize: 24, fontWeight: '800' },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  receiptValueFlex: { flexShrink: 1, textAlign: 'right' },
  codeRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  xsText: { fontSize: 12 },
  updateBtn: {
    marginBottom: 16,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  updateBtnText: { fontSize: 14, fontWeight: '600' },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerRow: { flexDirection: 'row', gap: 10 },
  actionBtnFilled: {
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnFilledText: { fontSize: 14, fontWeight: '700' },
})

export default function OrderDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()
  // Lịch sử đơn tải trước ['order', id] lúc bấm — có dữ liệu thì hiện ngay,
  // không chờ chuyển màn xong.
  const [hasCache] = useState(() => !!queryClient.getQueryData(['order', id]))
  const [ready, setReady] = useState(hasCache)
  useRunAfterTransition(() => setReady(true), [], { transitionType: 'stack' })
  if (!ready) return <OrderDetailSkeleton />
  return <OrderDetailContent />
}
