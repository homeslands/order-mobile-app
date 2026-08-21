import { VoucherConditionModal } from '@/components/cart/voucher-condition-modal'
import {
  deriveScanStatus,
  type ScanStatus,
} from '@/components/sheet/scan-status'
import { VoucherQrScanner } from '@/components/scan/voucher-qr-scanner'
import { processVoucherList } from '@/components/sheet/voucher-validation'
import { colors } from '@/constants'
import {
  usePublicVouchersForOrder,
  useSpecificPublicVoucher,
  useSpecificVoucher,
  useUpdateOrderTotals,
  useValidatePublicVoucher,
  useValidateVoucher,
  useVouchersForOrder,
} from '@/hooks'
import { useOrderFlowStore, useUserStore } from '@/stores'
import type { IOrderItem, IVoucher } from '@/types'
import { showToast } from '@/utils'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, StyleSheet } from 'react-native'
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

export const VoucherSheetInUpdateOrder = memo(
  function VoucherSheetInUpdateOrder({
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

    const orderItems = useMemo(
      () => updatingData?.updateDraft?.orderItems ?? [],
      [updatingData],
    )
    const currentVoucher = updatingData?.updateDraft?.voucher ?? null

    const { cartTotals } = useUpdateOrderTotals()
    const subTotal = cartTotals?.subTotalBeforeDiscount ?? 0

    // ── Auth ──────────────────────────────────────────────────────────────────
    const userInfo = useUserStore((s) => s.userInfo)
    const userSlug = userInfo?.slug
    // Customer-only app: any logged-in user with a real phone is a customer.
    // Role must NOT be used — role.name is not loaded right after the first
    // register+login, which silently hid the personal voucher list.
    const isCustomerOwner =
      !!userInfo && userInfo.phonenumber !== 'default-customer'

    // ── Local state ───────────────────────────────────────────────────────────
    const { t: tVoucher } = useTranslation('voucher')

    const [code, setCode] = useState('')
    const [searchCode, setSearchCode] = useState('')
    const [scanning, setScanning] = useState(false)
    /**
     * Slug đến từ camera. Tách hẳn khỏi searchCode vì hai đường tra cứu bằng
     * hai tham số khác nhau: camera đọc ra slug, ô nhập tay nhận code.
     */
    const [scannedSlug, setScannedSlug] = useState<string | null>(null)
    /** Lỗi khi server từ chối lúc tự áp — deriveScanStatus không biết việc này. */
    const [applyError, setApplyError] = useState<string | null>(null)
    const [selectedVoucher, setSelectedVoucher] = useState<IVoucher | null>(
      null,
    )
    const [conditionVoucher, setConditionVoucher] = useState<IVoucher | null>(
      null,
    )
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
    const specificFetch = isCustomerOwner
      ? useSpecificVoucher
      : useSpecificPublicVoucher
    // QR chứa slug, ô nhập tay nhận code — `/voucher/specific` tra bằng hai
    // tham số khác nhau, truyền nhầm là 404. Nguồn quyết định tham số.
    const specificParams = useMemo(
      () => (scannedSlug ? { slug: scannedSlug } : { code: searchCode }),
      [scannedSlug, searchCode],
    )
    const { data: specificRes, isFetching } = specificFetch(
      specificParams,
      visible && (!!scannedSlug || searchCode.length > 0),
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
        voucherRequestParams
          ? { ...voucherRequestParams, page: currentPage }
          : undefined,
      [voucherRequestParams, currentPage],
    )

    const listFetch = isCustomerOwner
      ? useVouchersForOrder
      : usePublicVouchersForOrder
    const { data: eligibleRes, isLoading: isLoadingList } = listFetch(
      paginatedParams,
      visible && orderItems.length > 0,
    )

    const hasMore = eligibleRes?.result?.hasNext ?? false

    const prevPageRef = useRef(0)
    useEffect(() => {
      if (
        !eligibleRes?.result?.items ||
        eligibleRes.result.page === prevPageRef.current
      )
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
    }, [
      fetchedVoucher,
      cartProductSlugs,
      subTotal,
      userSlug,
      isCustomerOwner,
      tVoucher,
    ])

    const processed = useMemo(
      () =>
        processVoucherList(allVouchers, {
          cartProductSlugs,
          subTotalAfterPromotion: subTotal,
          userSlug,
          isCustomerOwner,
          t: tVoucher,
        }),
      [
        allVouchers,
        cartProductSlugs,
        subTotal,
        userSlug,
        isCustomerOwner,
        tVoucher,
      ],
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
      () => ({
        backgroundColor: isDark ? colors.card.dark : colors.white.light,
      }),
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
      setScanning(false)
      onClose()
    }, [onClose])

    const handleSearch = useCallback(() => {
      const trimmed = code.trim()
      if (!trimmed) return
      setSearchCode(trimmed)
    }, [code])

    const handleOpenScanner = useCallback(() => {
      Keyboard.dismiss()
      setScanning(true)
    }, [])
    // Đóng camera là bỏ luôn kết quả quét: slug không đổ vào ô nhập được
    // (ô đó tra bằng code), nên không có chỗ nào giữ lại nó.
    const handleCloseScanner = useCallback(() => {
      setScanning(false)
      setScannedSlug(null)
      setApplyError(null)
    }, [])

    const handleScanRetry = useCallback(() => {
      setApplyError(null)
      setScannedSlug(null)
      setCode('')
      setSearchCode('')
    }, [])

    // Mã quét được đi vào đúng state mà ô nhập tay dùng — từ đây trở đi luồng
    // tra cứu và chấm điều kiện chạy y hệt trường hợp khách gõ mã.
    // Không đổ slug vào ô nhập: ô đó tra bằng code, gõ slug vào sẽ 404.
    const handleScannedCode = useCallback((slug: string) => {
      setApplyError(null)
      setScannedSlug(slug)
    }, [])

    const handleViewCondition = useCallback((v: IVoucher) => {
      setConditionVoucher(v)
    }, [])

    /**
     * Xác nhận với máy chủ rồi ghi voucher vào bản nháp. Dùng chung cho nút
     * "Áp dụng" ở footer lẫn nhánh tự áp sau khi quét.
     */
    const runApplyVoucher = useCallback(
      (voucher: IVoucher, onServerError?: (message: string) => void) => {
        setValidating(true)
        validateVoucher(
          {
            voucher: voucher.slug,
            user: userSlug || '',
            orderItems: orderItems.map((item: IOrderItem) => ({
              quantity: item.quantity,
              variant: item.variant?.slug ?? '',
              note: item.note || '',
              promotion:
                (item.promotionValue ?? 0) > 0
                  ? (item.promotion?.slug ?? '')
                  : null,
              order: null,
            })),
          },
          {
            onSuccess: () => {
              setScanning(false)
              setDraftVoucher(voucher)
              showToast(tVoucher('applyVoucher'))
              sheetRef.current?.dismiss()
            },
            onError: () => {
              // Hai ngữ cảnh khác nhau: trong camera thì báo tại chỗ, ngoài
              // camera thì toast — nên hai câu chữ cũng khác nhau.
              if (onServerError) onServerError(tVoucher('scan.applyFailed'))
              else showToast(tVoucher('voucherInvalid'), 'error')
            },
            onSettled: () => setValidating(false),
          },
        )
      },
      [validateVoucher, setDraftVoucher, orderItems, userSlug, tVoucher],
    )

    const handleFooterPress = useCallback(() => {
      if (isCurrentApplied) {
        removeDraftVoucher()
        showToast(tVoucher('voucherRemoved'))
        sheetRef.current?.dismiss()
      } else if (selectedVoucher) {
        runApplyVoucher(selectedVoucher)
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
      tVoucher,
    ])

    // ─── Trạng thái màn quét ──────────────────────────────────────────────────
    const scanStatus = useMemo<ScanStatus>(() => {
      if (applyError) return { kind: 'error', title: applyError }
      return deriveScanStatus({
        scannedValue: scannedSlug,
        isFetching,
        fetchedVoucher,
        processed: processedFetched,
        currentVoucher,
        t: tVoucher,
      })
    }, [
      applyError,
      scannedSlug,
      isFetching,
      fetchedVoucher,
      processedFetched,
      currentVoucher,
      tVoucher,
    ])

    // Chốt theo slug để một lần quét chỉ gọi mutation đúng một lần.
    const autoAppliedRef = useRef<string | null>(null)
    useEffect(() => {
      if (!scanning) {
        autoAppliedRef.current = null
        return
      }
      if (scanStatus.kind !== 'ready') return
      if (autoAppliedRef.current === scanStatus.voucher.slug) return
      autoAppliedRef.current = scanStatus.voucher.slug
      runApplyVoucher(scanStatus.voucher, setApplyError)
    }, [scanning, scanStatus, runApplyVoucher])

    const handleConfirmReplace = useCallback(() => {
      if (scanStatus.kind !== 'confirmReplace') return
      runApplyVoucher(scanStatus.voucher, setApplyError)
    }, [scanStatus, runApplyVoucher])

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
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          android_keyboardInputMode="adjustResize"
        >
          <SearchHeader
            code={code}
            onChangeCode={setCode}
            onSearch={handleSearch}
            onScanPress={handleOpenScanner}
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

          <VoucherQrScanner
            visible={scanning}
            status={scanStatus}
            onScanned={handleScannedCode}
            onRetry={handleScanRetry}
            onConfirmReplace={handleConfirmReplace}
            onClose={handleCloseScanner}
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
  },
)

const styles = StyleSheet.create({
  scrollView: { paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 24 },
})
