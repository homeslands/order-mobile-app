/**
 * Cart Footer — thanh dưới cố định: tổng tiền + nút Đặt hàng. Giữ và hiển thị
 * các sheet tuỳ chọn đơn (loại đơn / bàn / voucher / giao hàng — mở qua
 * useCartSheetStore từ CartOrderOptions trong danh sách hoặc từ nút Đặt hàng)
 * và sheet xác nhận.
 */
import { getSystemFeatureFlagsByGroup } from '@/api'
import {
  colors,
  ORDER_FEATURE_FLAGS_STALE_MS,
  PHONE_NUMBER_REGEX,
  QUERYKEY,
  SystemLockFeatureChild,
  SystemLockFeatureGroup,
  SystemLockFeatureType,
} from '@/constants'
import {
  FOOTER_BOTTOM_EXTRA,
  STATIC_BOTTOM_INSET,
} from '@/constants/status-bar'
import { useCartValidation } from '@/hooks/use-cart-validation'
import { useSingleFlight } from '@/hooks/use-single-flight'
import { useOrderFlowStore, useUserStore } from '@/stores'
import {
  cartActions,
  useCartItemCount,
  useCartTotal,
  useCartVoucherDiscount,
} from '@/stores/cart.store'
import { useOrderFlowCartFooterData } from '@/stores/selectors/order-flow.selectors'
import { useCartSheetStore } from '@/stores/cart-sheet.store'
import { useCalculateDeliveryFee } from '@/hooks/use-branch-delivery'
import { useBranchStore } from '@/stores'
import type { IFeatureLock, IVoucher } from '@/types'
import { parseKm, showErrorToastMessage, showToast } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { formatCurrencyNative } from 'cart-price-calc'
import { ShoppingBag } from 'lucide-react-native'
import React, { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native'

import { DeliveryAddressSheet } from '@/components/delivery'
import { getCartCheckoutStep } from './cart-checkout-step'
import { ConfirmOrderSheet } from './cart-confirm-order-sheet'
import { SimpleOrderTypeSheet } from './cart-order-type-sheet'
import { SimpleTableSheet } from './cart-table-sheet'
import { VoucherSheet } from './cart-voucher-sheet'
import { useMountOnFirstOpen } from '@/hooks/use-mount-on-first-open'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Text } from '@/components/ui/text'

const ORDER_TYPE_FEATURE_MAP: Partial<Record<string, string>> = {
  'at-table': SystemLockFeatureChild.AT_TABLE,
  'take-out': SystemLockFeatureChild.TAKE_OUT,
  delivery: SystemLockFeatureChild.DELIVERY,
}

// Trả về danh sách order type còn khả dụng dựa trên feature flags
// isLoggedIn → dùng CREATE_PRIVATE (có DELIVERY), guest → dùng CREATE_PUBLIC (không có DELIVERY)
function getAvailableOrderTypes(
  flags: IFeatureLock[],
  isLoggedIn: boolean,
): string[] {
  const parentName = isLoggedIn
    ? SystemLockFeatureType.CREATE_PRIVATE
    : SystemLockFeatureType.CREATE_PUBLIC
  const parent = flags.find((f) => f.name === parentName)
  if (!parent || parent.isLocked) return []
  return Object.keys(ORDER_TYPE_FEATURE_MAP).filter((type) => {
    const featureKey = ORDER_TYPE_FEATURE_MAP[type]
    const child = parent.children?.find((c) => c.name === featureKey)
    return child !== undefined && child.isLocked !== true
  })
}

export const CartFooter = memo(function CartFooter({
  primaryColor,
  isDark,
  onLayout,
}: {
  primaryColor: string
  isDark: boolean
  onLayout?: (e: LayoutChangeEvent) => void
}) {
  const { t } = useTranslation('menu')
  const bottomInset = STATIC_BOTTOM_INSET
  const queryClient = useQueryClient()
  const hasUser = useUserStore((s) => !!s.userInfo)
  const total = useCartTotal()
  const itemCount = useCartItemCount()
  const openSheet = useCartSheetStore((s) => s.open)
  const closeSheet = useCartSheetStore((s) => s.close)
  const sheet = useCartSheetStore((s) => s.sheet)
  const orderTypeSheetVisible = sheet === 'orderType'
  const tableSheetVisible = sheet === 'table'
  const voucherSheetOpen = sheet === 'voucher'
  const deliverySheetVisible = sheet === 'delivery'

  const {
    type: orderType,
    tableName,
    deliveryDistance,
    deliveryAddress,
    deliveryPhone,
  } = useOrderFlowCartFooterData()
  const branchSlug = useBranchStore((s) => s.branch?.slug ?? '')

  const { deliveryFee } = useCalculateDeliveryFee(
    parseKm(deliveryDistance) ?? 0,
    branchSlug,
    { enabled: orderType === 'delivery' && (deliveryDistance ?? 0) > 0 },
  )

  const voucherDiscount = useCartVoucherDiscount()
  const finalTotal = total - voucherDiscount + (deliveryFee ?? 0)

  const [confirmSheetVisible, setConfirmSheetVisible] = useState(false)
  // Mỗi sheet chỉ dựng khi mở lần đầu — dựng sẵn cả năm (kèm query, mutation,
  // hàng chục hook) là một nhịp đứng hình ngay lúc vào giỏ.
  const confirmMounted = useMountOnFirstOpen(confirmSheetVisible)
  const orderTypeMounted = useMountOnFirstOpen(orderTypeSheetVisible)
  const tableMounted = useMountOnFirstOpen(tableSheetVisible)
  const voucherMounted = useMountOnFirstOpen(voucherSheetOpen)
  const deliveryMounted = useMountOnFirstOpen(deliverySheetVisible)
  const { validate } = useCartValidation()
  const setOrderingType = useOrderFlowStore((s) => s.setOrderingType)

  const closeConfirmSheet = useCallback(() => setConfirmSheetVisible(false), [])
  const openDeliverySheet = useCallback(
    () => openSheet('delivery'),
    [openSheet],
  )
  const closeDeliverySheet = useCallback(() => {
    closeSheet()
    const s = useOrderFlowStore.getState()
    const addr = s.orderingData?.deliveryAddress ?? ''
    const phone = s.orderingData?.deliveryPhone ?? ''
    if (addr && !PHONE_NUMBER_REGEX.test(phone)) {
      s.clearDeliveryInfo()
    }
  }, [closeSheet])
  const handleApplyVoucher = useCallback(
    (v: IVoucher) => {
      cartActions.setVoucher(v)
      showToast(`Áp dụng: ${v.title}`)
      closeSheet()
    },
    [closeSheet],
  )
  const checkoutStep = useMemo(
    () =>
      getCartCheckoutStep({
        type: orderType,
        tableName,
        deliveryAddress,
        deliveryPhone,
      }),
    [orderType, tableName, deliveryAddress, deliveryPhone],
  )
  const isMissingInfo = checkoutStep.missing !== null
  const orderBtnLabel = t(checkoutStep.labelKey)

  const openTableSheet = useCallback(() => openSheet('table'), [openSheet])

  // ── Press-in prefetch ────────────────────────────────────────────────────
  // Nút "Đặt hàng" phải await validate + feature flags mới mở được sheet. Bắn
  // request ngay lúc ngón tay chạm xuống để ăn trước độ trễ — tới lúc thả thì
  // thường đã có cache. prefetchQuery tự dedupe nên bấm nhiều lần không tạo
  // request thừa.
  const prefetchOrderFlags = useCallback(() => {
    if (isMissingInfo) return
    void queryClient.prefetchQuery({
      queryKey: [
        QUERYKEY.systemFeatureFlagsByGroup,
        SystemLockFeatureGroup.ORDER,
      ],
      queryFn: () => getSystemFeatureFlagsByGroup(SystemLockFeatureGroup.ORDER),
      staleTime: ORDER_FEATURE_FLAGS_STALE_MS,
    })
  }, [queryClient, isMissingInfo])
  const openConfirmSheet = useCallback(async () => {
    // Chạy song song: validate menu + fetch feature flags (cả 2 thường đã warm cache)
    const [, flagsResponse] = await Promise.all([
      validate(true),
      queryClient
        .fetchQuery({
          queryKey: [
            QUERYKEY.systemFeatureFlagsByGroup,
            SystemLockFeatureGroup.ORDER,
          ],
          queryFn: () =>
            getSystemFeatureFlagsByGroup(SystemLockFeatureGroup.ORDER),
          staleTime: ORDER_FEATURE_FLAGS_STALE_MS,
        })
        .catch(() => null),
    ])

    const remaining = useOrderFlowStore.getState().orderingData?.orderItems
    if (!remaining || remaining.length === 0) return

    if (flagsResponse) {
      const currentType = useOrderFlowStore.getState().orderingData?.type
      const available = getAvailableOrderTypes(
        flagsResponse.result ?? [],
        hasUser,
      )
      if (currentType && !available.includes(currentType)) {
        if (available.length > 0) {
          setOrderingType(available[0] as Parameters<typeof setOrderingType>[0])
        }
        showErrorToastMessage('toast.orderTypeUnavailable')
        return
      }
    }

    setConfirmSheetVisible(true)
  }, [validate, queryClient, hasUser, setOrderingType])
  // Đang kiểm thì khoá nút + bỏ qua lượt bấm lặp (lượt lặp từng mở thẳng sheet
  // vì validate() trả null khi đang có lượt khác chạy).
  const { run: runCheckout, isRunning: isChecking } =
    useSingleFlight(openConfirmSheet)
  // Thiếu thông tin thì mở thẳng chỗ cần điền thay vì im lặng.
  const handleCheckoutPress = useCallback(() => {
    if (checkoutStep.sheet === 'table') return openTableSheet()
    if (checkoutStep.sheet === 'delivery') return openDeliverySheet()
    void runCheckout()
  }, [checkoutStep.sheet, openTableSheet, openDeliverySheet, runCheckout])

  // Memoize isDark/primaryColor-dependent styles
  const ft = useMemo(
    () => ({
      containerBg: isDark ? colors.card.dark : colors.white.light,
      selectBtnBorder: {
        borderColor: isDark ? colors.border.dark : colors.gray[200],
      },
      selectBtnTextColor: {
        color: isDark ? colors.gray[50] : colors.gray[900],
      },
      iconColor: isDark
        ? colors.mutedForeground.dark
        : colors.mutedForeground.light,
      mutedColor: { color: isDark ? colors.gray[400] : colors.gray[500] },
      mutedColorAlt: { color: isDark ? colors.gray[500] : colors.gray[400] },
      chevronColor: isDark ? colors.gray[500] : colors.gray[400],
      primaryColorStyle: { color: primaryColor },
      primaryBorderStyle: { borderColor: primaryColor },
      disabledBtnBg: {
        backgroundColor: isDark ? colors.border.dark : colors.gray[300],
      },
      disabledTextColor: {
        color: isDark ? colors.gray[400] : colors.gray[500],
      },
      disabledIconColor: isDark ? colors.gray[400] : colors.gray[500],
    }),
    [isDark, primaryColor],
  )

  const checkoutBtnBg = useMemo(
    () => ({
      backgroundColor: isMissingInfo
        ? isDark
          ? colors.gray[700]
          : colors.gray[300]
        : primaryColor,
    }),
    [isMissingInfo, isDark, primaryColor],
  )

  return (
    <>
      <View
        onLayout={onLayout}
        style={[
          footerStyles.container,
          { paddingBottom: bottomInset + FOOTER_BOTTOM_EXTRA },
        ]}
      >
        <GlassSurface color={ft.containerBg} style={StyleSheet.absoluteFill} />
        {/* Total + checkout row */}
        <View style={footerStyles.bottomRow}>
          <View style={footerStyles.totalCol}>
            <Text style={[footerStyles.totalLabel, ft.mutedColor]}>
              {t('order.total')} ({itemCount})
            </Text>
            <View style={footerStyles.totalRow}>
              {voucherDiscount > 0 && (
                <Text style={[footerStyles.totalOriginal, ft.mutedColorAlt]}>
                  {formatCurrencyNative(total)}
                </Text>
              )}
              <Text style={[footerStyles.totalValue, ft.primaryColorStyle]}>
                {formatCurrencyNative(finalTotal)}
              </Text>
              {orderType === 'delivery' && (deliveryFee ?? 0) > 0 && (
                <Text style={[footerStyles.deliveryFeeNote, ft.mutedColor]}>
                  (+{formatCurrencyNative(deliveryFee ?? 0)} ship)
                </Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={handleCheckoutPress}
            onPressIn={prefetchOrderFlags}
            disabled={isChecking}
            accessibilityRole="button"
            accessibilityState={{ disabled: isChecking, busy: isChecking }}
            style={[
              footerStyles.checkoutBtn,
              checkoutBtnBg,
              isMissingInfo && footerStyles.checkoutBtnDisabled,
            ]}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={colors.white.light} />
            ) : (
              <ShoppingBag
                size={18}
                color={
                  isMissingInfo ? ft.disabledIconColor : colors.white.light
                }
              />
            )}
            <Text
              style={[
                footerStyles.checkoutText,
                isMissingInfo && ft.disabledTextColor,
              ]}
            >
              {orderBtnLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {confirmMounted && (
        <ConfirmOrderSheet
          visible={confirmSheetVisible}
          onClose={closeConfirmSheet}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}

      {orderTypeMounted && (
        <SimpleOrderTypeSheet
          visible={orderTypeSheetVisible}
          onClose={closeSheet}
          onDeliverySelected={openDeliverySheet}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}

      {tableMounted && (
        <SimpleTableSheet
          visible={tableSheetVisible}
          onClose={closeSheet}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}

      {voucherMounted && (
        <VoucherSheet
          visible={voucherSheetOpen}
          onClose={closeSheet}
          isDark={isDark}
          primaryColor={primaryColor}
          onApply={handleApplyVoucher}
        />
      )}

      {deliveryMounted && (
        <DeliveryAddressSheet
          visible={deliverySheetVisible}
          onClose={closeDeliverySheet}
          mode="cart"
          branchSlug={branchSlug}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
    </>
  )
})

const footerStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20, // overridden inline with + bottomInset
    gap: 10,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  totalCol: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 1,
  },
  totalOriginal: {
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  deliveryFeeNote: {
    fontSize: 10,
    marginTop: 1,
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 9999,
    paddingHorizontal: 20,
  },
  checkoutBtnDisabled: {
    paddingHorizontal: 14,
  },
  checkoutText: {
    color: colors.white.light,
    fontSize: 15,
    fontWeight: '700',
  },
})
