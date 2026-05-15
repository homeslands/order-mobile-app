import { formatCurrencyNative } from 'cart-price-calc'
import { ChevronRight, ShoppingBag, Ticket } from 'lucide-react-native'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { colors, PHONE_NUMBER_REGEX } from '@/constants'
import { FOOTER_BOTTOM_EXTRA } from '@/constants/status-bar'
import { useTables, useUpdateOrderTotals } from '@/hooks'
import { useCalculateDeliveryFee } from '@/hooks/use-branch-delivery'
import { DeliveryAddressSheet, DeliveryInfoRow } from '@/components/delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { OrderStatus, OrderTypeEnum } from '@/types'
import {
  parseKm,
  showErrorToastMessage,
} from '@/utils'
import { useEffect } from 'react'

import ConfirmUpdateOrderDialog from './confirm-update-order-dialog'
import { PickupTimeChipsInUpdateOrder } from './pickup-time-chips-in-update-order'
import { SimpleOrderTypeSheetInUpdateOrder } from './simple-order-type-sheet-in-update-order'
import { SimpleTableSheetInUpdateOrder } from './simple-table-sheet-in-update-order'
import { VoucherSheetInUpdateOrder } from './voucher-sheet-in-update-order'

interface UpdateOrderFooterProps {
  orderSlug: string
  isDark: boolean
  primaryColor: string
  insetBottom: number
}

export default memo(function UpdateOrderFooter({
  orderSlug,
  isDark,
  primaryColor,
  insetBottom,
}: UpdateOrderFooterProps) {
  const { t } = useTranslation('menu')
  const [orderTypeSheetVisible, setOrderTypeSheetVisible] = useState(false)
  const [tableSheetVisible, setTableSheetVisible] = useState(false)
  const [voucherSheetOpen, setVoucherSheetOpen] = useState(false)
  const [deliverySheetVisible, setDeliverySheetVisible] = useState(false)

  const draft = useOrderFlowStore(
    useShallow((s) => s.updatingData?.updateDraft),
  )
  const originalOrder = useOrderFlowStore(
    useShallow((s) => s.updatingData?.originalOrder),
  )
  const removeDraftVoucher = useOrderFlowStore((s) => s.removeDraftVoucher)
  const orderType = (draft?.type as OrderTypeEnum) ?? OrderTypeEnum.AT_TABLE
  const selectedTableSlug = draft?.table ?? null
  const voucher = draft?.voucher ?? null
  const orderItems = useMemo(() => draft?.orderItems ?? [], [draft])
  const draftDeliveryAddress = draft?.deliveryAddress ?? ''
  const draftDeliveryPhone = draft?.deliveryPhone ?? ''
  const draftDeliveryDistance = draft?.deliveryDistance ?? 0
  const accumulatedPointsToUse = originalOrder?.accumulatedPointsToUse ?? 0

  // Resolve table name from slug
  const branchFromStore = useBranchStore((s) => s.branch?.slug)
  const branchFromUser = useUserStore((s) => s.userInfo?.branch?.slug)
  const branchSlug = branchFromStore || branchFromUser

  const { deliveryFee: newDeliveryFee } = useCalculateDeliveryFee(
    parseKm(draftDeliveryDistance) ?? 0,
    branchSlug ?? '',
    {
      enabled:
        orderType === OrderTypeEnum.DELIVERY && draftDeliveryDistance > 0,
    },
  )
  const effectiveDeliveryFee =
    orderType === OrderTypeEnum.DELIVERY && draftDeliveryDistance > 0
      ? (newDeliveryFee ?? originalOrder?.deliveryFee ?? 0)
      : (originalOrder?.deliveryFee ?? 0)
  const { data: tablesData } = useTables(branchSlug ?? undefined)
  const tableName = useMemo(() => {
    if (!selectedTableSlug || !tablesData?.result) return null
    return (
      tablesData.result.find((tb) => tb.slug === selectedTableSlug)?.name ??
      null
    )
  }, [selectedTableSlug, tablesData])

  // Totals
  const cartItemQuantity = useMemo(
    () => orderItems.reduce((acc, i) => acc + (i.quantity ?? 0), 0),
    [orderItems],
  )
  const { cartTotals } = useUpdateOrderTotals()
  const subtotal =
    (cartTotals?.subTotalBeforeDiscount ?? 0) +
    effectiveDeliveryFee -
    accumulatedPointsToUse
  const voucherDiscount = cartTotals?.voucherDiscount ?? 0
  const finalTotal =
    (cartTotals?.finalTotal ?? 0) +
    effectiveDeliveryFee -
    accumulatedPointsToUse

  // Auto-remove voucher if maxItems exceeded
  const voucherSlug = voucher?.slug
  const voucherMaxItems = voucher?.maxItems ?? 0
  useEffect(() => {
    if (!voucherSlug || !voucherMaxItems) return
    if (cartItemQuantity > voucherMaxItems) {
      removeDraftVoucher()
      showErrorToastMessage('toast.voucherMaxItemsExceeded')
    }
  }, [voucherSlug, voucherMaxItems, cartItemQuantity, removeDraftVoucher])

  // Labels
  const orderTypeLabel =
    orderType === OrderTypeEnum.TAKE_OUT
      ? t('menu.takeAway')
      : orderType === OrderTypeEnum.DELIVERY
        ? t('menu.delivery')
        : t('menu.dineIn')
  const tableLabel = tableName
    ? t('menu.tableLabel', { name: tableName })
    : t('menu.selectTable')
  const showTableSelect = orderType === OrderTypeEnum.AT_TABLE
  const confirmDisabled =
    (orderType === OrderTypeEnum.AT_TABLE && !selectedTableSlug) ||
    (orderType === OrderTypeEnum.DELIVERY &&
      (!draftDeliveryAddress ||
        !draftDeliveryPhone ||
        !/^[0-9]{10}$/.test(draftDeliveryPhone)))
  const isPending = originalOrder?.status === OrderStatus.PENDING

  // Handlers
  const openOrderTypeSheet = useCallback(
    () => setOrderTypeSheetVisible(true),
    [],
  )
  const closeOrderTypeSheet = useCallback(
    () => setOrderTypeSheetVisible(false),
    [],
  )
  const openTableSheet = useCallback(() => setTableSheetVisible(true), [])
  const closeTableSheet = useCallback(() => setTableSheetVisible(false), [])
  const openVoucherSheet = useCallback(() => setVoucherSheetOpen(true), [])
  const closeVoucherSheet = useCallback(() => setVoucherSheetOpen(false), [])
  const openDeliverySheet = useCallback(() => setDeliverySheetVisible(true), [])
  const closeDeliverySheet = useCallback(() => {
    setDeliverySheetVisible(false)
    const s = useOrderFlowStore.getState()
    const addr = s.updatingData?.updateDraft?.deliveryAddress ?? ''
    const phone = s.updatingData?.updateDraft?.deliveryPhone ?? ''
    if (addr && !PHONE_NUMBER_REGEX.test(phone)) {
      s.clearDraftDeliveryInfo()
    }
  }, [])

  // Memoised theme-dependent styles
  const ft = useMemo(
    () => ({
      containerBg: {
        backgroundColor: isDark ? colors.card.dark : colors.white.light,
      },
      selectBtnBorder: {
        borderColor: isDark ? colors.gray[700] : colors.gray[200],
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
    }),
    [isDark, primaryColor],
  )

  const tableBtnBorder = useMemo(
    () => ({
      borderColor: tableName
        ? isDark
          ? colors.gray[700]
          : colors.gray[200]
        : isDark
          ? colors.destructive.dark
          : '#fca5a5',
    }),
    [tableName, isDark],
  )

  const tableBtnTextColor = useMemo(
    () => ({
      color: tableName
        ? isDark
          ? colors.gray[50]
          : colors.gray[900]
        : isDark
          ? colors.gray[400]
          : colors.gray[500],
    }),
    [tableName, isDark],
  )

  const voucherBorderStyle = useMemo(
    () => ({
      borderColor: voucher
        ? primaryColor
        : isDark
          ? colors.gray[600]
          : colors.gray[300],
    }),
    [voucher, primaryColor, isDark],
  )

  return (
    <>
      <View
        style={[
          f.container,
          ft.containerBg,
          { paddingBottom: insetBottom + FOOTER_BOTTOM_EXTRA },
        ]}
      >
        {/* Order Type + Table row */}
        <View style={f.selectRow}>
          <Pressable
            onPress={openOrderTypeSheet}
            style={[f.selectBtn, ft.selectBtnBorder]}
          >
            <ShoppingBag size={14} color={ft.iconColor} />
            <Text
              style={[f.selectBtnText, ft.selectBtnTextColor]}
              numberOfLines={1}
            >
              {orderTypeLabel}
            </Text>
          </Pressable>
          {showTableSelect && (
            <Pressable
              onPress={openTableSheet}
              style={[f.selectBtn, tableBtnBorder]}
            >
              <Text
                style={[f.selectBtnText, tableBtnTextColor]}
                numberOfLines={1}
              >
                {tableLabel}
              </Text>
              <ChevronRight size={14} color={ft.iconColor} />
            </Pressable>
          )}
        </View>

        {orderType === OrderTypeEnum.DELIVERY && (
          <DeliveryInfoRow
            address={draftDeliveryAddress}
            phone={draftDeliveryPhone}
            onPress={openDeliverySheet}
            isDark={isDark}
          />
        )}

        {/* Pickup Time Chips — tự ẩn khi không phải TAKE_OUT */}
        <PickupTimeChipsInUpdateOrder
          isDark={isDark}
          primaryColor={primaryColor}
        />

        {/* Voucher trigger */}
        <Pressable
          onPress={openVoucherSheet}
          style={[f.voucherTrigger, voucherBorderStyle]}
        >
          <Ticket size={14} color={ft.chevronColor} />
          <Text style={[f.voucherLabel, f.voucherLabelFlex, ft.mutedColor]}>
            {t('menu.voucher')}
          </Text>
          {voucher && (
            <View style={f.voucherRight}>
              {voucherDiscount > 0 && (
                <View style={[f.discountBadge, ft.primaryBorderStyle]}>
                  <Text style={[f.discountBadgeText, ft.primaryColorStyle]}>
                    -{formatCurrencyNative(voucherDiscount)}
                  </Text>
                </View>
              )}
              <Text
                style={[f.voucherName, ft.primaryColorStyle]}
                numberOfLines={1}
              >
                {voucher.title}
              </Text>
            </View>
          )}
          <ChevronRight size={16} color={ft.chevronColor} />
        </Pressable>

        {/* Total + confirm row */}
        <View style={f.bottomRow}>
          <View style={f.totalCol}>
            <Text style={[f.totalLabel, ft.mutedColor]}>
              {t('order.total')}: {cartItemQuantity}
            </Text>
            <View style={f.totalRow}>
              {voucherDiscount > 0 && (
                <Text style={[f.totalOriginal, ft.mutedColorAlt]}>
                  {formatCurrencyNative(subtotal)}
                </Text>
              )}
              <Text style={[f.totalValue, ft.primaryColorStyle]}>
                {formatCurrencyNative(finalTotal)}
              </Text>
              {orderType === OrderTypeEnum.DELIVERY &&
                effectiveDeliveryFee > 0 && (
                  <Text style={[f.deliveryFeeNote, ft.mutedColor]}>
                    (+{formatCurrencyNative(effectiveDeliveryFee)} ship)
                  </Text>
                )}
            </View>
          </View>
          {isPending && (
            <ConfirmUpdateOrderDialog
              orderSlug={orderSlug}
              disabled={confirmDisabled}
            />
          )}
        </View>
      </View>

      <SimpleOrderTypeSheetInUpdateOrder
        visible={orderTypeSheetVisible}
        onClose={closeOrderTypeSheet}
        onDeliverySelected={openDeliverySheet}
        isDark={isDark}
        primaryColor={primaryColor}
      />
      <SimpleTableSheetInUpdateOrder
        visible={tableSheetVisible}
        onClose={closeTableSheet}
        isDark={isDark}
        primaryColor={primaryColor}
      />
      <VoucherSheetInUpdateOrder
        visible={voucherSheetOpen}
        onClose={closeVoucherSheet}
        isDark={isDark}
        primaryColor={primaryColor}
      />

      <DeliveryAddressSheet
        visible={deliverySheetVisible}
        onClose={closeDeliverySheet}
        mode="update-order"
        branchSlug={branchSlug ?? ''}
        isDark={isDark}
        primaryColor={primaryColor}
      />
    </>
  )
})

const f = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 10,
  },
  selectRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectBtnText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  voucherTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  voucherLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  voucherLabelFlex: { flex: 1 },
  voucherRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  voucherName: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
  },
  discountBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  totalCol: { flex: 1 },
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
})
