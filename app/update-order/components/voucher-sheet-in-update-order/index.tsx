import { VoucherConditionModal } from '@/components/cart/voucher-condition-modal'
import { processVoucherList } from '@/components/sheet/voucher-validation'
import { colors, Role } from '@/constants'
import {
  usePublicVouchersForOrder,
  useSpecificPublicVoucher,
  useSpecificVoucher,
  useValidatePublicVoucher,
  useValidateVoucher,
  useVouchersForOrder,
} from '@/hooks'
import { useOrderFlowStore, useUserStore } from '@/stores'
import type { IOrderItem, IVoucher } from '@/types'
import { calculateOrderDisplayAndTotals, showToast, transformOrderItemToOrderDetail } from '@/utils'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { InvalidList } from './invalid-list'
import { SearchHeader } from './search-header'
import { SearchResult } from './search-result'
import { SheetFooter } from './sheet-footer'
import { ValidList } from './valid-list'

const SNAP = ['90%']
const MAX_VOUCHERS = 50

interface VoucherSheetInUpdateOrderProps {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
}

export const VoucherSheetInUpdateOrder = memo(function VoucherSheetInUpdateOrder({
  visible,
  onClose,
  isDark,
  primaryColor,
}: VoucherSheetInUpdateOrderProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const insets = useSafeAreaInsets()

  // ── Store ─────────────────────────────────────────────────────────────────
  const updatingData = useOrderFlowStore((s) => s.updatingData)
  const setDraftVoucher = useOrderFlowStore((s) => s.setDraftVoucher)
  const removeDraftVoucher = useOrderFlowStore((s) => s.removeDraftVoucher)

  const orderItems = useMemo(() => updatingData?.updateDraft?.orderItems ?? [], [updatingData])
  const currentVoucher = updatingData?.updateDraft?.voucher ?? null

  const transformedItems = useMemo(
    () => transformOrderItemToOrderDetail(orderItems),
    [orderItems],
  )
  const { cartTotals } = useMemo(
    () => calculateOrderDisplayAndTotals(transformedItems, currentVoucher),
    [transformedItems, currentVoucher],
  )
  const subTotal = cartTotals?.subTotalBeforeDiscount ?? 0

  // ── Auth ──────────────────────────────────────────────────────────────────
  const userInfo = useUserStore((s) => s.userInfo)
  const userSlug = userInfo?.slug
  const isCustomerOwner =
    !!userInfo &&
    userInfo.role?.name === Role.CUSTOMER &&
    userInfo.phonenumber !== 'default-customer'

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
        variant: item.variant?.slug ?? '',
        promotion: '',
        order: '',
      })),
    [orderItems],
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
          }
        : undefined,
    [visible, subTotal, listRequestItems, isCustomerOwner, userSlug],
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
  const cartProductSlugs = useMemo(
    () =>
      orderItems
        .map((i: IOrderItem) => i.productSlug || i.slug || '')
        .filter(Boolean),
    [orderItems],
  )

  const processedFetched = useMemo(() => {
    if (!fetchedVoucher) return null
    const result = processVoucherList([fetchedVoucher], {
      cartProductSlugs,
      subTotalAfterPromotion: subTotal,
      userSlug,
      isCustomerOwner,
      t: tVoucher,
    })
    return result[0] ?? null
  }, [fetchedVoucher, cartProductSlugs, subTotal, userSlug, isCustomerOwner, tVoucher])

  const processed = useMemo(
    () =>
      processVoucherList(allVouchers, {
        cartProductSlugs,
        subTotalAfterPromotion: subTotal,
        userSlug,
        isCustomerOwner,
        t: tVoucher,
      }),
    [allVouchers, cartProductSlugs, subTotal, userSlug, isCustomerOwner, tVoucher],
  )

  const { validVouchers, invalidVouchers } = useMemo(() => {
    const valid: typeof processed = []
    const invalid: typeof processed = []
    for (const p of processed) (p.isValid ? valid : invalid).push(p)
    return { validVouchers: valid, invalidVouchers: invalid }
  }, [processed])

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

  const handleFooterPress = useCallback(() => {
    if (isCurrentApplied) {
      removeDraftVoucher()
      showToast('Đã gỡ mã giảm giá')
      sheetRef.current?.dismiss()
    } else if (selectedVoucher) {
      setValidating(true)
      validateVoucher(
        {
          voucher: selectedVoucher.slug,
          user: userSlug || '',
          orderItems: orderItems.map((item: IOrderItem) => ({
            quantity: item.quantity,
            variant: item.variant?.slug ?? '',
            note: item.note || '',
            promotion:
              (item.promotionValue ?? 0) > 0 ? (item.promotion?.slug ?? '') : null,
            order: null,
          })),
        },
        {
          onSuccess: () => {
            setDraftVoucher(selectedVoucher)
            showToast('Áp dụng mã giảm giá thành công')
            sheetRef.current?.dismiss()
          },
          onError: () => {
            showToast('Voucher không hợp lệ')
          },
          onSettled: () => setValidating(false),
        },
      )
    } else {
      sheetRef.current?.dismiss()
    }
  }, [
    isCurrentApplied,
    selectedVoucher,
    removeDraftVoucher,
    setDraftVoucher,
    validateVoucher,
    orderItems,
    userSlug,
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

          <BottomSheetScrollView
            contentContainerStyle={styles.scrollContent}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
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
        onClose={() => setConditionVoucher(null)}
        isDark={isDark}
        primaryColor={primaryColor}
        bgStyle={bgStyle}
        indicatorStyle={indicatorStyle}
        bottomInset={insets.bottom}
      />
    </>
  )
})

const styles = StyleSheet.create({
  scrollView: { paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 24 },
})
