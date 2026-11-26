import { getOrderBySlug } from '@/api/order'
import { colors, PHONE_NUMBER_REGEX, ROUTE } from '@/constants'
import {
  useCalculateDeliveryFee,
  useCreateOrder,
  useCreateOrderWithoutLogin,
} from '@/hooks'
import { scheduleTransitionTask } from '@/lib/navigation'
import { navigateNative } from '@/lib/navigation/navigation-engine'
import { capitalizeFirst } from '@/utils/format'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import type { ICreateOrderRequest } from '@/types'
import {
  calculateCartDisplayAndTotals,
  formatCurrency,
  parseKm,
  showErrorToast,
  showToast,
} from '@/utils'
import { GlassSheetBackground } from '@/components/ui/glass-sheet-background'
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
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import type { IOrderItem } from '@/types'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'
import { Text } from '@/components/ui/text'

const CONFIRM_ORDER_SNAP = ['65%']
/** Chiều cao thanh nút không kể vùng an toàn: đệm trên 12 + nút 48 + đệm dưới 12 */
const FOOTER_HEIGHT = 12 + 48 + 12

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
  const { t: tCommon } = useTranslation('common')
  const { t: tToast } = useTranslation('toast')
  const queryClient = useQueryClient()

  const { mutate: createOrder, isPending } = useCreateOrder()
  const { mutate: createOrderWithoutLogin, isPending: isPendingNoLogin } =
    useCreateOrderWithoutLogin()
  const clearUpdatingData = useOrderFlowStore((s) => s.clearUpdatingData)

  const { hasUser } = useUserStore(
    useShallow((s) => ({
      hasUser: !!s.userInfo,
    })),
  )
  const getUserInfo = useUserStore((s) => s.getUserInfo)
  // Customer-only app: the branch always comes from the customer's picked branch
  // (branchStore) — never a staff-assigned userInfo.branch. Role can be unloaded
  // right after first register+login, so it must NOT gate the branch source.
  const branchSlug = useBranchStore((s) => s.branch?.slug)

  // Chỉ biết "có đơn hay không" — sheet đã đóng (vẫn được giữ sau lần mở đầu)
  // không vẽ lại theo mỗi lần đổi số lượng / ghi chú trong giỏ. Dữ liệu đơn
  // đọc lúc bấm đặt (getState) và trong ConfirmOrderBody (chỉ dựng khi mở).
  const hasOrder = useOrderFlowStore((s) => !!s.orderingData)
  const transitionToPayment = useOrderFlowStore((s) => s.transitionToPayment)

  const isSubmitting = isPending || isPendingNoLogin

  const handleSubmit = useCallback(() => {
    const order = useOrderFlowStore.getState().orderingData
    if (!order || !branchSlug) {
      if (!branchSlug) showErrorToast(11000)
      return
    }
    if (order.type === 'delivery') {
      const phoneOk =
        !!order.deliveryPhone && PHONE_NUMBER_REGEX.test(order.deliveryPhone)
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

      queryClient.prefetchQuery({
        queryKey: ['order', orderSlug],
        queryFn: () => getOrderBySlug(orderSlug),
      })
      navigateNative.push({
        // Customer-only app: always the client payment route.
        pathname: ROUTE.CLIENT_PAYMENT,
        params: { order: orderSlug },
      })
      scheduleTransitionTask(() => {
        transitionToPayment(orderSlug)
        useOrderFlowStore.getState().clearOrderingData()
        clearUpdatingData()
        onClose()
        showToast(tToast('toast.createOrderSuccess'))
      })
    }

    const onError = (error: unknown) => {
      onClose()
      const err = error as {
        response?: { data?: { statusCode?: number; code?: number } }
      }
      const code = err?.response?.data?.statusCode ?? err?.response?.data?.code
      setTimeout(() => {
        if (code) {
          showErrorToast(code)
        } else {
          showToast(tToast('toast.createOrderFailed'), 'error')
        }
      }, 300)
    }

    if (hasUser) {
      createOrder(req, { onSuccess, onError })
    } else {
      createOrderWithoutLogin(req, { onSuccess, onError })
    }
  }, [
    branchSlug,
    hasUser,
    getUserInfo,
    transitionToPayment,
    clearUpdatingData,
    createOrder,
    createOrderWithoutLogin,
    queryClient,
    onClose,
    tToast,
  ])

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
  useEffect(() => {
    if (visible && hasOrder) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible, hasOrder])

  // Thanh nút sát đáy sheet, nền phủ luôn vùng an toàn: trước đặt
  // bottomInset={inset} nên dưới thanh nút có khe hở không nền — cuộn là lộ
  // nội dung bên dưới.
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View
          style={[
            s.footer,
            {
              paddingBottom: bottomInset + 12,
              backgroundColor: isDark ? colors.card.dark : colors.white.light,
              borderTopColor: isDark ? colors.border.dark : colors.border.light,
            },
          ]}
        >
          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            disabled={isSubmitting}
            accessibilityRole="button"
            style={[
              s.cancelBtn,
              {
                backgroundColor: isDark ? colors.gray[800] : colors.gray[100],
                opacity: isSubmitting ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[
                s.cancelText,
                { color: isDark ? colors.gray[50] : colors.gray[700] },
              ]}
            >
              {tCommon('common.cancel')}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
            style={[
              s.submitBtn,
              {
                backgroundColor: primaryColor,
                opacity: isSubmitting ? 0.7 : 1,
              },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.white.light} />
            ) : (
              <Text style={s.submitText}>{t('order.create')}</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [isDark, primaryColor, handleSubmit, isSubmitting, t, tCommon, bottomInset],
  )

  if (!visible || !hasOrder) return null

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={CONFIRM_ORDER_SNAP}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassSheetBackground}
      onDismiss={onClose}
      footerComponent={renderFooter}
    >
      <ConfirmOrderBody
        isDark={isDark}
        primaryColor={primaryColor}
        hasUser={hasUser}
        branchSlug={branchSlug}
        bottomInset={bottomInset}
      />
    </BottomSheetModal>
  )
})

/**
 * Thân sheet — chỉ dựng khi sheet mở, nên chỉ ở đây mới theo dõi dữ liệu đơn
 * và hỏi phí giao hàng.
 */
const ConfirmOrderBody = memo(function ConfirmOrderBody({
  isDark,
  primaryColor,
  hasUser,
  branchSlug,
  bottomInset,
}: {
  isDark: boolean
  primaryColor: string
  hasUser: boolean
  branchSlug: string | undefined
  bottomInset: number
}) {
  const { t } = useTranslation('menu')
  const order = useOrderFlowStore((s) => s.orderingData)

  const { displayItems, cartTotals } = useMemo(() => {
    if (order)
      return calculateCartDisplayAndTotals(order, order.voucher || null)
    return {
      displayItems: [] as ReturnType<
        typeof calculateCartDisplayAndTotals
      >['displayItems'],
      cartTotals: {
        subTotalBeforeDiscount: 0,
        promotionDiscount: 0,
        voucherDiscount: 0,
        finalTotal: 0,
      },
    }
  }, [order])

  const deliveryFee = useCalculateDeliveryFee(
    parseKm(order?.deliveryDistance) || 0,
    branchSlug || '',
    { enabled: hasUser && order?.type === 'delivery' },
  )

  const c = useMemo(
    () => ({
      strong: isDark ? colors.gray[50] : colors.gray[900],
      muted: isDark ? colors.gray[400] : colors.gray[500],
      groupBg: isDark ? colors.background.dark : colors.gray[100],
      divider: isDark ? colors.border.dark : colors.border.light,
      discount: isDark ? colors.success.dark : colors.success.solid,
    }),
    [isDark],
  )

  const contentStyle = useMemo(
    () => [
      s.scrollContent,
      { paddingBottom: FOOTER_HEIGHT + bottomInset + 16 },
    ],
    [bottomInset],
  )

  if (!order) return null

  const totalWithDelivery =
    cartTotals.finalTotal + (deliveryFee?.deliveryFee || 0)

  // Các dòng thông tin đơn — một nhóm, ngăn bằng đường kẻ
  const infoRows: Array<{ label: string; value: string }> = [
    {
      label: t('menu.orderType'),
      value:
        order.type === 'at-table'
          ? t('menu.dineIn')
          : order.type === 'delivery'
            ? t('menu.delivery')
            : t('menu.takeAway'),
    },
  ]
  if (order.tableName) {
    infoRows.push({ label: t('menu.tableName'), value: order.tableName })
  }
  if (order.type === 'take-out') {
    infoRows.push({
      label: t('menu.pickupTime'),
      value:
        !order.timeLeftTakeOut || order.timeLeftTakeOut === 0
          ? t('menu.immediately')
          : `${order.timeLeftTakeOut} ${t('menu.minutes')}`,
    })
  }
  if (order.type === 'delivery') {
    if (order.deliveryAddress) {
      infoRows.push({
        label: t('order.deliveryAddress'),
        value: order.deliveryAddress,
      })
    }
    if (order.deliveryPhone) {
      infoRows.push({
        label: t('order.deliveryPhone'),
        value: order.deliveryPhone,
      })
    }
  }
  if (order.description?.trim()) {
    infoRows.push({
      label: t('order.orderNote'),
      value: order.description.trim(),
    })
  }

  return (
    <>
      <View style={[s.header, { borderBottomColor: c.divider }]}>
        <Text style={[s.title, { color: c.strong }]}>
          {t('cart.confirmOrder')}
        </Text>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
      >
        {/* Thông tin đơn */}
        <View style={[s.group, { backgroundColor: c.groupBg }]}>
          {infoRows.map((row, i) => (
            <View
              key={row.label}
              style={[
                s.infoRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: c.divider,
                },
              ]}
            >
              <Text style={[s.infoLabel, { color: c.muted }]}>{row.label}</Text>
              <Text
                style={[s.infoValue, { color: c.strong }]}
                numberOfLines={3}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {/* Món */}
        <View style={s.itemsSection}>
          {displayItems.map((item, idx) => {
            // Size / ghi chú lấy từ món trong giỏ cùng vị trí
            const source = order.orderItems[idx] as IOrderItem | undefined
            const size = source?.size ? capitalizeFirst(source.size) : ''
            return (
              <View key={`${item.slug}-${idx}`} style={s.itemRow}>
                <View style={s.itemInfo}>
                  <Text
                    style={[s.itemName, { color: c.strong }]}
                    numberOfLines={1}
                  >
                    {capitalizeFirst(item.name || '')} × {item.quantity}
                  </Text>
                  {size ? (
                    <Text style={[s.itemMeta, { color: c.muted }]}>{size}</Text>
                  ) : null}
                  {source?.note ? (
                    <Text
                      style={[s.itemNote, { color: c.muted }]}
                      numberOfLines={2}
                    >
                      {source.note}
                    </Text>
                  ) : null}
                </View>
                <Text style={[s.itemPrice, { color: c.strong }]}>
                  {formatCurrency((item.finalPrice ?? 0) * item.quantity)}
                </Text>
              </View>
            )
          })}
        </View>

        {/* Tiền */}
        <View style={[s.totalsSection, { borderTopColor: c.divider }]}>
          <View style={s.totalRow}>
            <Text style={[s.totalText, { color: c.muted }]}>
              {t('order.subtotal')}
            </Text>
            <Text style={[s.totalText, { color: c.muted }]}>
              {formatCurrency(cartTotals.subTotalBeforeDiscount)}
            </Text>
          </View>
          {cartTotals.promotionDiscount > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalText, { color: c.discount }]}>
                {t('order.promotionDiscount')}
              </Text>
              <Text style={[s.totalText, { color: c.discount }]}>
                -{formatCurrency(cartTotals.promotionDiscount)}
              </Text>
            </View>
          )}
          {cartTotals.voucherDiscount > 0 && (
            <View style={s.totalRow}>
              <Text style={[s.totalText, { color: c.discount }]}>
                {t('order.voucher')}
              </Text>
              <Text style={[s.totalText, { color: c.discount }]}>
                -{formatCurrency(cartTotals.voucherDiscount)}
              </Text>
            </View>
          )}
          {order.type === 'delivery' && (
            <View style={s.totalRow}>
              <Text style={[s.totalText, { color: c.muted }]}>
                {t('order.deliveryFee')}
              </Text>
              <Text style={[s.totalText, { color: c.muted }]}>
                {formatCurrency(deliveryFee?.deliveryFee || 0)}
              </Text>
            </View>
          )}
          <View style={[s.totalRow, s.finalRow, { borderTopColor: c.divider }]}>
            <Text style={[s.finalLabel, { color: c.strong }]}>
              {t('order.totalPayment')}
            </Text>
            <Text style={[s.finalValue, { color: primaryColor }]}>
              {formatCurrency(totalWithDelivery)}
            </Text>
          </View>
        </View>
      </BottomSheetScrollView>
    </>
  )
})

const s = StyleSheet.create({
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
    paddingTop: 12,
  },
  group: {
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
  },
  itemsSection: {
    gap: 12,
    paddingVertical: 16,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemInfo: { flex: 1, gap: 2 },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  itemMeta: { fontSize: 13 },
  itemNote: { fontSize: 13, fontStyle: 'italic' },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600',
  },
  totalsSection: {
    gap: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalText: { fontSize: 14 },
  finalRow: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'baseline',
  },
  finalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  finalValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Nút chính rộng hơn nút Huỷ
  submitBtn: {
    flex: 1.6,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white.light,
  },
})
