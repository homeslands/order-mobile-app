import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
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
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { useShallow } from 'zustand/react/shallow'

import { colors, PHONE_NUMBER_REGEX } from '@/constants'
import {
  useGetAddressByPlaceId,
  useGetAddressDirection,
  useGetAddressSuggestions,
  useGetDistanceAndDuration,
} from '@/hooks'
import { useGetBranchDeliveryConfig } from '@/hooks/use-branch-delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import type { IAddressSuggestion } from '@/types'
import { decodePolyline, showToast } from '@/utils'

export interface DeliveryAddressSheetProps {
  visible: boolean
  onClose: () => void
  mode: 'cart' | 'update-order'
  branchSlug: string
  isDark: boolean
  primaryColor: string
}

const SNAP_POINTS = ['85%']
const DEFAULT_REGION = {
  latitude: 10.7769,
  longitude: 106.7009,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
}

export const DeliveryAddressSheet = memo(function DeliveryAddressSheet({
  visible,
  onClose,
  mode,
  branchSlug,
  isDark,
  primaryColor,
}: DeliveryAddressSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null)

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
  const branchRegion = useMemo(
    () =>
      branchLocation
        ? {
            latitude: branchLocation.lat,
            longitude: branchLocation.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        : DEFAULT_REGION,
    [branchLocation],
  )

  // ─── Branch delivery config ──────────────────────────────────────────────────
  const { maxDistance } = useGetBranchDeliveryConfig(branchSlug)

  // ─── Local state ─────────────────────────────────────────────────────────────
  const [addressInput, setAddressInput] = useState('')
  const [queryAddress, setQueryAddress] = useState('')
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

  // ─── Debounce 300ms ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setQueryAddress(addressInput), 300)
    return () => clearTimeout(timer)
  }, [addressInput])

  // ─── Query hooks ─────────────────────────────────────────────────────────────
  const suggestionsQuery = useGetAddressSuggestions(queryAddress)
  const addressByPlaceIdQuery = useGetAddressByPlaceId(selectedPlaceId)

  // When coords return → stage pendingSelection
  useEffect(() => {
    if (!addressByPlaceIdQuery.data?.result || !selectedPlaceId) return
    const { lat, lng } = addressByPlaceIdQuery.data.result
    setPendingSelection({
      lat,
      lng,
      placeId: selectedPlaceId,
      address: addressInput,
    })
  }, [addressByPlaceIdQuery.data, selectedPlaceId, addressInput])

  // ─── Distance check state ─────────────────────────────────────────────────
  const lastProcessedKeyRef = useRef('')
  const lastRejectedKeyRef = useRef('')

  const pendingLat = pendingSelection?.lat ?? 0
  const pendingLng = pendingSelection?.lng ?? 0

  const distanceQuery = useGetDistanceAndDuration(branchSlug, pendingLat, pendingLng)
  const directionQuery = useGetAddressDirection(branchSlug, pendingLat, pendingLng)

  // Distance check effect
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

  // Route coords
  const routeCoords = useMemo(() => {
    if (!directionQuery.data?.result) return []
    return directionQuery.data.result.legs
      .flatMap((leg) => leg.steps)
      .flatMap((step) => decodePolyline(step.polyline.points))
  }, [directionQuery.data])

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
      const [geocoded] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      })
      if (geocoded) {
        const parts = [
          geocoded.streetNumber,
          geocoded.street,
          geocoded.district,
          geocoded.city,
        ].filter(Boolean)
        const addressText = parts.join(', ')
        setAddressInput(addressText)
        setShowSuggestions(false)
        setPendingSelection({
          lat: latitude,
          lng: longitude,
          placeId: '',
          address: addressText,
        })
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
    if (actions.currentAddress) setAddressInput(actions.currentAddress)
    if (actions.currentPhone) {
      setPhoneInput(actions.currentPhone)
    } else if (userPhone) {
      setPhoneInput(userPhone)
      actions.setDeliveryPhone(userPhone)
    }
    if (actions.currentLat && actions.currentLng) {
      setPendingSelection({
        lat: actions.currentLat,
        lng: actions.currentLng,
        placeId: '',
        address: actions.currentAddress,
      })
    }
  }, [isHydrated, visible, actions, userPhone])

  const canConfirm =
    !!actions.currentAddress &&
    !!phoneInput &&
    PHONE_NUMBER_REGEX.test(phoneInput)

  const bgStyle = useMemo(
    () => ({
      backgroundColor: isDark ? colors.gray[900] : colors.white.light,
    }),
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
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark
              ? colors.gray[900]
              : colors.white.light,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
          >
            Địa chỉ giao hàng
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X
              size={20}
              color={isDark ? colors.gray[400] : colors.gray[500]}
            />
          </Pressable>
        </View>

        {/* Search row */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: isDark
                  ? colors.gray[800]
                  : colors.gray[50],
                borderColor: showSuggestions
                  ? primaryColor
                  : isDark
                    ? colors.gray[700]
                    : colors.gray[200],
              },
            ]}
          >
            <MapPin
              size={14}
              color={isDark ? colors.gray[400] : colors.gray[500]}
            />
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
              placeholderTextColor={
                isDark ? colors.gray[500] : colors.gray[400]
              }
              style={[
                styles.input,
                { color: isDark ? colors.gray[50] : colors.gray[900] },
              ]}
              returnKeyType="search"
              onFocus={() =>
                setShowSuggestions(addressInput.length > 0)
              }
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
                <X
                  size={14}
                  color={isDark ? colors.gray[400] : colors.gray[500]}
                />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={handleGPS}
            disabled={isLocating}
            style={[
              styles.gpsBtn,
              {
                backgroundColor: isDark
                  ? colors.gray[800]
                  : '#ede9fe',
              },
            ]}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Navigation size={16} color={primaryColor} />
            )}
          </Pressable>
        </View>

        {/* Map + suggestions container */}
        <View style={styles.mapContainer}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={branchRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {branchLocation && (
              <Marker
                coordinate={{
                  latitude: branchLocation.lat,
                  longitude: branchLocation.lng,
                }}
                pinColor={primaryColor}
                title="Chi nhánh"
              />
            )}
            {pendingSelection && (
              <Marker
                coordinate={{
                  latitude: pendingSelection.lat,
                  longitude: pendingSelection.lng,
                }}
                pinColor="#ef4444"
              />
            )}
            {routeCoords.length > 0 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#22c55e"
                strokeWidth={3}
              />
            )}
          </MapView>

          {/* Suggestions overlay */}
          {showSuggestions && (
            <View
              style={[
                styles.suggestionsOverlay,
                {
                  backgroundColor: isDark
                    ? colors.gray[900]
                    : colors.white.light,
                  borderColor: isDark
                    ? colors.gray[700]
                    : colors.gray[200],
                },
              ]}
            >
              {suggestionsQuery.isLoading && (
                <ActivityIndicator
                  size="small"
                  color={primaryColor}
                  style={{ padding: 12 }}
                />
              )}
              <FlatList
                data={suggestionsQuery.data?.result ?? []}
                keyExtractor={(item) =>
                  item.placePrediction.placeId
                }
                keyboardShouldPersistTaps="always"
                renderItem={({
                  item,
                }: {
                  item: IAddressSuggestion
                }) => (
                  <Pressable
                    onPress={() => {
                      const text =
                        item.placePrediction.text.text
                      setAddressInput(text)
                      setSelectedPlaceId(
                        item.placePrediction.placeId,
                      )
                      setShowSuggestions(false)
                      Keyboard.dismiss()
                    }}
                    style={[
                      styles.suggestionItem,
                      {
                        borderBottomColor: isDark
                          ? colors.gray[800]
                          : colors.gray[100],
                      },
                    ]}
                  >
                    <MapPin
                      size={12}
                      color={
                        isDark ? colors.gray[400] : colors.gray[500]
                      }
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.suggestionMain,
                          {
                            color: isDark
                              ? colors.gray[100]
                              : colors.gray[900],
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {
                          item.placePrediction.structuredFormat
                            .mainText.text
                        }
                      </Text>
                      {item.placePrediction.structuredFormat
                        .secondaryText?.text && (
                        <Text
                          style={[
                            styles.suggestionSub,
                            {
                              color: isDark
                                ? colors.gray[400]
                                : colors.gray[500],
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {
                            item.placePrediction.structuredFormat
                              .secondaryText.text
                          }
                        </Text>
                      )}
                    </View>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>

        {/* Distance bar */}
        {actions.currentAddress && distanceQuery.data?.result && (
          <View
            style={[
              styles.distanceBar,
              {
                backgroundColor: isDark ? '#14532d' : '#f0fdf4',
                borderColor: isDark ? '#166534' : '#bbf7d0',
              },
            ]}
          >
            <Text
              style={[
                styles.distanceText,
                { color: isDark ? '#86efac' : '#15803d' },
              ]}
            >
              📏 {distanceQuery.data.result.distance.toFixed(1)} km ·
              ~{Math.round(distanceQuery.data.result.duration / 60)}{' '}
              phút
            </Text>
          </View>
        )}

        {/* Phone input */}
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: isDark
                ? colors.gray[800]
                : colors.gray[50],
              borderColor: isDark
                ? colors.gray[700]
                : colors.gray[200],
            },
          ]}
        >
          <Text style={{ fontSize: 14 }}>📞</Text>
          <BottomSheetTextInput
            value={phoneInput}
            onChangeText={(text) => {
              setPhoneInput(text)
              actions.setDeliveryPhone(text)
            }}
            placeholder="Số điện thoại nhận hàng"
            placeholderTextColor={
              isDark ? colors.gray[500] : colors.gray[400]
            }
            style={[
              styles.input,
              { color: isDark ? colors.gray[50] : colors.gray[900] },
            ]}
            keyboardType="phone-pad"
            returnKeyType="done"
          />
        </View>

        {/* Confirm button */}
        <Pressable
          onPress={() => { if (canConfirm) onClose() }}
          disabled={!canConfirm}
          style={[
            styles.confirmBtn,
            {
              backgroundColor: canConfirm
                ? primaryColor
                : isDark
                  ? colors.gray[700]
                  : colors.gray[300],
            },
          ]}
        >
          <Text
            style={[
              styles.confirmText,
              {
                color: canConfirm
                  ? colors.white.light
                  : isDark
                    ? colors.gray[400]
                    : colors.gray[500],
              },
            ]}
          >
            {canConfirm ? 'Xác nhận địa chỉ này' : 'Thiếu thông tin giao hàng'}
          </Text>
        </Pressable>

        {/* Fee note */}
        <View
          style={[
            styles.feeNote,
            {
              backgroundColor: isDark ? colors.gray[800] : '#fef9c3',
            },
          ]}
        >
          <Text
            style={[
              styles.feeNoteText,
              { color: isDark ? colors.gray[300] : '#854d0e' },
            ]}
          >
            ⚡ Giao hàng trong bán kính {maxDistance ?? '...'} km
          </Text>
        </View>
      </View>
    </BottomSheetModal>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  gpsBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 200,
  },
  map: {
    flex: 1,
  },
  suggestionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    maxHeight: 220,
    borderWidth: 1,
    borderTopWidth: 0,
    borderRadius: 8,
    zIndex: 10,
    elevation: 10,
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
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  feeNoteText: {
    fontSize: 12,
  },
})
