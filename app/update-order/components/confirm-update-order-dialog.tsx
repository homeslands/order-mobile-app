import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrencyNative } from 'cart-price-calc'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

import { colors, ROUTE } from '@/constants'
import {
  useAddNewOrderItem,
  useDeleteOrderItem,
  useUpdateNoteOrderItem,
  useUpdateOrderItem,
  useUpdateOrderType,
  useUpdateVoucherInOrder,
} from '@/hooks'
import { navigateNative, scheduleTransitionTask } from '@/lib/navigation'
import { useOrderFlowStore } from '@/stores'
import { OrderTypeEnum } from '@/types'
import { IOrderItemsParam } from '@/types/voucher.type'
import {
  calculateOrderDisplayAndTotals,
  computeOrderApiDiff,
  isTempOrderItem,
  showErrorToastMessage,
  showToast,
  transformOrderItemToOrderDetail,
} from '@/utils'

const SNAP_POINTS = ['65%']

interface ConfirmUpdateOrderDialogProps {
  disabled?: boolean
  orderSlug: string
  onSuccess?: () => void
}

export default memo(function ConfirmUpdateOrderDialog({
  disabled,
  orderSlug,
  onSuccess,
}: ConfirmUpdateOrderDialogProps) {
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const [sheetVisible, setSheetVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const sheetRef = useRef<BottomSheetModal>(null)
  const queryClient = useQueryClient()
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const updatingData = useOrderFlowStore((s) => s.updatingData)
  const clearUpdatingData = useOrderFlowStore((s) => s.clearUpdatingData)

  const { mutateAsync: updateOrderType } = useUpdateOrderType()
  const { mutateAsync: deleteOrderItem } = useDeleteOrderItem()
  const { mutateAsync: addNewOrderItem } = useAddNewOrderItem()
  const { mutateAsync: updateOrderItem } = useUpdateOrderItem()
  const { mutateAsync: updateNoteOrderItem } = useUpdateNoteOrderItem()
  const { mutateAsync: updateVoucherInOrder } = useUpdateVoucherInOrder()

  const draft = updatingData?.updateDraft
  const originalOrder = updatingData?.originalOrder
  const orderType = (draft?.type as OrderTypeEnum) ?? OrderTypeEnum.AT_TABLE
  const orderItems = useMemo(() => draft?.orderItems ?? [], [draft])
  const voucher = draft?.voucher ?? null
  const deliveryFee = originalOrder?.deliveryFee ?? 0
  const accumulatedPoints = originalOrder?.accumulatedPointsToUse ?? 0

  const { displayItems, cartTotals } = useMemo(
    () => calculateOrderDisplayAndTotals(transformOrderItemToOrderDetail(orderItems), voucher),
    [orderItems, voucher],
  )
  const finalTotal = (cartTotals?.finalTotal ?? 0) + deliveryFee - accumulatedPoints

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!draft || !originalOrder || !orderSlug || isSubmitting) return
    setIsSubmitting(true)
    try {
      const { toDelete, toAdd, toUpdateQty, toUpdateNote } = computeOrderApiDiff(
        originalOrder.orderItems,
        draft.orderItems,
      )

      const metaChanged =
        originalOrder.type !== draft.type ||
        (originalOrder.table?.slug || null) !== (draft.table || null) ||
        (originalOrder.description ?? '') !== (draft.description ?? '') ||
        (originalOrder.timeLeftTakeOut ?? 0) !== (draft.timeLeftTakeOut ?? 0) ||
        (originalOrder.deliveryTo?.placeId || '') !==
          (draft.deliveryTo?.placeId || draft.deliveryPlaceId || '') ||
        (originalOrder.deliveryPhone ?? '') !== (draft.deliveryPhone ?? '')

      if (metaChanged) {
        await updateOrderType({
          slug: orderSlug,
          params: {
            type: draft.type,
            table: draft.table || null,
            description: draft.description ?? '',
            timeLeftTakeOut: draft.timeLeftTakeOut ?? 0,
            deliveryTo: draft.deliveryTo?.placeId ?? draft.deliveryPlaceId ?? undefined,
            deliveryPhone: draft.deliveryPhone ?? undefined,
          },
        })
      }

      if (toDelete.length > 0) {
        await Promise.all(toDelete.map((slug) => deleteOrderItem(slug)))
      }

      const newItemSlugMap = new Map<string, string>()
      if (toAdd.length > 0) {
        const addResults = await Promise.all(
          toAdd.map((item) =>
            addNewOrderItem({
              quantity: item.quantity,
              variant: item.variant.slug,
              promotion: item.promotion?.slug ?? '',
              order: orderSlug,
            }),
          ),
        )
        toAdd.forEach((item, i) => {
          const serverSlug = addResults[i]?.result?.slug
          if (serverSlug) newItemSlugMap.set(item.slug, serverSlug)
        })
      }

      if (toUpdateQty.length > 0) {
        const originalBySlug = new Map(originalOrder.orderItems.map((i) => [i.slug, i]))
        await Promise.all(
          toUpdateQty.map((item) => {
            const orig = originalBySlug.get(item.slug)
            const action = (item.quantity ?? 1) > (orig?.quantity ?? 1) ? 'increment' : 'decrement'
            return updateOrderItem({
              slug: item.slug,
              data: {
                quantity: item.quantity,
                variant: item.variant.slug,
                promotion: item.promotion?.slug ?? '',
                action,
              },
            })
          }),
        )
      }

      const newItemsWithNote = toAdd.filter((i) => (i.note ?? '') !== '')
      const allNoteUpdates = [...toUpdateNote, ...newItemsWithNote]
      if (allNoteUpdates.length > 0) {
        await Promise.all(
          allNoteUpdates.map((item) => {
            const realSlug = isTempOrderItem(item.slug)
              ? (newItemSlugMap.get(item.slug) ?? item.slug)
              : item.slug
            return updateNoteOrderItem({ slug: realSlug, data: { note: item.note ?? '' } })
          }),
        )
      }

      const voucherChanged =
        (originalOrder.voucher?.slug ?? null) !== (draft.voucher?.slug ?? null)
      if (voucherChanged) {
        const orderItemsParam: IOrderItemsParam[] = draft.orderItems.map((item) => ({
          quantity: item.quantity,
          variant: item.variant.slug,
          note: item.note ?? '',
          promotion: item.promotion?.slug ?? null,
          order: orderSlug,
        }))
        await updateVoucherInOrder({
          slug: orderSlug,
          voucher: draft.voucher?.slug ?? null,
          orderItems: orderItemsParam,
        })
      }

      navigateNative.replace(
        `${ROUTE.CLIENT_PAYMENT.replace('[order]', orderSlug)}` as Parameters<
          typeof navigateNative.replace
        >[0],
      )
      scheduleTransitionTask(() => {
        clearUpdatingData()
        queryClient.invalidateQueries({ queryKey: ['order', orderSlug] })
        showToast(tToast('toast.updateOrderSuccess'))
        sheetRef.current?.dismiss()
        onSuccess?.()
      })
    } catch {
      showErrorToastMessage(t('order.updateOrderFailed', 'Cập nhật thất bại, vui lòng thử lại'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Sheet UI ─────────────────────────────────────────────────────────────────

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )
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
    if (sheetVisible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [sheetVisible])

  const labelColor = isDark ? colors.gray[400] : colors.gray[500]
  const valueColor = isDark ? colors.gray[50] : colors.gray[900]
  const dividerColor = isDark ? colors.gray[700] : colors.border.light

  const orderTypeLabel =
    orderType === OrderTypeEnum.TAKE_OUT
      ? t('menu.takeAway')
      : orderType === OrderTypeEnum.DELIVERY
        ? t('menu.delivery')
        : t('menu.dineIn')

  return (
    <>
      {/* Trigger button */}
      <Pressable
        disabled={disabled || isSubmitting}
        onPress={() => setSheetVisible(true)}
        style={[
          cd.btn,
          { backgroundColor: disabled || isSubmitting ? (isDark ? colors.gray[700] : colors.gray[300]) : primaryColor },
          (disabled || isSubmitting) && cd.btnDisabled,
        ]}
      >
        <Text style={[cd.btnText, { color: disabled || isSubmitting ? (isDark ? colors.gray[400] : colors.gray[500]) : colors.white.light }]}>
          {t('order.confirmUpdate', 'Xác nhận cập nhật')}
        </Text>
      </Pressable>

      {/* Bottom sheet */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={bgStyle}
        onDismiss={() => setSheetVisible(false)}
      >
              {/* Header */}
              <View style={[cd.sheetHeader, { borderBottomColor: dividerColor }]}>
                <Text style={[cd.sheetTitle, { color: valueColor }]}>
                  {t('order.confirmUpdateOrder', 'Xác nhận cập nhật đơn hàng')}
                </Text>
              </View>

              {/* Scrollable content */}
              <BottomSheetScrollView
                contentContainerStyle={cd.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Order info */}
                <View style={cd.infoSection}>
                  <View style={[cd.infoRow, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
                    <Text style={[cd.infoLabel, { color: labelColor }]}>
                      {t('menu.orderType', 'Loại đơn')}
                    </Text>
                    <Text style={[cd.infoValue, { color: valueColor }]}>{orderTypeLabel}</Text>
                  </View>
                  {draft?.table ? (
                    <View style={[cd.infoRow, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}>
                      <Text style={[cd.infoLabel, { color: labelColor }]}>
                        {t('menu.tableName', 'Bàn')}
                      </Text>
                      <Text style={[cd.infoValue, { color: valueColor }]}>
                        {draft.table}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Items */}
                <View style={[cd.itemsSection, { borderTopColor: dividerColor }]}>
                  {displayItems.map((item, idx) => (
                    <View key={idx} style={cd.itemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[cd.itemName, { color: valueColor }]} numberOfLines={1}>
                          {(item as { name?: string }).name ?? ''} × {item.quantity}
                        </Text>
                        {(item as { size?: string }).size ? (
                          <Text style={[cd.itemSize, { color: labelColor }]}>
                            Size {((item as { size?: string }).size ?? '').toUpperCase()}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[cd.itemPrice, { color: primaryColor }]}>
                        {formatCurrencyNative(
                          ((item as { finalPrice?: number }).finalPrice ?? 0) * item.quantity,
                        )}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Totals */}
                <View style={[cd.totalsSection, { borderTopColor: dividerColor }]}>
                  <View style={cd.totalRow}>
                    <Text style={{ fontSize: 13, color: labelColor }}>
                      {t('order.subtotalBeforeDiscount', 'Tạm tính')}
                    </Text>
                    <Text style={{ fontSize: 13, color: labelColor }}>
                      {formatCurrencyNative(cartTotals?.subTotalBeforeDiscount ?? 0)}
                    </Text>
                  </View>
                  {(cartTotals?.promotionDiscount ?? 0) > 0 && (
                    <View style={cd.totalRow}>
                      <Text style={{ fontSize: 13, color: isDark ? colors.warning.dark : colors.warning.textLight }}>
                        {t('order.promotionDiscount', 'Khuyến mãi')}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDark ? colors.warning.dark : colors.warning.textLight }}>
                        -{formatCurrencyNative(cartTotals?.promotionDiscount ?? 0)}
                      </Text>
                    </View>
                  )}
                  {(cartTotals?.voucherDiscount ?? 0) > 0 && (
                    <View style={cd.totalRow}>
                      <Text style={{ fontSize: 13, color: isDark ? colors.success.dark : colors.success.light }}>
                        {t('order.voucherDiscount', 'Voucher')}
                      </Text>
                      <Text style={{ fontSize: 13, color: isDark ? colors.success.dark : colors.success.light }}>
                        -{formatCurrencyNative(cartTotals?.voucherDiscount ?? 0)}
                      </Text>
                    </View>
                  )}
                  {orderType === OrderTypeEnum.DELIVERY && deliveryFee > 0 && (
                    <View style={cd.totalRow}>
                      <Text style={{ fontSize: 13, color: labelColor }}>
                        {t('order.deliveryFee', 'Phí giao hàng')}
                      </Text>
                      <Text style={{ fontSize: 13, color: labelColor }}>
                        {formatCurrencyNative(deliveryFee)}
                      </Text>
                    </View>
                  )}
                  {accumulatedPoints > 0 && (
                    <View style={cd.totalRow}>
                      <Text style={{ fontSize: 13, color: primaryColor }}>
                        {t('order.accumulatedPointsToUse', 'Điểm tích lũy')}
                      </Text>
                      <Text style={{ fontSize: 13, color: primaryColor }}>
                        -{formatCurrencyNative(accumulatedPoints)}
                      </Text>
                    </View>
                  )}
                  <View style={[cd.totalRow, cd.finalRow, { borderTopColor: dividerColor }]}>
                    <Text style={[cd.finalLabel, { color: valueColor }]}>
                      {t('order.totalPayment', 'Tổng thanh toán')}
                    </Text>
                    <Text style={[cd.finalValue, { color: primaryColor }]}>
                      {formatCurrencyNative(finalTotal)}
                    </Text>
                  </View>
                </View>
              </BottomSheetScrollView>

              {/* Footer */}
              <View style={[cd.footer, { paddingBottom: bottomInset + 8 }]}>
                <Pressable
                  onPress={() => sheetRef.current?.dismiss()}
                  style={[
                    cd.cancelBtn,
                    { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] },
                  ]}
                >
                  <Text style={[cd.cancelText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>
                    {t('common.cancel', 'Huỷ')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleConfirm}
                  disabled={isSubmitting}
                  style={[
                    cd.submitBtn,
                    { backgroundColor: primaryColor, opacity: isSubmitting ? 0.6 : 1 },
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.white.light} />
                  ) : (
                    <Text style={[cd.submitText, { color: colors.white.light }]}>
                      {t('order.confirmUpdate', 'Xác nhận')}
                    </Text>
                  )}
                </Pressable>
              </View>
      </BottomSheetModal>
    </>
  )
})

const cd = StyleSheet.create({
  // ── Trigger button ──────────────────────────────────────────────────────────
  btn: {
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    minWidth: 160,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '700' },
  // ── Sheet ───────────────────────────────────────────────────────────────────
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 16 },
  infoSection: { gap: 8, paddingVertical: 12 },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: '600' },
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
  itemName: { fontSize: 14, fontWeight: '600' },
  itemSize: { fontSize: 12, marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '700' },
  totalsSection: {
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finalRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  finalLabel: { fontSize: 15, fontWeight: '700' },
  finalValue: { fontSize: 20, fontWeight: '800' },
  // ── Footer buttons ──────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 15, fontWeight: '700' },
})
