import { VoucherConditionModal } from '@/components/cart/voucher-condition-modal'
import { processVoucherList } from '@/components/sheet/voucher-validation'
import { colors, PaymentMethod, Role } from '@/constants'
import {
  usePublicVouchersForOrder,
  useSpecificPublicVoucher,
  useSpecificVoucher,
  useUpdatePublicVoucherInOrder,
  useUpdateVoucherInOrder,
  useValidatePublicVoucher,
  useValidateVoucher,
  useVouchersForOrder,
} from '@/hooks'
import { useUserStore } from '@/stores'
import type { IOrder, IVoucher } from '@/types'
import { calculateOrderDisplayAndTotals, showErrorToastMessage, showToast } from '@/utils'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { InvalidList } from '../update-order/components/voucher-sheet-in-update-order/invalid-list'
import { SearchHeader } from '../update-order/components/voucher-sheet-in-update-order/search-header'
import { SearchResult } from '../update-order/components/voucher-sheet-in-update-order/search-result'
import { SheetFooter } from '../update-order/components/voucher-sheet-in-update-order/sheet-footer'
import { ValidList } from '../update-order/components/voucher-sheet-in-update-order/valid-list'

const SNAP = ['90%']
const MAX_VOUCHERS = 50

/** Server trả về variant/promotion có thể là string slug hoặc full object */
function toSlug(value: { slug?: string } | string | null | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  return value.slug ?? ''
}

interface VoucherSheetInPaymentProps {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
  order: IOrder
  currentPaymentMethod: PaymentMethod | null
  onVoucherApplied: () => void
  onVoucherRemoved: () => void
}

export const VoucherSheetInPayment = memo(function VoucherSheetInPayment({
  visible,
  onClose,
  isDark,
  primaryColor,
  order,
  currentPaymentMethod,
  onVoucherApplied,
  onVoucherRemoved,
}: VoucherSheetInPaymentProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const insets = useSafeAreaInsets()

  // ── Auth ──────────────────────────────────────────────────────────────────
  const userInfo = useUserStore((s) => s.userInfo)
  const userSlug = userInfo?.slug
  const isCustomerOwner =
    !!userInfo &&
    userInfo.role?.name === Role.CUSTOMER &&
    userInfo.phonenumber !== 'default-customer'

  // ── Data from order ───────────────────────────────────────────────────────
  const orderSlug = order.slug
  const orderItems = useMemo(() => order.orderItems ?? [], [order.orderItems])
  const currentVoucher = order.voucher ?? null

  // Use subTotalBeforeDiscount (pre-promotion, pre-voucher) — same as update-order sheet
  const subTotal = useMemo(() => {
    const { cartTotals } = calculateOrderDisplayAndTotals(orderItems, currentVoucher)
    return cartTotals?.subTotalBeforeDiscount ?? order.originalSubtotal ?? 0
  }, [orderItems, currentVoucher, order.originalSubtotal])

  // ── Local state ───────────────────────────────────────────────────────────
  const { t: tVoucher } = useTranslation('voucher')

  const [code, setCode] = useState('')
  const [searchCode, setSearchCode] = useState('')
  const [selectedVoucher, setSelectedVoucher] = useState<IVoucher | null>(null)
  const [conditionVoucher, setConditionVoucher] = useState<IVoucher | null>(null)
  const [_validating, setValidating] = useState(false)

  // Pre-fill when sheet opens
  const prevVisible = useRef(false)
  useEffect(() => {
    if (visible && !prevVisible.current && currentVoucher) {
      setCode(currentVoucher.code)
      setSearchCode(currentVoucher.code)
      setSelectedVoucher(currentVoucher)
    }
    prevVisible.current = visible
  }, [visible, currentVoucher])

  // ── Validate ──────────────────────────────────────────────────────────────
  const { mutate: validatePrivate } = useValidateVoucher()
  const { mutate: validatePublic } = useValidatePublicVoucher()
  const validateVoucher = isCustomerOwner ? validatePrivate : validatePublic

  // ── Update voucher on order ───────────────────────────────────────────────
  const { mutate: updateVoucherAuth } = useUpdateVoucherInOrder()
  const { mutate: updateVoucherPublic } = useUpdatePublicVoucherInOrder()
  const updateVoucher = isCustomerOwner ? updateVoucherAuth : updateVoucherPublic

  // ── Fetch by code ─────────────────────────────────────────────────────────
  const specificFetch = isCustomerOwner ? useSpecificVoucher : useSpecificPublicVoucher
  const { data: specificRes, isFetching } = specificFetch(
    { code: searchCode },
    visible && searchCode.length > 0,
  )
  const fetchedVoucher = specificRes?.result ?? null

  // ── Eligible list ─────────────────────────────────────────────────────────
  const listRequestItems = useMemo(
    () =>
      orderItems.map((item) => ({
        quantity: item.quantity,
        variant: toSlug(item.variant),
        promotion: toSlug(item.promotion),
        order: orderSlug,
      })),
    [orderItems, orderSlug],
  )

  const voucherRequestParams = useMemo(
    () =>
      visible
        ? {
            hasPaging: true,
            page: 1,
            size: 10,
            minOrderValue: subTotal,
            orderItems: listRequestItems,
            ...(isCustomerOwner && userSlug ? { user: userSlug } : {}),
            ...(currentPaymentMethod ? { paymentMethod: currentPaymentMethod } : {}),
          }
        : undefined,
    [visible, subTotal, listRequestItems, isCustomerOwner, userSlug, currentPaymentMethod],
  )

  const [currentPage, setCurrentPage] = useState(1)
  const [allVouchers, setAllVouchers] = useState<IVoucher[]>([])

  const paginatedParams = useMemo(
    () =>
      voucherRequestParams ? { ...voucherRequestParams, page: currentPage } : undefined,
    [voucherRequestParams, currentPage],
  )

  const listFetch = isCustomerOwner ? useVouchersForOrder : usePublicVouchersForOrder
  const { data: eligibleRes, isLoading: isLoadingList } = listFetch(
    paginatedParams,
    visible && orderItems.length > 0,
  )

  const hasMore = eligibleRes?.result?.hasNext ?? false

  const prevPageRef = useRef(0)
  useEffect(() => {
    if (!eligibleRes?.result?.items || eligibleRes.result.page === prevPageRef.current)
      return
    prevPageRef.current = eligibleRes.result.page
    if (currentPage === 1) {
      setAllVouchers(eligibleRes.result.items)
    } else {
      setAllVouchers((prev) => {
        const slugs = new Set(prev.map((v) => v.slug))
        const newItems = eligibleRes.result!.items.filter(
          (v: IVoucher) => !slugs.has(v.slug),
        )
        return [...prev, ...newItems].slice(0, MAX_VOUCHERS)
      })
    }
  }, [eligibleRes?.result, currentPage])

  // Reset on reopen
  const prevVisibleForPage = useRef(false)
  useEffect(() => {
    if (visible && !prevVisibleForPage.current) {
      setCurrentPage(1)
      prevPageRef.current = 0
      const cachedItems = eligibleRes?.result?.items
      if (cachedItems && cachedItems.length > 0) {
        setAllVouchers(cachedItems)
      } else {
        setAllVouchers([])
      }
    }
    prevVisibleForPage.current = visible
  }, [visible, eligibleRes?.result?.items])

  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingList && allVouchers.length < MAX_VOUCHERS)
      setCurrentPage((p) => p + 1)
  }, [hasMore, isLoadingList, allVouchers.length])

  // ── Process voucher list ───────────────────────────────────────────────────
  // IOrderDetail has no productSlug field — product slug is at variant.product.slug
  const cartProductSlugs = useMemo(
    () =>
      orderItems
        .map((i) => i.variant?.product?.slug ?? '')
        .filter(Boolean),
    [orderItems],
  )

  const { processedFetched, validVouchers, invalidVouchers } = useMemo(() => {
    const opts = {
      cartProductSlugs,
      subTotalAfterPromotion: subTotal,
      userSlug,
      isCustomerOwner,
      t: tVoucher,
    }
    const pFetched = fetchedVoucher
      ? (processVoucherList([fetchedVoucher], opts)[0] ?? null)
      : null
    const valid: ReturnType<typeof processVoucherList> = []
    const invalid: ReturnType<typeof processVoucherList> = []
    for (const p of processVoucherList(allVouchers, opts)) {
      ;(p.isValid ? valid : invalid).push(p)
    }
    return { processedFetched: pFetched, validVouchers: valid, invalidVouchers: invalid }
  }, [fetchedVoucher, allVouchers, cartProductSlugs, subTotal, userSlug, isCustomerOwner, tVoucher])

  // ── Selection ─────────────────────────────────────────────────────────────
  const allAvailable = useMemo(() => {
    const list = [...allVouchers]
    if (fetchedVoucher && !list.some((v) => v.slug === fetchedVoucher.slug)) {
      list.unshift(fetchedVoucher)
    }
    return list
  }, [allVouchers, fetchedVoucher])

  const handleSelectBySlug = useCallback(
    (slug: string) => {
      setSelectedVoucher((prev) => {
        if (prev?.slug === slug) return null
        return allAvailable.find((v) => v.slug === slug) ?? null
      })
    },
    [allAvailable],
  )

  const isCurrentApplied =
    selectedVoucher?.slug === currentVoucher?.slug && !!currentVoucher
  const isNewSelection = !!selectedVoucher && !isCurrentApplied

  // ── Sheet callbacks ───────────────────────────────────────────────────────
  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )
  const indicatorStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }),
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
    if (visible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [visible])

  const handleDismiss = useCallback(() => {
    setCode('')
    setSearchCode('')
    setSelectedVoucher(null)
    setConditionVoucher(null)
    onClose()
  }, [onClose])

  const handleSearch = useCallback(() => {
    const trimmed = code.trim()
    if (!trimmed) return
    setSearchCode(trimmed)
  }, [code])

  const handleViewCondition = useCallback((v: IVoucher) => {
    setConditionVoucher(v)
  }, [])

  const handleCloseConditionModal = useCallback(() => setConditionVoucher(null), [])

  const orderItemsParam = useMemo(
    () =>
      orderItems.map((item) => ({
        quantity: item.quantity,
        variant: toSlug(item.variant),
        promotion: toSlug(item.promotion),
        order: orderSlug,
      })),
    [orderItems, orderSlug],
  )

  const handleFooterPress = useCallback(() => {
    if (isCurrentApplied) {
      // Remove voucher
      updateVoucher(
        { slug: orderSlug, voucher: null, orderItems: orderItemsParam },
        {
          onSuccess: () => {
            showToast('Đã gỡ mã giảm giá')
            sheetRef.current?.dismiss()
            onVoucherRemoved()
          },
          onError: () => {
            showErrorToastMessage('Không thể gỡ voucher')
          },
        },
      )
    } else if (selectedVoucher) {
      setValidating(true)
      validateVoucher(
        {
          voucher: selectedVoucher.slug,
          user: userSlug || '',
          orderItems: orderItems.map((item) => ({
            quantity: item.quantity,
            variant: toSlug(item.variant),
            note: (item as { note?: string }).note || '',
            promotion:
              ((item as { promotionValue?: number }).promotionValue ?? 0) > 0
                ? toSlug(item.promotion)
                : null,
            order: orderSlug,
          })),
        },
        {
          onSuccess: () => {
            // Persist voucher to server
            updateVoucher(
              { slug: orderSlug, voucher: selectedVoucher.slug, orderItems: orderItemsParam },
              {
                onSuccess: () => {
                  showToast('Áp dụng mã giảm giá thành công')
                  sheetRef.current?.dismiss()
                  onVoucherApplied()
                },
                onError: () => {
                  showErrorToastMessage('Không thể áp dụng voucher')
                },
                onSettled: () => setValidating(false),
              },
            )
          },
          onError: () => {
            showToast('Voucher không hợp lệ')
            setValidating(false)
          },
        },
      )
    } else {
      sheetRef.current?.dismiss()
    }
  }, [
    isCurrentApplied,
    selectedVoucher,
    validateVoucher,
    updateVoucher,
    orderItems,
    orderItemsParam,
    orderSlug,
    userSlug,
    onVoucherApplied,
    onVoucherRemoved,
  ])

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP}
        enablePanDownToClose
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        enableDynamicSizing={false}
        activeOffsetY={[-10, 10]}
        failOffsetX={[-5, 5]}
        backdropComponent={renderBackdrop}
        backgroundStyle={bgStyle}
        handleIndicatorStyle={indicatorStyle}
        onDismiss={handleDismiss}
        android_keyboardInputMode="adjustResize"
      >
          <SearchHeader
            code={code}
            onChangeCode={setCode}
            onSearch={handleSearch}
            isDark={isDark}
            primaryColor={primaryColor}
          />

          {currentPaymentMethod && (
            <View style={[s.filterBanner, { backgroundColor: `${primaryColor}12`, borderColor: `${primaryColor}30` }]}>
              <Text style={[s.filterBannerText, { color: isDark ? colors.gray[300] : colors.gray[600] }]}>
                Hiển thị voucher tương thích với{' '}
                <Text style={{ fontWeight: '700', color: primaryColor }}>
                  {PAYMENT_METHOD_LABELS[currentPaymentMethod] ?? currentPaymentMethod}
                </Text>
              </Text>
            </View>
          )}

          <BottomSheetScrollView
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {__DEV__ && (
              <View style={[s.debugBox, { borderColor: isDark ? colors.gray[600] : colors.gray[300], backgroundColor: isDark ? colors.gray[800] : colors.gray[50] }]}>
                <Text style={[s.debugTitle, { color: isDark ? colors.gray[300] : colors.gray[600] }]}>
                  [DEV] Voucher request params
                </Text>
                <Text style={[s.debugText, { color: isDark ? colors.gray[400] : colors.gray[500] }]}>
                  subTotal: {subTotal}{'\n'}
                  paymentMethod: {currentPaymentMethod ?? 'none'}{'\n'}
                  isCustomerOwner: {String(isCustomerOwner)}{'\n'}
                  orderItems ({orderItems.length}):{'\n'}
                  {orderItems.map((i, idx) =>
                    `  [${idx}] variant=${i.variant?.slug ?? '-'} product=${i.variant?.product?.slug ?? '!'} qty=${i.quantity}`
                  ).join('\n')}
                </Text>
              </View>
            )}
            <SearchResult
              isFetching={isFetching}
              searchCode={searchCode}
              fetchedVoucher={fetchedVoucher}
              processedFetched={processedFetched}
              selectedVoucher={selectedVoucher}
              onSelect={handleSelectBySlug}
              onViewCondition={handleViewCondition}
              isDark={isDark}
              primaryColor={primaryColor}
            />
            <ValidList
              vouchers={validVouchers}
              selectedVoucher={selectedVoucher}
              onSelect={handleSelectBySlug}
              onViewCondition={handleViewCondition}
              isLoading={isLoadingList}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              isDark={isDark}
              primaryColor={primaryColor}
            />
            <InvalidList
              vouchers={invalidVouchers}
              onSelect={handleSelectBySlug}
              onViewCondition={handleViewCondition}
              isDark={isDark}
              primaryColor={primaryColor}
            />
          </BottomSheetScrollView>

          <SheetFooter
            isCurrentApplied={isCurrentApplied}
            isNewSelection={isNewSelection}
            onPress={handleFooterPress}
            isDark={isDark}
            primaryColor={primaryColor}
            bottomInset={insets.bottom}
          />
      </BottomSheetModal>

      <VoucherConditionModal
        voucher={conditionVoucher}
        onClose={handleCloseConditionModal}
        isDark={isDark}
        primaryColor={primaryColor}
        bgStyle={bgStyle}
        indicatorStyle={indicatorStyle}
        bottomInset={insets.bottom}
      />
    </>
  )
})

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản',
  [PaymentMethod.CASH]: 'Tiền mặt',
  [PaymentMethod.POINT]: 'Điểm tích lũy',
  [PaymentMethod.CREDIT_CARD]: 'Thẻ tín dụng',
}

const styles = StyleSheet.create({
  scrollView: { paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 24 },
})

const s = StyleSheet.create({
  debugBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    gap: 4,
  },
  debugTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  debugText: {
    fontSize: 10,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  filterBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterBannerText: {
    fontSize: 12,
    lineHeight: 18,
  },
})
