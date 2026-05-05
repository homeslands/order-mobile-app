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
import { formatCurrencyNative } from 'cart-price-calc'
import { MapPin, Navigation, Pencil, Phone, X } from 'lucide-react-native'
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { useDebounce } from 'use-debounce'
import { useShallow } from 'zustand/react/shallow'

import { colors, PHONE_NUMBER_REGEX } from '@/constants'
import {
  useGetAddressByPlaceId,
  useGetAddressDirection,
  useGetAddressSuggestions,
  useGetDistanceAndDuration,
} from '@/hooks'
import { useCalculateDeliveryFee, useGetBranchDeliveryConfig } from '@/hooks/use-branch-delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import type { IAddressSuggestion } from '@/types'
import { decodePolyline, showToast } from '@/utils'

const MAP_HEIGHT = Dimensions.get('window').height * 0.38

export interface DeliveryAddressSheetProps {
  visible: boolean
  onClose: () => void
  mode: 'cart' | 'update-order'
  branchSlug: string
  isDark: boolean
  primaryColor: string
}

const SNAP_POINTS = ['90%']

interface DeliveryMapProps {
  branchLat: number
  branchLng: number
  hasBranchLocation: boolean
  pendingSelection: { lat: number; lng: number } | null
  routeCoords: { latitude: number; longitude: number }[]
  primaryColor: string
}

const DeliveryMap = memo(
  forwardRef<MapView, DeliveryMapProps>(function DeliveryMap(
    { branchLat, branchLng, hasBranchLocation, pendingSelection, routeCoords, primaryColor },
    ref,
  ) {
    return (
      <MapView
        ref={ref}
        provider={PROVIDER_GOOGLE}
        style={f.map}
        initialRegion={{
          latitude: branchLat,
          longitude: branchLng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
      >
        {hasBranchLocation && (
          <Marker
            coordinate={{ latitude: branchLat, longitude: branchLng }}
            pinColor={primaryColor}
            title="Chi nhánh"
          />
        )}
        {pendingSelection && (
          <Marker
            coordinate={{ latitude: pendingSelection.lat, longitude: pendingSelection.lng }}
            pinColor="#ef4444"
            title="Điểm giao"
          />
        )}
        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeColor={primaryColor}
            strokeWidth={3}
          />
        )}
      </MapView>
    )
  }),
)

interface SuggestionItemProps {
  item: IAddressSuggestion
  onSelect: (placeId: string, text: string) => void
  isDark: boolean
}

const SuggestionItem = memo(function SuggestionItem({
  item,
  onSelect,
  isDark,
}: SuggestionItemProps) {
  const handlePress = useCallback(() => {
    onSelect(item.placePrediction.placeId, item.placePrediction.text.text)
  }, [item.placePrediction.placeId, item.placePrediction.text.text, onSelect])

  const textMuted = isDark ? colors.gray[400] : colors.gray[500]
  const textPrimary = isDark ? colors.gray[100] : colors.gray[900]

  return (
    <Pressable
      onPress={handlePress}
      style={[
        f.suggestionItem,
        { borderBottomColor: isDark ? colors.gray[700] : colors.gray[100] },
      ]}
    >
      <MapPin size={12} color={textMuted} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={[f.suggestionMain, { color: textPrimary }]}
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
  )
})

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
  const [queryAddress] = useDebounce(addressInput, 600)
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
  const isGpsInputRef = useRef(false)
  // Programmatic text control: key remounts the input, mountTextRef holds the text
  // for the next mount. defaultValue reads from ref (not state) so typing never triggers
  // defaultValue re-application (the BottomSheetTextInput bug).
  const [inputMountKey, setInputMountKey] = useState(0)
  const mountTextRef = useRef('')
  const addressInputRef = useRef(addressInput)
  useEffect(() => { addressInputRef.current = addressInput }, [addressInput])
  const phoneInputRef = useRef(phoneInput)
  useEffect(() => { phoneInputRef.current = phoneInput }, [phoneInput])

  const setAddressText = useCallback((text: string) => {
    mountTextRef.current = text
    setAddressInput(text)
    setInputMountKey((k) => k + 1)
  }, [])

  // ─── Query hooks ─────────────────────────────────────────────────────────────
  const suggestionsQuery = useGetAddressSuggestions(queryAddress)
  const addressByPlaceIdQuery = useGetAddressByPlaceId(selectedPlaceId)

  useEffect(() => {
    if (!addressByPlaceIdQuery.data?.result || !selectedPlaceId) return
    const { lat, lng } = addressByPlaceIdQuery.data.result
    setPendingSelection({
      lat: parseFloat(String(lat)),
      lng: parseFloat(String(lng)),
      placeId: selectedPlaceId,
      address: addressInputRef.current,
    })
  }, [addressByPlaceIdQuery.data, selectedPlaceId])

  // ─── GPS auto-select first suggestion ────────────────────────────────────────
  useEffect(() => {
    if (!isGpsInputRef.current) return
    const results = suggestionsQuery.data?.result
    if (!results?.length) return
    isGpsInputRef.current = false
    const first = results[0]
    setAddressText(first.placePrediction.text.text)
    setSelectedPlaceId(first.placePrediction.placeId)
    setShowSuggestions(false)
    Keyboard.dismiss()
  }, [suggestionsQuery.data])

  // ─── Address input handlers (stable — no re-render on typing) ───────────────
  const handleAddressChange = useCallback((text: string) => {
    setAddressInput(text)
    setShowSuggestions(text.length > 0)
    if (!text) {
      setSelectedPlaceId('')
      setPendingSelection(null)
    }
  }, [])

  const handleAddressClear = useCallback(() => {
    mountTextRef.current = ''
    setAddressInput('')
    setInputMountKey((k) => k + 1)
    setSelectedPlaceId('')
    setPendingSelection(null)
    setShowSuggestions(false)
  }, [])

  const handleSelectSuggestion = useCallback(
    (placeId: string, text: string) => {
      setAddressText(text)
      setSelectedPlaceId(placeId)
      setShowSuggestions(false)
      Keyboard.dismiss()
    },
    [setAddressText],
  )

  const handlePhoneChange = useCallback((text: string) => {
    setPhoneInput(text)
    // Only write to store when complete (10 digits) or cleared — prevents
    // per-keystroke store mutations that trigger CartFooter/UpdateOrderFooter re-renders
    if (!text || PHONE_NUMBER_REGEX.test(text)) {
      actions.setDeliveryPhone(text)
    }
  }, [actions])

  const handlePhoneBlur = useCallback(() => {
    const value = phoneInputRef.current
    // Partial numbers are intentionally NOT written to the store — same guard as
    // handlePhoneChange. canConfirm prevents confirm with invalid phone regardless.
    if (!value || PHONE_NUMBER_REGEX.test(value)) {
      actions.setDeliveryPhone(value)
    }
  }, [actions])

  // ─── Distance check ───────────────────────────────────────────────────────────
  const lastProcessedKeyRef = useRef('')
  const lastRejectedKeyRef = useRef('')

  const pendingLat = pendingSelection?.lat ?? 0
  const pendingLng = pendingSelection?.lng ?? 0

  const distanceQuery = useGetDistanceAndDuration(branchSlug, pendingLat, pendingLng)
  const directionQuery = useGetAddressDirection(branchSlug, pendingLat, pendingLng)

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
      setAddressText('')
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

  // ─── Direction + route polyline ─────────────────────────────────────────────
  const routeCoords = useMemo(() => {
    if (!directionQuery.data?.result) return []
    return directionQuery.data.result.legs
      .flatMap((leg) => leg.steps)
      .flatMap((step) => decodePolyline(step.polyline.points))
  }, [directionQuery.data])

  // ─── Delivery fee ────────────────────────────────────────────────────────────
  const confirmedDistance = distanceQuery.data?.result?.distance ?? 0
  const { deliveryFee } = useCalculateDeliveryFee(confirmedDistance, branchSlug, {
    enabled: !!actions.currentAddress && confirmedDistance > 0,
  })

  // ─── Map ref + fit to route ───────────────────────────────────────────────────
  const mapRef = useRef<MapView>(null)
  useEffect(() => {
    if (!actions.currentAddress || !branchLocation || !pendingSelection) return
    const coords = [
      { latitude: parseFloat(String(branchLocation.lat)), longitude: parseFloat(String(branchLocation.lng)) },
      { latitude: pendingSelection.lat, longitude: pendingSelection.lng },
    ]
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 60, left: 40 },
        animated: true,
      })
    }, 350)
    return () => clearTimeout(timer)
  }, [actions.currentAddress, branchLocation, pendingSelection])

  // ─── Edit address handler ─────────────────────────────────────────────────────
  const handleEditAddress = useCallback(() => {
    setPendingSelection(null)
    setSelectedPlaceId('')
    setShowSuggestions(addressInput.length > 0)
    lastProcessedKeyRef.current = ''
    lastRejectedKeyRef.current = ''
    actions.clearDeliveryInfo()
  }, [actions, addressInput])

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
        setAddressText(addressText)
        isGpsInputRef.current = true
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
            placeId: '',
          }
        : {
            address: s.updatingData?.updateDraft?.deliveryAddress ?? '',
            phone: s.updatingData?.updateDraft?.deliveryPhone ?? '',
            lat: s.updatingData?.updateDraft?.deliveryLat,
            lng: s.updatingData?.updateDraft?.deliveryLng,
            placeId: s.updatingData?.updateDraft?.deliveryPlaceId ?? '',
          }
    if (saved.address) setAddressText(saved.address)
    if (saved.phone) {
      setPhoneInput(saved.phone)
    } else if (userPhone) {
      setPhoneInput(userPhone)
      actions.setDeliveryPhone(userPhone)
    }
    if (saved.lat && saved.lng) {
      setPendingSelection({
        lat: parseFloat(String(saved.lat)),
        lng: parseFloat(String(saved.lng)),
        placeId: saved.placeId,
        address: saved.address,
      })
    }
  }, [isHydrated, visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasCoords = pendingLat !== 0 && pendingLng !== 0
  const phoneIsValid = useMemo(
    () => !!phoneInput && PHONE_NUMBER_REGEX.test(phoneInput),
    [phoneInput],
  )
  const phoneIsInvalid = !!phoneInput && !phoneIsValid
  // True while waiting for coords (addressByPlaceIdQuery) or distance check to resolve
  const isResolvingAddress =
    !!selectedPlaceId &&
    !actions.currentAddress &&
    !addressByPlaceIdQuery.isError

  const canConfirm = !!actions.currentAddress && phoneIsValid

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

  const handleConfirm = useCallback(() => {
    if (!canConfirm) return
    // Ensure store has the latest phone value before closing (in case blur
    // hasn't fired yet — user taps confirm immediately after last digit)
    actions.setDeliveryPhone(phoneInputRef.current)
    onClose()
  }, [canConfirm, actions, onClose])

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
            onPress={handleConfirm}
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
    [bottomInset, isDark, canConfirm, primaryColor, handleConfirm],
  )

  const textPrimary = isDark ? colors.gray[50] : colors.gray[900]
  const textMuted = isDark ? colors.gray[400] : colors.gray[500]
  const borderDefault = isDark ? colors.gray[700] : colors.gray[200]

  // API returns lat/lng as strings despite the TypeScript type saying number
  const branchLat = useMemo(
    () => parseFloat(String(branchLocation?.lat ?? 10.7769)),
    [branchLocation?.lat],
  )
  const branchLng = useMemo(
    () => parseFloat(String(branchLocation?.lng ?? 106.7009)),
    [branchLocation?.lng],
  )

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

        {actions.currentAddress ? (
          /* ══════════════════════════════════════════
             CONFIRMATION VIEW — hiển thị sau khi chọn xong
             ══════════════════════════════════════════ */
          <>
            {/* Confirmed address + edit button */}
            <View style={[f.confirmedRow, { borderColor: borderDefault }]}>
              <MapPin size={14} color="#ef4444" />
              <Text style={[f.confirmedAddress, { color: textPrimary }]} numberOfLines={1} ellipsizeMode="tail">
                {actions.currentAddress}
              </Text>
              <Pressable onPress={handleEditAddress} hitSlop={8} style={[f.editBtn, { backgroundColor: `${primaryColor}0f` }]}>
                <Pencil size={14} color={primaryColor} />
              </Pressable>
            </View>

            {/* Map */}
            <View style={[f.mapContainer, { borderColor: borderDefault }]}>
              <DeliveryMap
                ref={mapRef}
                branchLat={branchLat}
                branchLng={branchLng}
                hasBranchLocation={!!branchLocation}
                pendingSelection={pendingSelection}
                routeCoords={routeCoords}
                primaryColor={primaryColor}
              />
            </View>

            {/* Time + distance info */}
            {(!hasCoords || distanceQuery.isLoading) ? (
              <View style={[f.infoRow, { backgroundColor: `${primaryColor}0a`, borderColor: primaryColor }]}>
                <ActivityIndicator size="small" color={primaryColor} style={{ flex: 1, paddingVertical: 12 }} />
              </View>
            ) : distanceQuery.data?.result ? (
              <View style={[f.infoRow, { backgroundColor: `${primaryColor}0a`, borderColor: primaryColor }]}>
                <View style={f.infoItem}>
                  <Text style={[f.infoLabel, { color: textMuted }]}>Thời gian dự kiến</Text>
                  <Text style={[f.infoValue, { color: textPrimary }]}>
                    ~{Math.round(distanceQuery.data.result.duration)} phút
                  </Text>
                </View>
                <View style={[f.infoSep, { backgroundColor: borderDefault }]} />
                <View style={f.infoItem}>
                  <Text style={[f.infoLabel, { color: textMuted }]}>Khoảng cách</Text>
                  <Text style={[f.infoValue, { color: textPrimary }]}>
                    {distanceQuery.data.result.distance.toFixed(1)} km
                  </Text>
                </View>
                <View style={[f.infoSep, { backgroundColor: borderDefault }]} />
                <View style={f.infoItem}>
                  <Text style={[f.infoLabel, { color: textMuted }]}>Phí giao hàng</Text>
                  <Text style={[f.infoValue, { color: primaryColor }]}>
                    {deliveryFee != null ? formatCurrencyNative(deliveryFee) : '...'}
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Phone input */}
            <View style={f.phoneSection}>
              <Text style={[f.sectionLabel, { color: textMuted }]}>Số điện thoại nhận hàng</Text>
              <View style={[f.phoneWrapper, {
                backgroundColor: phoneIsInvalid
                  ? (isDark ? `${colors.destructive.dark}15` : `${colors.destructive.light}15`)
                  : `${primaryColor}0a`,
                borderColor: phoneIsInvalid
                  ? (isDark ? colors.destructive.dark : colors.destructive.light)
                  : primaryColor,
              }]}>
                <Phone
                  size={14}
                  color={phoneIsInvalid
                    ? (isDark ? colors.destructive.dark : colors.destructive.light)
                    : primaryColor}
                />
                <BottomSheetTextInput
                  value={phoneInput}
                  onChangeText={handlePhoneChange}
                  onBlur={handlePhoneBlur}
                  placeholder="Nhập số điện thoại..."
                  placeholderTextColor={textMuted}
                  style={[f.input, { color: textPrimary }]}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                  maxLength={12}
                />
                {phoneInput.length > 0 && (
                  <Pressable
                    onPress={() => { setPhoneInput(''); actions.setDeliveryPhone('') }}
                    hitSlop={8}
                  >
                    <X size={14} color={textMuted} />
                  </Pressable>
                )}
              </View>
              {phoneIsInvalid && (
                <Text style={[f.phoneError, { color: isDark ? colors.destructive.dark : colors.destructive.light }]}>
                  Số điện thoại phải đủ 10 số
                </Text>
              )}
            </View>
          </>
        ) : (
          /* ══════════════════════════════════════════
             SELECTION VIEW — chọn địa chỉ giao hàng
             ══════════════════════════════════════════ */
          <>
            {/* Range note */}
            <Text style={[f.feeNote, { color: textMuted }]}>
              Giao hàng trong bán kính {maxDistance ?? '...'} km
            </Text>

            {/* Route card: From → To */}
            <View style={f.routeCard}>
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
                    key={inputMountKey}
                    defaultValue={mountTextRef.current}
                    onChangeText={handleAddressChange}
                    placeholder="Nhập địa chỉ giao hàng..."
                    placeholderTextColor={textMuted}
                    style={[f.input, { color: textPrimary }]}
                    returnKeyType="search"
                    onFocus={() => setShowSuggestions(addressInput.length > 0)}
                  />
                  {addressInput.length > 0 && (
                    <Pressable
                      onPress={() => {
                        handleAddressClear()
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

            {/* Suggestions */}
            {showSuggestions && (
              <View style={[f.suggestionsBox, { backgroundColor: isDark ? colors.gray[800] : colors.white.light, borderColor: borderDefault }]}>
                {suggestionsQuery.isLoading && (
                  <ActivityIndicator size="small" color={primaryColor} style={{ padding: 12 }} />
                )}
                {(suggestionsQuery.data?.result ?? []).map((item: IAddressSuggestion) => (
                  <SuggestionItem
                    key={item.placePrediction.placeId}
                    item={item}
                    onSelect={handleSelectSuggestion}
                    isDark={isDark}
                  />
                ))}
              </View>
            )}

            {/* Loading indicator while resolving suggestion → coords → distance */}
            {isResolvingAddress && (
              <View style={[f.resolvingRow, { backgroundColor: `${primaryColor}0a`, borderColor: primaryColor }]}>
                <ActivityIndicator size="small" color={primaryColor} />
                <Text style={[f.resolvingText, { color: primaryColor }]}>
                  Đang xác nhận địa chỉ...
                </Text>
              </View>
            )}

            {/* GPS shortcut */}
            <Pressable
              onPress={handleGPS}
              disabled={isLocating || isResolvingAddress}
              style={[f.gpsRow, { borderColor: primaryColor, backgroundColor: `${primaryColor}0a`, opacity: isResolvingAddress ? 0.5 : 1 }]}
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
          </>
        )}
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

  // Confirmation view
  confirmedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  confirmedAddress: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  editBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  mapContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    height: MAP_HEIGHT,
  },
  map: {
    width: '100%',
    height: MAP_HEIGHT,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  infoSep: {
    width: 1,
    height: 32,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Phone section
  phoneSection: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // Phone input row (no flex:1 like inputWrapper)
  phoneWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
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
  resolvingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  resolvingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  phoneError: {
    fontSize: 11,
    marginTop: -4,
    paddingHorizontal: 4,
  },
})
