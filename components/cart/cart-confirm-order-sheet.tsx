import { getOrderBySlug } from '@/api/order'
import { colors, PHONE_NUMBER_REGEX, Role, ROUTE } from '@/constants'
import {
  useCalculateDeliveryFee,
  useCreateOrder,
  useCreateOrderWithoutLogin,
} from '@/hooks'
import { navigateNative } from '@/lib/navigation/navigation-engine'
import { scheduleTransitionTask } from '@/lib/navigation'
import { useBranchStore, useOrderFlowStore, useUpdateOrderStore, useUserStore } from '@/stores'
import type { ICreateOrderRequest } from '@/types'
import { calculateCartDisplayAndTotals, formatCurrency, parseKm, showErrorToast, showToast } from '@/utils'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { useQueryClient } from '@tanstack/react-query'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

const CONFIRM_ORDER_SNAP = ['65%']

export const ConfirmOrderSheet = memo(function ConfirmOrderSheet({
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
  const { bottom: bottomInset } = useSafeAreaInsets()
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const queryClient = useQueryClient()

  const { mutate: createOrder, isPending } = useCreateOrder()
  const { mutate: createOrderWithoutLogin, isPending: isPendingNoLogin } =
    useCreateOrderWithoutLogin()
  const clearUpdateOrderStore = useUpdateOrderStore((s) => s.clearStore)

  const { hasUser, roleName, userBranchSlug } = useUserStore(
    useShallow((s) => ({
      hasUser: !!s.userInfo,
      roleName: s.userInfo?.role?.name,
      userBranchSlug: s.userInfo?.branch?.slug,
    })),
  )
  const getUserInfo = useUserStore((s) => s.getUserInfo)
  const branchSlugFromBranch = useBranchStore((s) => s.branch?.slug)
  const branchSlug = !hasUser || roleName === Role.CUSTOMER ? branchSlugFromBranch : userBranchSlug

  const order = useOrderFlowStore((s) => s.orderingData)
  const transitionToPayment = useOrderFlowStore((s) => s.transitionToPayment)

  const { displayItems, cartTotals } = useMemo(() => {
    if (!visible || !order) {
      return {
        displayItems: [] as ReturnType<typeof calculateCartDisplayAndTotals>['displayItems'],
        cartTotals: { subTotalBeforeDiscount: 0, promotionDiscount: 0, voucherDiscount: 0, finalTotal: 0 },
      }
    }
    return calculateCartDisplayAndTotals(order, order.voucher || null)
  }, [visible, order])

  const deliveryFee = useCalculateDeliveryFee(
    parseKm(order?.deliveryDistance) || 0,
    branchSlug || '',
    { enabled: visible && hasUser },
  )

  const isSubmitting = isPending || isPendingNoLogin

  const handleSubmit = useCallback(() => {
    if (!order || !branchSlug) {
      if (!branchSlug) showErrorToast(11000)
      return
    }
    if (order.type === 'delivery') {
      const phoneOk = !!order.deliveryPhone && PHONE_NUMBER_REGEX.test(order.deliveryPhone)
      if (!order.deliveryAddress || !phoneOk) {
        showErrorToast(119000)
        return
      }
    }
    const req: ICreateOrderRequest = {
      type: order.type,
      timeLeftTakeOut: order.timeLeftTakeOut || 0,
      deliveryTo: order.deliveryPlaceId || '',
      deliveryPhone: order.deliveryPhone || '',
      table: order.table || '',
      branch: branchSlug,
      owner: order.owner || getUserInfo()?.slug || '',
      approvalBy: getUserInfo()?.slug || '',
      orderItems: order.orderItems.map((item) => ({
        quantity: item.quantity,
        variant: item.variant.slug,
        promotion: item.promotion ? item.promotion.slug : null,
        note: item.note || '',
      })),
      voucher: order.voucher?.slug || null,
      description: order.description || '',
    }

    const onSuccess = (data: { result: { slug: string } }) => {
      const orderSlug = data.result.slug
      const paymentRoute = roleName === Role.CUSTOMER ? ROUTE.CLIENT_PAYMENT : ROUTE.SYSTEM_PAYMENT

      queryClient.prefetchQuery({
        queryKey: ['order', orderSlug],
        queryFn: () => getOrderBySlug(orderSlug),
      })
      navigateNative.push({ pathname: hasUser ? paymentRoute : ROUTE.CLIENT_PAYMENT, params: { order: orderSlug } })
      scheduleTransitionTask(() => {
        transitionToPayment(orderSlug)
        useOrderFlowStore.getState().clearOrderingData()
        clearUpdateOrderStore()
        onClose()
        showToast(tToast('toast.createOrderSuccess'))
      })
    }

    const onError = (error: unknown) => {
      onClose()
      const err = error as { response?: { data?: { statusCode?: number; code?: number } } }
      const code = err?.response?.data?.statusCode ?? err?.response?.data?.code
      setTimeout(() => {
        if (code) {
          showErrorToast(code)
        } else {
          showToast(tToast('toast.createOrderFailed', 'Tạo đơn thất bại'))
        }
      }, 300)
    }

    if (hasUser) {
      createOrder(req, { onSuccess, onError })
    } else {
      createOrderWithoutLogin(req, { onSuccess, onError })
    }
  }, [order, branchSlug, hasUser, roleName, getUserInfo, transitionToPayment, clearUpdateOrderStore, createOrder, createOrderWithoutLogin, queryClient, onClose, tToast])

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} pressBehavior="close" />
    ),
    [],
  )
  useEffect(() => {
    if (visible && order) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible, order])

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={bottomInset}>
        <View style={[confirmOrderStyles.footer, { backgroundColor: isDark ? colors.gray[900] : colors.white.light, borderTopColor: isDark ? colors.gray[700] : colors.border.light }]}>
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            disabled={isSubmitting}
            style={[confirmOrderStyles.cancelBtn, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100], opacity: isSubmitting ? 0.5 : 1 }]}
          >
            <Text style={[confirmOrderStyles.cancelText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>{t('common.cancel', 'Huỷ')}</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={[confirmOrderStyles.submitBtn, { backgroundColor: primaryColor, opacity: isSubmitting ? 0.7 : 1 }]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={confirmOrderStyles.submitText}>{t('order.create', 'Đặt món')}</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [isDark, primaryColor, handleSubmit, isSubmitting, t, bottomInset],
  )

  if (!visible || !order) return null

  const totalWithDelivery = cartTotals.finalTotal + (deliveryFee?.deliveryFee || 0)

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={CONFIRM_ORDER_SNAP}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={onClose}
      footerComponent={renderFooter}
    >
          {/* Header */}
          <View style={[confirmOrderStyles.header, { borderBottomColor: isDark ? colors.gray[700] : colors.border.light }]}>
            <Text style={[confirmOrderStyles.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
              {t('order.confirmOrder', 'Xác nhận đơn hàng')}
            </Text>
          </View>

          {/* Scrollable content */}
          <BottomSheetScrollView contentContainerStyle={confirmOrderStyles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Order info rows */}
            <View style={confirmOrderStyles.infoSection}>
              <View style={[confirmOrderStyles.infoRow, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
                <Text style={[confirmOrderStyles.infoLabel, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>{t('menu.orderType', 'Loại đơn')}</Text>
                <Text style={[confirmOrderStyles.infoValue, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
                  {order.type === 'at-table' ? t('menu.dineIn') : order.type === 'delivery' ? t('menu.delivery') : t('menu.takeAway')}
                </Text>
              </View>
              {order.tableName ? (
                <View style={[confirmOrderStyles.infoRow, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
                  <Text style={[confirmOrderStyles.infoLabel, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>{t('menu.tableName', 'Bàn')}</Text>
                  <Text style={[confirmOrderStyles.infoValue, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>{order.tableName}</Text>
                </View>
              ) : null}
              {order.type === 'take-out' && (
                <View style={[confirmOrderStyles.infoRow, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
                  <Text style={[confirmOrderStyles.infoLabel, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>{t('menu.pickupTime')}</Text>
                  <Text style={[confirmOrderStyles.infoValue, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
                    {!order.timeLeftTakeOut || order.timeLeftTakeOut === 0
                      ? t('menu.immediately')
                      : `${order.timeLeftTakeOut} ${t('menu.minutes')}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Items */}
            <View style={[confirmOrderStyles.itemsSection, { borderTopColor: isDark ? colors.gray[700] : colors.border.light }]}>
              {displayItems.map((item, idx) => (
                <View key={idx} style={confirmOrderStyles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[confirmOrderStyles.itemName, { color: isDark ? colors.gray[50] : colors.gray[900] }]} numberOfLines={1}>
                      {(item as { name?: string }).name || ''} × {item.quantity}
                    </Text>
                    <Text style={{ fontSize: 12, color: isDark ? colors.gray[400] : colors.gray[500] }}>
                      Size {((item as { size?: string }).size || '').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[confirmOrderStyles.itemPrice, { color: primaryColor }]}>
                    {formatCurrency((item as { finalPrice?: number }).finalPrice ? (item as { finalPrice: number }).finalPrice * item.quantity : 0)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Totals */}
            <View style={[confirmOrderStyles.totalsSection, { borderTopColor: isDark ? colors.gray[700] : colors.border.light }]}>
              <View style={confirmOrderStyles.totalRow}>
                <Text style={{ fontSize: 13, color: isDark ? colors.gray[400] : colors.gray[500] }}>{t('order.subtotal', 'Tạm tính')}</Text>
                <Text style={{ fontSize: 13, color: isDark ? colors.gray[400] : colors.gray[500] }}>{formatCurrency(cartTotals.subTotalBeforeDiscount)}</Text>
              </View>
              {cartTotals.promotionDiscount > 0 && (
                <View style={confirmOrderStyles.totalRow}>
                  <Text style={{ fontSize: 13, color: '#eab308' }}>{t('order.promotionDiscount', 'Khuyến mãi')}</Text>
                  <Text style={{ fontSize: 13, color: '#eab308' }}>-{formatCurrency(cartTotals.promotionDiscount)}</Text>
                </View>
              )}
              {cartTotals.voucherDiscount > 0 && (
                <View style={confirmOrderStyles.totalRow}>
                  <Text style={{ fontSize: 13, color: '#22c55e' }}>{t('order.voucher', 'Voucher')}</Text>
                  <Text style={{ fontSize: 13, color: '#22c55e' }}>-{formatCurrency(cartTotals.voucherDiscount)}</Text>
                </View>
              )}
              {order.type === 'delivery' && (
                <View style={confirmOrderStyles.totalRow}>
                  <Text style={{ fontSize: 13, color: isDark ? colors.gray[400] : colors.gray[500] }}>{t('order.deliveryFee', 'Phí giao hàng')}</Text>
                  <Text style={{ fontSize: 13, color: isDark ? colors.gray[400] : colors.gray[500] }}>{formatCurrency(deliveryFee?.deliveryFee || 0)}</Text>
                </View>
              )}
              <View style={[confirmOrderStyles.totalRow, confirmOrderStyles.finalRow, { borderTopColor: isDark ? colors.gray[700] : colors.border.light }]}>
                <Text style={[confirmOrderStyles.finalLabel, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>{t('order.totalPayment', 'Tổng thanh toán')}</Text>
                <Text style={[confirmOrderStyles.finalValue, { color: primaryColor }]}>{formatCurrency(totalWithDelivery)}</Text>
              </View>
            </View>
          </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const confirmOrderStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  infoSection: {
    gap: 8,
    paddingVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  itemsSection: {
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalsSection: {
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  finalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  finalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  finalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
})
