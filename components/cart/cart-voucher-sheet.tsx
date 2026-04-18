import { processVoucherList } from '@/components/sheet/voucher-validation'
import { VoucherCard } from './voucher-card'
import { VoucherConditionModal } from './voucher-condition-modal'
import { colors, Role } from '@/constants'
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
import { Search, Ticket } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// ─── Voucher Sheet ───────────────────────────────────────────────────────────

const VOUCHER_SHEET_SNAP = ['90%']

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
  const [selectedVoucher, setSelectedVoucher] = useState<IVoucher | null>(null)
  const [conditionVoucher, setConditionVoucher] = useState<IVoucher | null>(
    null,
  )
  const [_validating, setValidating] = useState(false)

  // Auth — switch between private/public hooks
  const userInfo = useUserStore((s) => s.userInfo)
  const userSlug = userInfo?.slug
  const isCustomerOwner =
    !!userInfo &&
    userInfo.role?.name === Role.CUSTOMER &&
    userInfo.phonenumber !== 'default-customer'

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
  const { data: specificRes, isFetching } = specificFetch(
    { code: searchCode },
    visible && searchCode.length > 0,
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
  const processed = useMemo(
    () =>
      processVoucherList(rawEligibleVouchers, {
        cartProductSlugs,
        subTotalAfterPromotion: total,
        userSlug,
        isCustomerOwner,
        t: tVoucher,
      }),
    [
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
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
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

  const handleFooterPress = useCallback(() => {
    if (isCurrentApplied) {
      cartActions.setVoucher(null)
      showToast(tVoucher('voucher.voucherRemoved'))
      sheetRef.current?.dismiss()
    } else if (selectedVoucher) {
      // 2.2 — Validate with server before applying
      setValidating(true)
      validateVoucher(
        {
          voucher: selectedVoucher.slug,
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
            onApply(selectedVoucher)
            sheetRef.current?.dismiss()
          },
          onError: () => {
            showToast(tVoucher('voucher.voucherInvalid'))
          },
          onSettled: () => setValidating(false),
        },
      )
    } else {
      sheetRef.current?.dismiss()
    }
  }, [
    selectedVoucher,
    isCurrentApplied,
    onApply,
    validateVoucher,
    items,
    userSlug,
    tVoucher,
  ])

  const handleViewCondition = useCallback((v: IVoucher) => {
    setConditionVoucher(v)
  }, [])

  const handleCloseConditionModal = useCallback(
    () => setConditionVoucher(null),
    [],
  )

  // ─── Footer component pinned at bottom via BottomSheetFooter ────────────────
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View
          style={[
            voucherSheetStyles.footer,
            { backgroundColor: isDark ? colors.gray[900] : colors.white.light },
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
                      ? colors.gray[700]
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
                ? tVoucher('voucher.removeVoucher')
                : isNewSelection
                  ? tVoucher('voucher.apply')
                  : tVoucher('voucher.close')}
            </Text>
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [
      isDark,
      primaryColor,
      isCurrentApplied,
      isNewSelection,
      handleFooterPress,
      insets.bottom,
      tVoucher,
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
        android_keyboardInputMode="adjustResize"
      >
        {/* Fixed header */}
        <View style={voucherSheetStyles.fixedHeader}>
          <Text
            style={[
              voucherSheetStyles.title,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
          >
            {tVoucher('voucher.code')}
          </Text>

          <View style={voucherSheetStyles.inputRow}>
            <View
              style={[
                voucherSheetStyles.inputWrap,
                {
                  backgroundColor: isDark ? colors.gray[800] : colors.gray[100],
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
                placeholder={tVoucher('voucher.enterCode')}
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
                      ? colors.gray[700]
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
                {tVoucher('voucher.currentlyUsing', {
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
              {tVoucher('voucher.maxOnePerOrder')}
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
                {tVoucher('voucher.searching')}
              </Text>
            </View>
          )}
          {!isFetching && searchCode.length > 0 && !fetchedVoucher && (
            <View style={voucherSheetStyles.resultRow}>
              <Text style={{ color: colors.destructive.light, fontSize: 13 }}>
                {tVoucher('voucher.codeNotFound', { code: searchCode })}
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
                  {tVoucher('voucher.availableVouchers')}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: isDark ? colors.gray[400] : colors.gray[500],
                  }}
                >
                  {tVoucher('voucher.maxOne')}
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
                  {tVoucher('voucher.unavailable')}
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
              {tVoucher('voucher.loadingVouchers')}
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
                {tVoucher('voucher.loadMore')}
              </Text>
            </Pressable>
          )}
        </BottomSheetScrollView>
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
    paddingBottom: 8,
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
