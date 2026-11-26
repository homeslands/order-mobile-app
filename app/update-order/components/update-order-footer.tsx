import { useQueryClient } from '@tanstack/react-query'
import { formatCurrencyNative } from 'cart-price-calc'
import { ChevronRight, ShoppingBag, Ticket } from 'lucide-react-native'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, View } from 'react-native'

import { colors, PHONE_NUMBER_REGEX } from '@/constants'
import { FOOTER_BOTTOM_EXTRA } from '@/constants/status-bar'
import { useUpdateOrderPayable } from '@/hooks'
import { useMountOnFirstOpen } from '@/hooks/use-mount-on-first-open'
import { tablesQueryOptions } from '@/hooks/use-table'
import { DeliveryAddressSheet, DeliveryInfoRow } from '@/components/delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { OrderStatus, OrderTypeEnum } from '@/types'
import { showErrorToastMessage } from '@/utils'
import { useEffect } from 'react'

import ConfirmUpdateOrderDialog from './confirm-update-order-dialog'
import { PickupTimeChipsInUpdateOrder } from './pickup-time-chips-in-update-order'
import { SimpleOrderTypeSheetInUpdateOrder } from './simple-order-type-sheet-in-update-order'
import { SimpleTableSheetInUpdateOrder } from './simple-table-sheet-in-update-order'
import { VoucherSheetInUpdateOrder } from './voucher-sheet-in-update-order'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Text } from '@/components/ui/text'

type UpdateOrderSheet = 'orderType' | 'table' | 'voucher' | 'delivery'

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
  // Một trạng thái "sheet đang mở" như giỏ — mỗi lúc một sheet; mở sheet mới
  // là sheet cũ đóng trong cùng một lần cập nhật
  const [sheet, setSheet] = useState<UpdateOrderSheet | null>(null)
  const orderTypeSheetVisible = sheet === 'orderType'
  const tableSheetVisible = sheet === 'table'
  const voucherSheetOpen = sheet === 'voucher'
  const deliverySheetVisible = sheet === 'delivery'
  const orderTypeMounted = useMountOnFirstOpen(orderTypeSheetVisible)
  const tableMounted = useMountOnFirstOpen(tableSheetVisible)
  const voucherMounted = useMountOnFirstOpen(voucherSheetOpen)
  const deliveryMounted = useMountOnFirstOpen(deliverySheetVisible)

  // Theo dõi từng trường — trước theo dõi cả bản nháp, gõ ghi chú đơn cũng
  // vẽ lại thanh dưới
  const orderType =
    (useOrderFlowStore((s) => s.updatingData?.updateDraft?.type) as
      | OrderTypeEnum
      | undefined) ?? OrderTypeEnum.AT_TABLE
  const selectedTableSlug =
    useOrderFlowStore((s) => s.updatingData?.updateDraft?.table) || null
  // Bản nháp đã giữ tên bàn — khỏi tải cả danh sách bàn chỉ để tra tên
  const tableName =
    useOrderFlowStore((s) => s.updatingData?.updateDraft?.tableName) || null
  const voucher = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.voucher ?? null,
  )
  const draftItems = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.orderItems,
  )
  const orderItems = useMemo(() => draftItems ?? [], [draftItems])
  const draftDeliveryAddress = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.deliveryAddress ?? '',
  )
  const draftDeliveryPhone = useOrderFlowStore(
    (s) => s.updatingData?.updateDraft?.deliveryPhone ?? '',
  )
  const isPending = useOrderFlowStore(
    (s) => s.updatingData?.originalOrder?.status === OrderStatus.PENDING,
  )
  const removeDraftVoucher = useOrderFlowStore((s) => s.removeDraftVoucher)

  const branchFromStore = useBranchStore((s) => s.branch?.slug)
  const branchFromUser = useUserStore((s) => s.userInfo?.branch?.slug)
  const branchSlug = branchFromStore || branchFromUser

  // Đơn tại bàn: tải sẵn danh sách bàn như giỏ — sheet chọn bàn mở ra có ngay
  // thay vì vòng quay (sheet chỉ tự tải khi đã mở)
  const queryClient = useQueryClient()
  useEffect(() => {
    if (orderType !== OrderTypeEnum.AT_TABLE || !branchSlug) return
    void queryClient.prefetchQuery(tablesQueryOptions(branchSlug))
  }, [orderType, branchSlug, queryClient])

  // Totals
  const cartItemQuantity = useMemo(
    () => orderItems.reduce((acc, i) => acc + (i.quantity ?? 0), 0),
    [orderItems],
  )
  // Cùng chỗ tính với sheet xác nhận
  const {
    deliveryFee: effectiveDeliveryFee,
    voucherDiscount,
    totalBeforeVoucher,
    finalTotal,
  } = useUpdateOrderPayable()

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
    orderItems.length === 0 ||
    (orderType === OrderTypeEnum.AT_TABLE && !selectedTableSlug) ||
    (orderType === OrderTypeEnum.DELIVERY &&
      (!draftDeliveryAddress ||
        !draftDeliveryPhone ||
        !/^[0-9]{10}$/.test(draftDeliveryPhone)))

  // Handlers
  // Sheet cũ báo đóng xong (onDismiss) sau khi sheet mới đã mở — chỉ xoá khi
  // đang mở đúng sheet đó, kẻo đóng nhầm sheet mới
  const closeSheet = useCallback((name: UpdateOrderSheet) => {
    setSheet((cur) => (cur === name ? null : cur))
  }, [])
  const openOrderTypeSheet = useCallback(() => setSheet('orderType'), [])
  const closeOrderTypeSheet = useCallback(
    () => closeSheet('orderType'),
    [closeSheet],
  )
  const openTableSheet = useCallback(() => setSheet('table'), [])
  const closeTableSheet = useCallback(() => closeSheet('table'), [closeSheet])
  const openVoucherSheet = useCallback(() => setSheet('voucher'), [])
  const closeVoucherSheet = useCallback(
    () => closeSheet('voucher'),
    [closeSheet],
  )
  const openDeliverySheet = useCallback(() => setSheet('delivery'), [])
  const closeDeliverySheet = useCallback(() => {
    closeSheet('delivery')
    const s = useOrderFlowStore.getState()
    const addr = s.updatingData?.updateDraft?.deliveryAddress ?? ''
    const phone = s.updatingData?.updateDraft?.deliveryPhone ?? ''
    if (addr && !PHONE_NUMBER_REGEX.test(phone)) {
      s.clearDraftDeliveryInfo()
    }
  }, [closeSheet])

  // Memoised theme-dependent styles
  const ft = useMemo(
    () => ({
      containerBg: isDark ? colors.card.dark : colors.white.light,
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
          { paddingBottom: insetBottom + FOOTER_BOTTOM_EXTRA },
        ]}
      >
        <GlassSurface color={ft.containerBg} style={StyleSheet.absoluteFill} />
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
                  {formatCurrencyNative(totalBeforeVoucher)}
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

      {/* Mỗi sheet chỉ dựng khi mở lần đầu — dựng sẵn cả 4 (kèm query cấu
          hình giao hàng, danh sách voucher) là việc thừa lúc vào màn */}
      {orderTypeMounted && (
        <SimpleOrderTypeSheetInUpdateOrder
          visible={orderTypeSheetVisible}
          onClose={closeOrderTypeSheet}
          onDeliverySelected={openDeliverySheet}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
      {tableMounted && (
        <SimpleTableSheetInUpdateOrder
          visible={tableSheetVisible}
          onClose={closeTableSheet}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
      {voucherMounted && (
        <VoucherSheetInUpdateOrder
          visible={voucherSheetOpen}
          onClose={closeVoucherSheet}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
      {deliveryMounted && (
        <DeliveryAddressSheet
          visible={deliverySheetVisible}
          onClose={closeDeliverySheet}
          mode="update-order"
          branchSlug={branchSlug ?? ''}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
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
