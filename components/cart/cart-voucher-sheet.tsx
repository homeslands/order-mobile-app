import {
  deriveScanStatus,
  type ScanStatus,
} from '@/components/sheet/scan-status'
import { processVoucherList } from '@/components/sheet/voucher-validation'
import { VoucherQrScanner } from '@/components/scan/voucher-qr-scanner'
import { VoucherCard } from './voucher-card'
import { VoucherConditionModal } from './voucher-condition-modal'
import { colors } from '@/constants'
import {
  usePublicVouchersForOrder,
  useSpecificPublicVoucher,
  useSpecificVoucher,
  useValidatePublicVoucher,
  useValidateVoucher,
  useVouchersForOrder,
} from '@/hooks'
import { useUserStore } from '@/stores'
import {
  cartActions,
  useCartItems,
  useCartProductSlugs,
  useCartTotal,
  useCartVoucher,
} from '@/stores/cart.store'
import type { IOrderItem, IVoucher } from '@/types'
import { showToast } from '@/utils'
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import { ScanLine, Search, Ticket } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Keyboard, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '@/components/ui/text'

// ─── Voucher Sheet ───────────────────────────────────────────────────────────

const VOUCHER_SHEET_SNAP = ['90%']

/** Ref ổn định cho nhánh "sheet đang đóng" — tránh tạo mảng mới mỗi render. */
const EMPTY_PROCESSED: ReturnType<typeof processVoucherList> = []

export const VoucherSheet = memo(function VoucherSheet({
  visible,
  onClose,
  isDark,
  primaryColor,
  onApply,
}: {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
  onApply: (voucher: IVoucher) => void
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const insets = useSafeAreaInsets()
  const currentVoucher = useCartVoucher()
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
  const [selectedVoucher, setSelectedVoucher] = useState<IVoucher | null>(null)
  const [conditionVoucher, setConditionVoucher] = useState<IVoucher | null>(
    null,
  )
  const [_validating, setValidating] = useState(false)

  // Auth — switch between private/public hooks
  const userInfo = useUserStore((s) => s.userInfo)
  const userSlug = userInfo?.slug
  // Customer-only app: any logged-in user with a real phone is a customer. Role
  // can be unloaded right after first register+login, so must NOT gate on it —
  // otherwise the sheet falls back to public vouchers and shows an empty list.
  const isCustomerOwner =
    !!userInfo && userInfo.phonenumber !== 'default-customer'

  const { mutate: validatePrivate } = useValidateVoucher()
  const { mutate: validatePublic } = useValidatePublicVoucher()
  const validateVoucher = isCustomerOwner ? validatePrivate : validatePublic

  // Pre-select applied voucher when sheet opens (but don't fill input)
  const prevVisible = useRef(false)
  useEffect(() => {
    if (visible && !prevVisible.current) {
      if (currentVoucher) {
        setSelectedVoucher(currentVoucher)
      }
    }
    prevVisible.current = visible
  }, [visible, currentVoucher])

  // 2.1 — Fetch voucher by code (single hook, conditional fetch fn)
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

  // 2.3 — Fetch eligible voucher list when sheet opens
  const items = useCartItems()
  const total = useCartTotal()
  // Stable ref — only changes when products added/removed (not qty/note mutations)
  const cartProductSlugs = useCartProductSlugs()

  const { t: tVoucher } = useTranslation(['voucher'])

  // E4 — Pre-compute fetched voucher display fields
  const processedFetched = useMemo(() => {
    if (!fetchedVoucher) return null
    const result = processVoucherList([fetchedVoucher], {
      cartProductSlugs,
      subTotalAfterPromotion: total,
      userSlug,
      isCustomerOwner,
      t: tVoucher,
    })
    return result[0] ?? null
  }, [
    fetchedVoucher,
    cartProductSlugs,
    total,
    userSlug,
    isCustomerOwner,
    tVoucher,
  ])
  const listRequestItems = useMemo(
    () =>
      items.map((item) => ({
        quantity: item.quantity,
        variant: item.variant?.slug ?? '',
        promotion: '',
        order: '',
      })),
    [items],
  )

  const voucherRequestParams = useMemo(
    () =>
      visible
        ? {
            hasPaging: true,
            page: 1,
            size: 10,
            minOrderValue: total,
            orderItems: listRequestItems,
            ...(isCustomerOwner && userSlug ? { user: userSlug } : {}),
          }
        : undefined,
    [visible, total, isCustomerOwner, userSlug, listRequestItems],
  )

  // Delay enabling list query until sheet animation settles (~150ms)
  const [queryReady, setQueryReady] = useState(false)
  useEffect(() => {
    if (!visible) {
      setQueryReady(false)
      return
    }
    const t = setTimeout(() => setQueryReady(true), 150)
    return () => clearTimeout(t)
  }, [visible])

  // 4.2 — Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [allVouchers, setAllVouchers] = useState<IVoucher[]>([])

  const paginatedParams = useMemo(
    () =>
      voucherRequestParams
        ? { ...voucherRequestParams, page: currentPage }
        : undefined,
    [voucherRequestParams, currentPage],
  )

  // F5 — Single hook, conditional fetch fn
  const listFetch = isCustomerOwner
    ? useVouchersForOrder
    : usePublicVouchersForOrder
  const { data: eligibleRes, isLoading: isLoadingList } = listFetch(
    paginatedParams,
    queryReady && items.length > 0,
  )

  const hasMore = eligibleRes?.result?.hasNext ?? false

  // Accumulate pages
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
        return [...prev, ...newItems]
      })
    }
  }, [eligibleRes?.result, currentPage])

  // Reset when sheet reopens — re-populate from cached data if available
  const prevVisibleForPage = useRef(false)
  useEffect(() => {
    if (visible && !prevVisibleForPage.current) {
      setCurrentPage(1)
      prevPageRef.current = 0
      // Re-populate from cached query data instead of clearing
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
    if (hasMore && !isLoadingList) setCurrentPage((p) => p + 1)
  }, [hasMore, isLoadingList])

  // Merge applied voucher into raw list so it always appears in processed results
  const rawEligibleVouchers = useMemo(() => {
    if (
      currentVoucher &&
      !allVouchers.some((v) => v.slug === currentVoucher.slug)
    ) {
      return [currentVoucher, ...allVouchers]
    }
    return allVouchers
  }, [allVouchers, currentVoucher])

  // 3.1 + 3.2 — Classify valid/invalid + error messages
  // Sheet mount thường trực (xem CartFooter) và `allVouchers` không bị xoá khi
  // dismiss, nên nếu không gate theo `visible` thì mỗi lần giỏ đổi (qty/voucher)
  // sẽ chạy lại processVoucherList trên toàn list dù sheet đang ĐÓNG.
  const processed = useMemo(
    () =>
      visible
        ? processVoucherList(rawEligibleVouchers, {
            cartProductSlugs,
            subTotalAfterPromotion: total,
            userSlug,
            isCustomerOwner,
            t: tVoucher,
          })
        : EMPTY_PROCESSED,
    [
      visible,
      rawEligibleVouchers,
      cartProductSlugs,
      total,
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

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.card.dark : colors.white.light }),
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
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleDismiss = useCallback(() => {
    setCode('')
    setSearchCode('')
    setSelectedVoucher(null)
    setConditionVoucher(null)
    setScanning(false)
    setScannedSlug(null)
    setApplyError(null)
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

  // Mã quét được đi vào đúng state mà ô nhập tay dùng — từ đây trở đi luồng
  // tra cứu và chấm điều kiện chạy y hệt trường hợp khách gõ mã. Camera KHÔNG
  // đóng: kết quả sẽ hiện ngay trong màn quét.
  // Không đổ slug vào ô nhập: ô đó tra bằng code, gõ slug vào sẽ 404.
  const handleScannedCode = useCallback((slug: string) => {
    setApplyError(null)
    setScannedSlug(slug)
  }, [])

  const handleScanRetry = useCallback(() => {
    setApplyError(null)
    setScannedSlug(null)
    setCode('')
    setSearchCode('')
  }, [])

  // F1 — Merge fetched + current applied voucher into available pool
  const allAvailable = useMemo(() => {
    const list = [...rawEligibleVouchers]
    if (fetchedVoucher && !list.some((v) => v.slug === fetchedVoucher.slug)) {
      list.unshift(fetchedVoucher)
    }
    // Include current applied voucher so it's always selectable on reopen
    if (currentVoucher && !list.some((v) => v.slug === currentVoucher.slug)) {
      list.unshift(currentVoucher)
    }
    return list
  }, [rawEligibleVouchers, fetchedVoucher, currentVoucher])

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

  /**
   * Xác nhận với máy chủ rồi áp voucher. Dùng chung cho cả nút "Áp dụng" ở
   * footer lẫn nhánh tự áp sau khi quét, để hai đường đi qua đúng một luật.
   *
   * `onServerError` cho phép nhánh quét hiện lỗi ngay trong camera thay vì
   * bắn toast rồi để khách nhìn một màn quét trống.
   */
  const runApplyVoucher = useCallback(
    (voucher: IVoucher, onServerError?: (message: string) => void) => {
      setValidating(true)
      validateVoucher(
        {
          voucher: voucher.slug,
          user: userSlug || '',
          orderItems: items.map((item: IOrderItem) => ({
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
            onApply(voucher)
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
    [validateVoucher, userSlug, items, onApply, tVoucher],
  )

  const handleFooterPress = useCallback(() => {
    if (isCurrentApplied) {
      cartActions.setVoucher(null)
      showToast(tVoucher('voucherRemoved'))
      sheetRef.current?.dismiss()
    } else if (selectedVoucher) {
      runApplyVoucher(selectedVoucher)
    } else {
      sheetRef.current?.dismiss()
    }
  }, [selectedVoucher, isCurrentApplied, runApplyVoucher, tVoucher])

  // ─── Trạng thái màn quét ────────────────────────────────────────────────────
  // Luật nằm trong deriveScanStatus (hàm thuần, dùng chung cho cả ba sheet);
  // applyError chỉ chồng lên khi máy chủ từ chối ở bước xác nhận cuối.
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

  // Tự áp khi mã hợp lệ và không vướng gì. Chốt theo slug để một lần quét chỉ
  // gọi mutation đúng một lần, dù status có tính lại vì lý do khác.
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

  const handleViewCondition = useCallback((v: IVoucher) => {
    setConditionVoucher(v)
  }, [])

  const handleCloseConditionModal = useCallback(
    () => setConditionVoucher(null),
    [],
  )

  // ─── Footer component pinned at bottom via BottomSheetFooter ────────────────
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      // BottomSheetFooter render như sibling NẰM TRÊN content container, nên
      // lớp phủ camera (absolute bên trong content) không che được nút này —
      // phải ẩn hẳn footer khi đang quét, không thì nút "Áp dụng" nổi trên
      // hình camera đang chạy.
      if (scanning) return null
      return (
        // Không dùng bottomInset: nó nhấc cả footer lên khỏi mép dưới, để hở
        // nền sheet bên dưới nên footer trông như đang nổi. Thay vào đó cộng
        // safe-area vào padding của chính footer, để nền chạy sát mép màn hình.
        <BottomSheetFooter {...props}>
          <View
            style={[
              voucherSheetStyles.footer,
              {
                paddingBottom: insets.bottom + 16,
                backgroundColor: isDark ? colors.card.dark : colors.white.light,
                borderTopColor: isDark ? colors.border.dark : colors.gray[200],
              },
            ]}
          >
            <Pressable
              onPress={handleFooterPress}
              style={[
                voucherSheetStyles.footerBtn,
                {
                  backgroundColor: isCurrentApplied
                    ? colors.destructive.light
                    : isNewSelection
                      ? primaryColor
                      : isDark
                        ? colors.border.dark
                        : colors.gray[200],
                },
              ]}
            >
              <Text
                style={[
                  voucherSheetStyles.footerBtnText,
                  {
                    color:
                      isCurrentApplied || isNewSelection
                        ? colors.white.light
                        : isDark
                          ? colors.gray[300]
                          : colors.gray[600],
                  },
                ]}
              >
                {isCurrentApplied
                  ? tVoucher('removeVoucher')
                  : isNewSelection
                    ? tVoucher('apply')
                    : tVoucher('close')}
              </Text>
            </Pressable>
          </View>
        </BottomSheetFooter>
      )
    },
    [
      isDark,
      primaryColor,
      isCurrentApplied,
      isNewSelection,
      handleFooterPress,
      insets.bottom,
      tVoucher,
      scanning,
    ],
  )

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={VOUCHER_SHEET_SNAP}
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
        footerComponent={renderFooter}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {/* Fixed header */}
        <View
          style={[
            voucherSheetStyles.fixedHeader,
            {
              borderBottomColor: isDark ? colors.border.dark : colors.gray[200],
            },
          ]}
        >
          <Text
            style={[
              voucherSheetStyles.title,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
          >
            {tVoucher('code')}
          </Text>

          <View style={voucherSheetStyles.inputRow}>
            <View
              style={[
                voucherSheetStyles.inputWrap,
                {
                  backgroundColor: isDark
                    ? colors.background.dark
                    : colors.gray[100],
                  borderColor: isDark ? colors.border.dark : colors.gray[300],
                },
              ]}
            >
              <Ticket
                size={20}
                color={isDark ? colors.gray[400] : colors.gray[500]}
              />
              <BottomSheetTextInput
                value={code}
                onChangeText={setCode}
                placeholder={tVoucher('enterCode')}
                placeholderTextColor={
                  isDark ? colors.gray[600] : colors.gray[400]
                }
                autoCapitalize="sentences"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSearch}
                style={[
                  voucherSheetStyles.input,
                  { color: isDark ? colors.gray[50] : colors.gray[900] },
                ]}
              />
            </View>
            <Pressable
              onPress={handleSearch}
              disabled={!code.trim()}
              style={[
                voucherSheetStyles.searchBtn,
                {
                  backgroundColor: code.trim()
                    ? primaryColor
                    : isDark
                      ? colors.border.dark
                      : colors.gray[200],
                },
              ]}
            >
              <Search
                size={18}
                color={
                  code.trim()
                    ? colors.white.light
                    : isDark
                      ? colors.gray[500]
                      : colors.gray[400]
                }
              />
            </Pressable>
            <Pressable
              onPress={handleOpenScanner}
              style={[
                voucherSheetStyles.scanBtn,
                {
                  backgroundColor: isDark
                    ? colors.background.dark
                    : colors.gray[100],
                  borderColor: isDark ? colors.border.dark : colors.gray[300],
                },
              ]}
              accessibilityLabel={tVoucher('scan.title')}
            >
              <ScanLine size={18} color={primaryColor} />
            </Pressable>
          </View>
          {currentVoucher ? (
            <View style={voucherSheetStyles.appliedRow}>
              <Ticket size={14} color={primaryColor} />
              <Text
                style={[
                  voucherSheetStyles.appliedText,
                  { color: primaryColor },
                ]}
                numberOfLines={1}
              >
                {tVoucher('currentlyUsing', {
                  title: currentVoucher.title,
                })}
              </Text>
            </View>
          ) : (
            <Text
              style={[
                voucherSheetStyles.note,
                { color: isDark ? colors.gray[400] : colors.gray[500] },
              ]}
            >
              {tVoucher('maxOnePerOrder')}
            </Text>
          )}
        </View>

        {/* Scrollable voucher list */}
        <BottomSheetScrollView
          style={voucherSheetStyles.scrollView}
          contentContainerStyle={voucherSheetStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Search result area */}
          {isFetching && searchCode.length > 0 && (
            <View style={voucherSheetStyles.resultRow}>
              <Text
                style={{
                  color: isDark ? colors.gray[400] : colors.gray[500],
                  fontSize: 13,
                }}
              >
                {tVoucher('searching')}
              </Text>
            </View>
          )}
          {!isFetching && searchCode.length > 0 && !fetchedVoucher && (
            <View style={voucherSheetStyles.resultRow}>
              <Text style={{ color: colors.destructive.light, fontSize: 13 }}>
                {tVoucher('codeNotFound', { code: searchCode })}
              </Text>
            </View>
          )}
          {!isFetching && fetchedVoucher && processedFetched && (
            <VoucherCard
              voucher={processedFetched.voucher}
              isSelected={
                selectedVoucher?.slug === processedFetched.voucher.slug
              }
              primaryColor={primaryColor}
              isDark={isDark}
              onSelect={handleSelectBySlug}
              onViewCondition={handleViewCondition}
              discountLabel={processedFetched.discountLabel}
              expiryText={processedFetched.expiryText}
              minOrderText={processedFetched.minOrderText}
              usagePercent={processedFetched.usagePercent}
            />
          )}

          {/* Valid vouchers */}
          {validVouchers.length > 0 && (
            <>
              <View style={voucherSheetStyles.listHeader}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? colors.gray[50] : colors.gray[900],
                  }}
                >
                  {tVoucher('availableVouchers')}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.gray[400] : colors.gray[500],
                  }}
                >
                  {tVoucher('maxOne')}
                </Text>
              </View>
              {validVouchers.map((p) => (
                <VoucherCard
                  key={p.voucher.slug}
                  voucher={p.voucher}
                  isSelected={selectedVoucher?.slug === p.voucher.slug}
                  primaryColor={primaryColor}
                  isDark={isDark}
                  onSelect={handleSelectBySlug}
                  onViewCondition={handleViewCondition}
                  discountLabel={p.discountLabel}
                  expiryText={p.expiryText}
                  minOrderText={p.minOrderText}
                  usagePercent={p.usagePercent}
                />
              ))}
            </>
          )}

          {/* Invalid vouchers */}
          {invalidVouchers.length > 0 && (
            <>
              <View style={voucherSheetStyles.listHeader}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? colors.gray[400] : colors.gray[500],
                  }}
                >
                  {tVoucher('unavailable')}
                </Text>
              </View>
              {invalidVouchers.slice(0, 5).map((p) => (
                <View key={p.voucher.slug} style={{ opacity: 0.5 }}>
                  <VoucherCard
                    voucher={p.voucher}
                    isSelected={false}
                    primaryColor={primaryColor}
                    isDark={isDark}
                    onSelect={handleSelectBySlug}
                    onViewCondition={handleViewCondition}
                    errorMessage={p.errorMessage}
                    discountLabel={p.discountLabel}
                    expiryText={p.expiryText}
                    minOrderText={p.minOrderText}
                    usagePercent={p.usagePercent}
                  />
                </View>
              ))}
            </>
          )}

          {/* Loading / load more */}
          {isLoadingList && (
            <Text
              style={{
                textAlign: 'center',
                marginTop: 16,
                fontSize: 13,
                color: isDark ? colors.gray[400] : colors.gray[500],
              }}
            >
              {tVoucher('loadingVouchers')}
            </Text>
          )}
          {!isLoadingList && hasMore && (
            <Pressable
              onPress={handleLoadMore}
              style={voucherSheetStyles.loadMoreBtn}
            >
              <Text
                style={{ fontSize: 13, fontWeight: '600', color: primaryColor }}
              >
                {tVoucher('loadMore')}
              </Text>
            </Pressable>
          )}
        </BottomSheetScrollView>

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

const voucherSheetStyles = StyleSheet.create({
  // outer: {
  //   flex: 1,
  // },
  fixedHeader: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  // content: {
  //   flex: 1,
  //   paddingHorizontal: 20,
  //   paddingTop: 8,
  // },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 46,
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.gray[300],
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.5,
    padding: 0,
  },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  appliedText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  resultRow: {
    marginTop: 14,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  // resultCard: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   marginTop: 14,
  //   padding: 12,
  //   borderRadius: 12,
  //   gap: 10,
  // },
  // resultInfo: {
  //   flex: 1,
  //   gap: 2,
  // },
  // resultTitle: {
  //   fontSize: 14,
  //   fontWeight: '600',
  // },
  // resultApplyBtn: {
  //   paddingHorizontal: 16,
  //   paddingVertical: 8,
  //   borderRadius: 10,
  // },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    // paddingBottom đặt inline (safe-area + 16), không để ở đây cho khỏi
    // tưởng là giá trị đang có tác dụng.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[200],
  },
  footerBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
