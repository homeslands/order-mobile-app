import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import * as Location from 'expo-location'
import { MapPin, Navigation, X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDebounce } from 'use-debounce'
import { useShallow } from 'zustand/react/shallow'

import { colors, PHONE_NUMBER_REGEX } from '@/constants'
import {
  useGetAddressByPlaceId,
  useGetAddressSuggestions,
  useGetDistanceAndDuration,
} from '@/hooks'
import { useGetBranchDeliveryConfig } from '@/hooks/use-branch-delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import type { IAddressSuggestion } from '@/types'
import { showToast } from '@/utils'

export interface DeliveryAddressSheetProps {
  visible: boolean
  onClose: () => void
  mode: 'cart' | 'update-order'
  branchSlug: string
  isDark: boolean
  primaryColor: string
}

const SNAP_POINTS = ['85%']

export const DeliveryAddressSheet = memo(function DeliveryAddressSheet({
  visible,
  onClose,
  mode,
  branchSlug,
  isDark,
  primaryColor,
}: DeliveryAddressSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { bottom: bottomInset } = useSafeAreaInsets()

  // ─── Store actions (unconditional) ──────────────────────────────────────────
  const cartState = useOrderFlowStore(
    useShallow((s) => ({
      setDeliveryAddress: s.setDeliveryAddress,
      setDeliveryCoords: s.setDeliveryCoords,
      setDeliveryDistanceDuration: s.setDeliveryDistanceDuration,
      setDeliveryPhone: s.setDeliveryPhone,
      clearDeliveryInfo: s.clearDeliveryInfo,
      currentAddress: s.orderingData?.deliveryAddress ?? '',
      currentPhone: s.orderingData?.deliveryPhone ?? '',
      currentLat: s.orderingData?.deliveryLat,
      currentLng: s.orderingData?.deliveryLng,
    })),
  )
  const draftState = useOrderFlowStore(
    useShallow((s) => ({
      setDeliveryAddress: s.setDraftDeliveryAddress,
      setDeliveryCoords: s.setDraftDeliveryCoords,
      setDeliveryDistanceDuration: s.setDraftDeliveryDistanceDuration,
      setDeliveryPhone: s.setDraftDeliveryPhone,
      clearDeliveryInfo: s.clearDraftDeliveryInfo,
      currentAddress: s.updatingData?.updateDraft?.deliveryAddress ?? '',
      currentPhone: s.updatingData?.updateDraft?.deliveryPhone ?? '',
      currentLat: s.updatingData?.updateDraft?.deliveryLat,
      currentLng: s.updatingData?.updateDraft?.deliveryLng,
    })),
  )
  const actions = mode === 'cart' ? cartState : draftState

  // ─── Branch location ─────────────────────────────────────────────────────────
  const branchLocation = useBranchStore(
    useShallow((s) => s.branch?.addressDetail),
  )

  // ─── Branch delivery config ──────────────────────────────────────────────────
  const { maxDistance } = useGetBranchDeliveryConfig(branchSlug)

  // ─── Local state ─────────────────────────────────────────────────────────────
  const [addressInput, setAddressInput] = useState('')
  const [queryAddress] = useDebounce(addressInput, 300)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedPlaceId, setSelectedPlaceId] = useState('')
  const [pendingSelection, setPendingSelection] = useState<{
    lat: number
    lng: number
    placeId: string
    address: string
  } | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')

  const userPhone = useUserStore((s) => s.userInfo?.phonenumber ?? '')
  const isHydrated = useOrderFlowStore((s) => s.isHydrated)

  // ─── Query hooks ─────────────────────────────────────────────────────────────
  const suggestionsQuery = useGetAddressSuggestions(queryAddress)
  const addressByPlaceIdQuery = useGetAddressByPlaceId(selectedPlaceId)

  useEffect(() => {
    if (!addressByPlaceIdQuery.data?.result || !selectedPlaceId) return
    const { lat, lng } = addressByPlaceIdQuery.data.result
    setPendingSelection({ lat, lng, placeId: selectedPlaceId, address: addressInput })
  }, [addressByPlaceIdQuery.data, selectedPlaceId, addressInput])

  // ─── Distance check ───────────────────────────────────────────────────────────
  const lastProcessedKeyRef = useRef('')
  const lastRejectedKeyRef = useRef('')

  const pendingLat = pendingSelection?.lat ?? 0
  const pendingLng = pendingSelection?.lng ?? 0

  const distanceQuery = useGetDistanceAndDuration(branchSlug, pendingLat, pendingLng)

  useEffect(() => {
    if (!pendingSelection || !distanceQuery.data?.result || !maxDistance) return

    const { lat, lng, placeId, address } = pendingSelection
    const key = `${lat.toFixed(6)},${lng.toFixed(6)}|${placeId}`
    const { distance, duration } = distanceQuery.data.result

    if (distance > maxDistance) {
      if (lastRejectedKeyRef.current === key) return
      lastRejectedKeyRef.current = key
      setPendingSelection(null)
      setSelectedPlaceId('')
      setAddressInput('')
      setShowSuggestions(false)
      actions.clearDeliveryInfo()
      showToast(`Địa chỉ cách chi nhánh quá ${maxDistance}km`)
      return
    }

    if (lastProcessedKeyRef.current === key) return
    lastProcessedKeyRef.current = key

    actions.setDeliveryAddress(address)
    actions.setDeliveryCoords(lat, lng, placeId)
    actions.setDeliveryDistanceDuration(distance, duration)
  }, [distanceQuery.data, pendingSelection, maxDistance, actions])

  // ─── Sheet open/close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  // ─── GPS handler ──────────────────────────────────────────────────────────────
  const handleGPS = useCallback(async () => {
    setIsLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== Location.PermissionStatus.GRANTED) {
        showToast('Không có quyền truy cập vị trí')
        return
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })
      const { latitude, longitude } = position.coords
      const [geocoded] = await Location.reverseGeocodeAsync({ latitude, longitude })
      if (geocoded) {
        const parts = [
          geocoded.streetNumber,
          geocoded.street,
          geocoded.district,
          geocoded.city,
        ].filter(Boolean)
        const addressText = parts.join(', ')
        setAddressInput(addressText)
        setShowSuggestions(true)
      }
    } catch {
      showToast('Không thể xác định vị trí')
    } finally {
      setIsLocating(false)
    }
  }, [])

  // ─── State restore ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isHydrated || !visible) return
    const s = useOrderFlowStore.getState()
    const saved =
      mode === 'cart'
        ? {
            address: s.orderingData?.deliveryAddress ?? '',
            phone: s.orderingData?.deliveryPhone ?? '',
            lat: s.orderingData?.deliveryLat,
            lng: s.orderingData?.deliveryLng,
          }
        : {
            address: s.updatingData?.updateDraft?.deliveryAddress ?? '',
            phone: s.updatingData?.updateDraft?.deliveryPhone ?? '',
            lat: s.updatingData?.updateDraft?.deliveryLat,
            lng: s.updatingData?.updateDraft?.deliveryLng,
          }
    if (saved.address) setAddressInput(saved.address)
    if (saved.phone) {
      setPhoneInput(saved.phone)
    } else if (userPhone) {
      setPhoneInput(userPhone)
      actions.setDeliveryPhone(userPhone)
    }
    if (saved.lat && saved.lng) {
      setPendingSelection({ lat: saved.lat, lng: saved.lng, placeId: '', address: saved.address })
    }
  }, [isHydrated, visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const canConfirm =
    !!actions.currentAddress &&
    !!phoneInput &&
    PHONE_NUMBER_REGEX.test(phoneInput)

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

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={bottomInset}>
        <View
          style={[
            f.footer,
            { backgroundColor: isDark ? colors.gray[900] : colors.white.light },
          ]}
        >
          <Pressable
            onPress={() => { if (canConfirm) onClose() }}
            disabled={!canConfirm}
            style={[
              f.confirmBtn,
              { backgroundColor: canConfirm ? primaryColor : isDark ? colors.gray[700] : colors.gray[300] },
            ]}
          >
            <Text style={[f.confirmText, { color: canConfirm ? colors.white.light : (isDark ? colors.gray[400] : colors.gray[500]) }]}>
              {canConfirm ? 'Xác nhận địa chỉ này' : 'Thiếu thông tin giao hàng'}
            </Text>
          </Pressable>
        </View>
      </BottomSheetFooter>
    ),
    [bottomInset, isDark, canConfirm, primaryColor, onClose],
  )

  const textPrimary = isDark ? colors.gray[50] : colors.gray[900]
  const textMuted = isDark ? colors.gray[400] : colors.gray[500]
  const borderDefault = isDark ? colors.gray[700] : colors.gray[200]
  const surfaceAlt = isDark ? colors.gray[800] : colors.gray[50]

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={onClose}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      footerComponent={renderFooter}
    >
      <BottomSheetScrollView
        contentContainerStyle={f.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ── */}
        <View style={f.header}>
          <Text style={[f.title, { color: textPrimary }]}>Địa chỉ giao hàng</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={textMuted} />
          </Pressable>
        </View>

        {/* ── Range note ── */}
        <Text style={[f.feeNote, { color: isDark ? colors.destructive.dark : colors.destructive.light }]}>
          Giao hàng trong bán kính {maxDistance ?? '...'} km
        </Text>

        {/* ── Route card: From → To ── */}
        <View style={f.routeCard}>
          {/* From: branch */}
          <View style={f.routeRow}>
            <View style={f.indicatorCol}>
              <View style={[f.fromDot, { backgroundColor: primaryColor }]} />
              <View style={[f.connectorLine, { backgroundColor: borderDefault }]} />
            </View>
            <View style={f.routeTextCol}>
              <Text style={[f.routeLabel, { color: textMuted }]}>Từ</Text>
              <Text style={[f.routeAddress, { color: textPrimary }]} numberOfLines={2}>
                {branchLocation?.formattedAddress ?? 'Chi nhánh hiện tại'}
              </Text>
            </View>
          </View>

          {/* To: delivery input */}
          <View style={f.routeRow}>
            <View style={f.indicatorColDest}>
              <MapPin size={16} color="#ef4444" />
            </View>
            <View
              style={[
                f.inputWrapper,
                {
                  backgroundColor: isDark ? colors.gray[900] : colors.white.light,
                  borderColor: showSuggestions ? primaryColor : borderDefault,
                },
              ]}
            >
              <BottomSheetTextInput
                value={addressInput}
                onChangeText={(text) => {
                  setAddressInput(text)
                  setShowSuggestions(text.length > 0)
                  if (!text) {
                    setSelectedPlaceId('')
                    setPendingSelection(null)
                  }
                }}
                placeholder="Nhập địa chỉ giao hàng..."
                placeholderTextColor={textMuted}
                style={[f.input, { color: textPrimary }]}
                returnKeyType="search"
                onFocus={() => setShowSuggestions(addressInput.length > 0)}
              />
              {addressInput.length > 0 && (
                <Pressable
                  onPress={() => {
                    setAddressInput('')
                    setSelectedPlaceId('')
                    setPendingSelection(null)
                    setShowSuggestions(false)
                    actions.clearDeliveryInfo()
                  }}
                  hitSlop={8}
                >
                  <X size={14} color={textMuted} />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* ── Suggestions list — ngay dưới ô nhập địa chỉ ── */}
        {showSuggestions && (
          <View
            style={[
              f.suggestionsBox,
              { backgroundColor: isDark ? colors.gray[800] : colors.white.light, borderColor: borderDefault },
            ]}
          >
            {suggestionsQuery.isLoading && (
              <ActivityIndicator size="small" color={primaryColor} style={{ padding: 12 }} />
            )}
            <FlatList
              data={suggestionsQuery.data?.result ?? []}
              keyExtractor={(item) => item.placePrediction.placeId}
              keyboardShouldPersistTaps="always"
              scrollEnabled
              nestedScrollEnabled
              renderItem={({ item }: { item: IAddressSuggestion }) => (
                <Pressable
                  onPress={() => {
                    const text = item.placePrediction.text.text
                    setAddressInput(text)
                    setSelectedPlaceId(item.placePrediction.placeId)
                    setShowSuggestions(false)
                    Keyboard.dismiss()
                  }}
                  style={[f.suggestionItem, { borderBottomColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                >
                  <MapPin size={12} color={textMuted} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[f.suggestionMain, { color: isDark ? colors.gray[100] : colors.gray[900] }]}
                      numberOfLines={1}
                    >
                      {item.placePrediction.structuredFormat.mainText.text}
                    </Text>
                    {item.placePrediction.structuredFormat.secondaryText?.text && (
                      <Text
                        style={[f.suggestionSub, { color: textMuted }]}
                        numberOfLines={1}
                      >
                        {item.placePrediction.structuredFormat.secondaryText.text}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )}
            />
          </View>
        )}

        {/* ── GPS shortcut ── */}
        <Pressable
          onPress={handleGPS}
          disabled={isLocating}
          style={[f.gpsRow, { borderColor: primaryColor, backgroundColor: `${primaryColor}12` }]}
        >
          {isLocating ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <Navigation size={14} color={primaryColor} />
          )}
          <Text style={[f.gpsText, { color: primaryColor }]}>
            {isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
          </Text>
        </Pressable>

        {/* ── Distance bar (appears after address confirmed) ── */}
        {actions.currentAddress && distanceQuery.data?.result && (
          <View
            style={[
              f.distanceBar,
              { backgroundColor: isDark ? '#14532d' : '#f0fdf4', borderColor: isDark ? '#166534' : '#bbf7d0' },
            ]}
          >
            <Text style={[f.distanceText, { color: isDark ? '#86efac' : '#15803d' }]}>
              📏 {distanceQuery.data.result.distance.toFixed(1)} km ·{' '}
              ~{Math.round(distanceQuery.data.result.duration / 60)} phút
            </Text>
          </View>
        )}

        {/* ── Phone input ── */}
        <View
          style={[
            f.phoneWrapper,
            { backgroundColor: surfaceAlt, borderColor: borderDefault },
          ]}
        >
          <Text style={f.phoneIcon}>📞</Text>
          <BottomSheetTextInput
            value={phoneInput}
            onChangeText={(text) => {
              setPhoneInput(text)
              actions.setDeliveryPhone(text)
            }}
            placeholder="Số điện thoại nhận hàng"
            placeholderTextColor={textMuted}
            style={[f.input, { color: textPrimary }]}
            keyboardType="phone-pad"
            returnKeyType="done"
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const f = StyleSheet.create({
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 80,
    gap: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },

  // Route card
  routeCard: {
    paddingVertical: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 52,
  },
  indicatorCol: {
    width: 44,
    alignItems: 'center',
    paddingTop: 16,
  },
  indicatorColDest: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fromDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectorLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
  },
  routeTextCol: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 10,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  // Input (used inside route card row — flex fills remaining width)
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginVertical: 4,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },

  // GPS row
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  gpsText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Suggestions
  suggestionsBox: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 220,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionMain: {
    fontSize: 13,
    fontWeight: '600',
  },
  suggestionSub: {
    fontSize: 11,
    marginTop: 1,
  },

  // Distance bar
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Phone (standalone — no flex:1 like inputWrapper)
  phoneWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  phoneIcon: {
    fontSize: 14,
  },

  confirmBtn: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
  },
  feeNote: {
    fontSize: 12,
    fontStyle: 'italic',
  },
})
