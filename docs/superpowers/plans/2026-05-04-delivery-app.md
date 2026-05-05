# Delivery Address Selection — Mobile App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port tính năng chọn địa chỉ giao hàng từ web sang React Native — bao gồm bottom sheet với bản đồ interactive, autocomplete, GPS, distance check, và tích hợp vào CartFooter + UpdateOrderFooter.

**Architecture:** `DeliveryAddressSheet` là `BottomSheetModal` 85% chiều cao chứa MapView (react-native-maps), address autocomplete với suggestion list, GPS button (expo-location), và phone input. Prop `mode: 'cart' | 'update-order'` chọn đúng Zustand actions. Polyline được decode từ encoded format của Google qua `utils/decode-polyline.ts`.

**Tech Stack:** react-native-maps, expo-location, @gorhom/bottom-sheet (đã có), Zustand (đã có), TanStack Query (đã có)

**Spec:** `docs/superpowers/specs/2026-05-04-delivery-app-design.md`

---

## File Structure

### Tạo mới
| File | Mô tả |
|---|---|
| `utils/decode-polyline.ts` | Decode Google encoded polyline → `{latitude,longitude}[]` |
| `components/delivery/delivery-address-sheet.tsx` | Bottom sheet chính: map + autocomplete + GPS + phone |
| `components/delivery/delivery-info-row.tsx` | Row tóm tắt địa chỉ trong CartFooter/UpdateOrderFooter |
| `components/delivery/index.ts` | Barrel export |
| `__tests__/utils/decode-polyline.test.ts` | Unit test decode-polyline |
| `__tests__/hooks/use-order-type-options-delivery.test.tsx` | Test DELIVERY option trong hook |
| `__tests__/components/delivery/delivery-info-row.test.tsx` | Render test |

### Sửa đổi
| File | Thay đổi |
|---|---|
| `app.json` | Thêm expo-location plugin + Google Maps keys cho Android/iOS |
| `hooks/use-order-type-options.ts` | Thêm DELIVERY cho logged-in user |
| `components/cart/cart-order-type-sheet.tsx` | Thêm Truck icon + Delivery option |
| `components/cart/cart-footer.tsx` | DeliveryInfoRow + DeliveryAddressSheet + fee + disable check |
| `app/update-order/components/update-order-footer.tsx` | Tương tự CartFooter |
| `components/dialog/order-info-section.tsx` | Hiển thị address + phone khi DELIVERY |

---

## Task 1: Install packages & configure app.json

**Files:**
- Modify: `app.json`
- Modify: `package.json` (via install)

- [ ] **Step 1: Install packages**

```bash
npx expo install react-native-maps expo-location
```

Expected output: packages added to `package.json`, no errors.

- [ ] **Step 2: Thêm expo-location plugin vào app.json**

Tìm `"plugins"` array trong `app.json`, thêm entry sau `"expo-router"`:

```json
[
  "expo-location",
  {
    "locationWhenInUsePermission": "Ứng dụng cần quyền truy cập vị trí để giao hàng đến đúng địa chỉ."
  }
]
```

- [ ] **Step 3: Thêm Google Maps API key vào app.json**

Trong `"android"` object, thêm vào `"config"`:

```json
"config": {
  "googleMaps": {
    "apiKey": "GOOGLE_MAPS_ANDROID_API_KEY_PLACEHOLDER"
  }
}
```

Trong `"ios"` object, thêm vào `"config"`:

```json
"config": {
  "googleMapsApiKey": "GOOGLE_MAPS_IOS_API_KEY_PLACEHOLDER"
}
```

> **Note:** Thay placeholder bằng key thực tế. Key hiện tại trong env là `EXPO_PUBLIC_GOOGLE_MAP_API_KEY` dùng cho backend proxy. Cần tạo/dùng thêm key riêng cho Maps SDK native (Android + iOS) với restrictions phù hợp cho bundle ID `com.trendcoffee.order`.

- [ ] **Step 4: Thêm Android location permissions vào app.json**

Trong `"android"."permissions"` array (hiện có `WRITE_EXTERNAL_STORAGE`), thêm:

```json
"android.permission.ACCESS_FINE_LOCATION",
"android.permission.ACCESS_COARSE_LOCATION"
```

- [ ] **Step 5: Verify typecheck vẫn pass**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app.json package.json package-lock.json
git commit -m "feat(delivery): install react-native-maps and expo-location, configure app.json"
```

---

## Task 2: `utils/decode-polyline.ts` (TDD)

**Files:**
- Create: `__tests__/utils/decode-polyline.test.ts`
- Create: `utils/decode-polyline.ts`

- [ ] **Step 1: Viết failing test**

```typescript
// __tests__/utils/decode-polyline.test.ts
import { decodePolyline } from '@/utils/decode-polyline'

describe('decodePolyline', () => {
  it('decodes a known encoded string to lat/lng pairs', () => {
    // "_p~iF~ps|U_ulLnnqC_mqNvxq`@" → 3 points (Google Maps sample)
    const result = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(result).toHaveLength(3)
    expect(result[0].latitude).toBeCloseTo(38.5, 1)
    expect(result[0].longitude).toBeCloseTo(-120.2, 1)
    expect(result[1].latitude).toBeCloseTo(40.7, 1)
    expect(result[1].longitude).toBeCloseTo(-120.95, 1)
    expect(result[2].latitude).toBeCloseTo(43.252, 1)
    expect(result[2].longitude).toBeCloseTo(-126.453, 1)
  })

  it('returns empty array for empty string', () => {
    expect(decodePolyline('')).toEqual([])
  })

  it('returns objects with latitude and longitude keys', () => {
    const result = decodePolyline('_p~iF~ps|U')
    expect(result[0]).toHaveProperty('latitude')
    expect(result[0]).toHaveProperty('longitude')
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- --testPathPattern="decode-polyline" --no-coverage
```

Expected: FAIL — `Cannot find module '@/utils/decode-polyline'`

- [ ] **Step 3: Implement decode-polyline**

```typescript
// utils/decode-polyline.ts
export function decodePolyline(
  encoded: string,
): { latitude: number; longitude: number }[] {
  if (!encoded) return []
  const result: { latitude: number; longitude: number }[] = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let b: number
    let shift = 0
    let value = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      value |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += value & 1 ? ~(value >> 1) : value >> 1

    shift = 0
    value = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      value |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += value & 1 ? ~(value >> 1) : value >> 1

    result.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }

  return result
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npm test -- --testPathPattern="decode-polyline" --no-coverage
```

Expected: PASS (3 tests passing)

- [ ] **Step 5: Commit**

```bash
git add utils/decode-polyline.ts __tests__/utils/decode-polyline.test.ts
git commit -m "feat(delivery): add decode-polyline utility"
```

---

## Task 3: Thêm DELIVERY vào `hooks/use-order-type-options.ts`

**Files:**
- Modify: `hooks/use-order-type-options.ts`
- Create: `__tests__/hooks/use-order-type-options-delivery.test.tsx`

- [ ] **Step 1: Viết failing test**

```typescript
// __tests__/hooks/use-order-type-options-delivery.test.tsx
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
)
jest.mock('@/hooks/use-branch', () => ({ useGetBranchInfoForDelivery: () => ({ data: null, isLoading: false, error: null }) }))

import { renderHook } from '@testing-library/react-native'
import { useOrderTypeOptions } from '@/hooks/use-order-type-options'
import { useGetSystemFeatureFlagsByGroup } from '@/hooks'
import { useOrderFlowStore, useUserStore } from '@/stores'
import { SystemLockFeatureChild, SystemLockFeatureType } from '@/constants'
import { OrderTypeEnum } from '@/types'

jest.mock('@/hooks', () => ({
  useGetSystemFeatureFlagsByGroup: jest.fn(),
}))
jest.mock('@/stores', () => ({
  useOrderFlowStore: jest.fn(),
  useUserStore: jest.fn(),
}))

const mockFeatureFlags = [
  {
    name: SystemLockFeatureType.CREATE_PRIVATE,
    isLocked: false,
    children: [
      { name: SystemLockFeatureChild.AT_TABLE, isLocked: false },
      { name: SystemLockFeatureChild.TAKE_OUT, isLocked: false },
      { name: SystemLockFeatureChild.DELIVERY, isLocked: false },
    ],
  },
]

beforeEach(() => {
  ;(useGetSystemFeatureFlagsByGroup as jest.Mock).mockReturnValue({
    data: { result: mockFeatureFlags },
  })
  ;(useOrderFlowStore as unknown as jest.Mock).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      setOrderingType: jest.fn(),
      getCartItems: () => ({ type: OrderTypeEnum.AT_TABLE }),
    }),
  )
  ;(useUserStore as unknown as jest.Mock).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
    sel({ userInfo: { slug: 'u1', role: { name: 'CUSTOMER' } } }),
  )
})

describe('useOrderTypeOptions — DELIVERY', () => {
  it('includes DELIVERY option when user is logged in and feature is unlocked', () => {
    const { result } = renderHook(() => useOrderTypeOptions({ enabled: true }))
    const values = result.current.orderTypes.map((t) => t.value)
    expect(values).toContain(OrderTypeEnum.DELIVERY)
  })

  it('does NOT include DELIVERY when user is not logged in', () => {
    ;(useUserStore as unknown as jest.Mock).mockImplementation((sel: (s: Record<string, unknown>) => unknown) =>
      sel({ userInfo: null }),
    )
    const { result } = renderHook(() => useOrderTypeOptions({ enabled: true }))
    const values = result.current.orderTypes.map((t) => t.value)
    expect(values).not.toContain(OrderTypeEnum.DELIVERY)
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- --testPathPattern="use-order-type-options-delivery" --no-coverage
```

Expected: FAIL — DELIVERY not in orderTypes

- [ ] **Step 3: Sửa `hooks/use-order-type-options.ts`**

Tìm `const allTypes: OrderTypeOption[]` trong file, sửa từ:

```typescript
const allTypes: OrderTypeOption[] = [
  {
    value: OrderTypeEnum.AT_TABLE,
    label: t('menu.dineIn'),
  },
  {
    value: OrderTypeEnum.TAKE_OUT,
    label: t('menu.takeAway'),
  },
]
```

Thành:

```typescript
const allTypes: OrderTypeOption[] = [
  {
    value: OrderTypeEnum.AT_TABLE,
    label: t('menu.dineIn'),
  },
  {
    value: OrderTypeEnum.TAKE_OUT,
    label: t('menu.takeAway'),
  },
]

if (isUserLoggedIn) {
  const hasDelivery = relevantParentFeature?.children?.some(
    (child) => child.name === SystemLockFeatureChild.DELIVERY,
  )
  if (hasDelivery) {
    allTypes.push({ value: OrderTypeEnum.DELIVERY, label: t('menu.delivery') })
  }
}
```

Đồng thời thêm DELIVERY vào `orderTypeToFeatureMap`:

```typescript
const orderTypeToFeatureMap: Record<string, string> = {
  [OrderTypeEnum.AT_TABLE]: SystemLockFeatureChild.AT_TABLE,
  [OrderTypeEnum.TAKE_OUT]: SystemLockFeatureChild.TAKE_OUT,
  [OrderTypeEnum.DELIVERY]: SystemLockFeatureChild.DELIVERY,
}
```

- [ ] **Step 4: Run test — verify PASS**

```bash
npm test -- --testPathPattern="use-order-type-options-delivery" --no-coverage
```

Expected: PASS (2 tests)

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add hooks/use-order-type-options.ts __tests__/hooks/use-order-type-options-delivery.test.tsx
git commit -m "feat(delivery): add DELIVERY option to useOrderTypeOptions for logged-in users"
```

---

## Task 4: `components/delivery/delivery-info-row.tsx`

**Files:**
- Create: `components/delivery/delivery-info-row.tsx`
- Create: `components/delivery/index.ts`
- Create: `__tests__/components/delivery/delivery-info-row.test.tsx`

- [ ] **Step 1: Viết failing test**

```typescript
// __tests__/components/delivery/delivery-info-row.test.tsx
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
)

import { render, fireEvent } from '@testing-library/react-native'
import { DeliveryInfoRow } from '@/components/delivery'

describe('DeliveryInfoRow', () => {
  it('renders CTA text when no address', () => {
    const { getByText } = render(
      <DeliveryInfoRow address="" onPress={jest.fn()} isDark={false} />,
    )
    expect(getByText('Chọn địa chỉ giao hàng')).toBeTruthy()
  })

  it('renders address text when address provided', () => {
    const { getByText } = render(
      <DeliveryInfoRow
        address="123 Nguyễn Trãi, Q.5"
        onPress={jest.fn()}
        isDark={false}
      />,
    )
    expect(getByText('123 Nguyễn Trãi, Q.5')).toBeTruthy()
  })

  it('calls onPress when tapped', () => {
    const onPress = jest.fn()
    const { getByTestId } = render(
      <DeliveryInfoRow address="" onPress={onPress} isDark={false} />,
    )
    fireEvent.press(getByTestId('delivery-info-row'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- --testPathPattern="delivery-info-row" --no-coverage
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement `delivery-info-row.tsx`**

```typescript
// components/delivery/delivery-info-row.tsx
import { MapPin } from 'lucide-react-native'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, StyleSheet, Text } from 'react-native'

import { colors } from '@/constants'

interface DeliveryInfoRowProps {
  address: string
  onPress: () => void
  isDark: boolean
}

export const DeliveryInfoRow = memo(function DeliveryInfoRow({
  address,
  onPress,
  isDark,
}: DeliveryInfoRowProps) {
  const { t } = useTranslation('menu')
  const hasAddress = !!address

  return (
    <Pressable
      testID="delivery-info-row"
      onPress={onPress}
      style={[
        styles.row,
        {
          borderColor: hasAddress
            ? isDark ? colors.gray[600] : colors.gray[300]
            : isDark ? colors.primary.dark : colors.primary.light,
          borderStyle: hasAddress ? 'solid' : 'dashed',
          backgroundColor: hasAddress
            ? isDark ? colors.gray[800] : colors.gray[50]
            : isDark ? `${colors.primary.dark}15` : `${colors.primary.light}10`,
        },
      ]}
    >
      <MapPin
        size={14}
        color={isDark ? colors.primary.dark : colors.primary.light}
      />
      <Text
        style={[
          styles.text,
          { color: hasAddress
            ? isDark ? colors.gray[100] : colors.gray[800]
            : isDark ? colors.primary.dark : colors.primary.light },
        ]}
        numberOfLines={1}
      >
        {hasAddress ? address : t('menu.selectDeliveryAddress', 'Chọn địa chỉ giao hàng')}
      </Text>
      {hasAddress && (
        <Text
          style={[
            styles.editLabel,
            { color: isDark ? colors.primary.dark : colors.primary.light },
          ]}
        >
          Sửa
        </Text>
      )}
    </Pressable>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
})
```

- [ ] **Step 4: Tạo barrel export**

```typescript
// components/delivery/index.ts
export { DeliveryAddressSheet } from './delivery-address-sheet'
export { DeliveryInfoRow } from './delivery-info-row'
```

> Note: `DeliveryAddressSheet` chưa tồn tại — sẽ được thêm ở Task 5. Nếu TypeScript báo lỗi, tạm thời chỉ export `DeliveryInfoRow` trước.

- [ ] **Step 5: Run test — verify PASS**

```bash
npm test -- --testPathPattern="delivery-info-row" --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add components/delivery/ __tests__/components/delivery/
git commit -m "feat(delivery): add DeliveryInfoRow component"
```

---

## Task 5: `delivery-address-sheet.tsx` — skeleton (sheet + map + branch marker)

**Files:**
- Create: `components/delivery/delivery-address-sheet.tsx`

- [ ] **Step 1: Tạo skeleton với BottomSheetModal + MapView**

```typescript
// components/delivery/delivery-address-sheet.tsx
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet'
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { MapPin, Navigation, X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { colors } from '@/constants'
import {
  useGetAddressByPlaceId,
  useGetAddressDirection,
  useGetAddressSuggestions,
  useGetDistanceAndDuration,
} from '@/hooks'
import { useGetBranchDeliveryConfig } from '@/hooks/use-branch-delivery'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import type { IAddressSuggestion } from '@/types'
import { decodePolyline } from '@/utils/decode-polyline'
import { formatCurrencyNative } from 'cart-price-calc'
import { showToast } from '@/utils'
import { PHONE_NUMBER_REGEX } from '@/constants'

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
  const { t } = useTranslation('menu')
  const sheetRef = useRef<BottomSheetModal>(null)

  // ─── Store actions (unconditional — mode won't change after mount) ──────────
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
  const { maxDistance, feePerKm } = useGetBranchDeliveryConfig(branchSlug)

  // ─── Sheet open/close ────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

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
      <View style={[styles.container, { backgroundColor: isDark ? colors.gray[900] : colors.white.light }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
            {t('menu.deliveryAddress', 'Địa chỉ giao hàng')}
          </Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={isDark ? colors.gray[400] : colors.gray[500]} />
          </Pressable>
        </View>

        {/* Map (branch marker only at this stage) */}
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
                coordinate={{ latitude: branchLocation.lat, longitude: branchLocation.lng }}
                pinColor={primaryColor}
                title="Chi nhánh"
              />
            )}
          </MapView>
        </View>

        {/* Fee note */}
        <View style={[styles.feeNote, { backgroundColor: isDark ? colors.gray[800] : '#fef9c3' }]}>
          <Text style={[styles.feeNoteText, { color: isDark ? colors.gray[300] : '#854d0e' }]}>
            ⚡ {t('menu.deliveryAddressNote', { distance: maxDistance ?? '...' })}
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
  mapContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 200,
  },
  map: {
    flex: 1,
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
```

- [ ] **Step 2: Update barrel export**

```typescript
// components/delivery/index.ts
export { DeliveryAddressSheet } from './delivery-address-sheet'
export { DeliveryInfoRow } from './delivery-info-row'
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors (react-native-maps types được cài cùng package).

- [ ] **Step 4: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx components/delivery/index.ts
git commit -m "feat(delivery): add DeliveryAddressSheet skeleton with MapView and branch marker"
```

---

## Task 6: `delivery-address-sheet` — autocomplete + suggestions

**Files:**
- Modify: `components/delivery/delivery-address-sheet.tsx`

- [ ] **Step 1: Thêm state và hooks cho autocomplete**

Trong `DeliveryAddressSheet`, thêm sau phần store actions:

```typescript
// ─── Local state ─────────────────────────────────────────────────────────────
const [addressInput, setAddressInput] = useState('')
const [queryAddress, setQueryAddress] = useState('')
const [showSuggestions, setShowSuggestions] = useState(false)
const [selectedPlaceId, setSelectedPlaceId] = useState('')
const [pendingSelection, setPendingSelection] = useState<{
  lat: number; lng: number; placeId: string; address: string
} | null>(null)

// ─── Debounce addressInput → queryAddress (300ms) ────────────────────────────
useEffect(() => {
  const timer = setTimeout(() => setQueryAddress(addressInput), 300)
  return () => clearTimeout(timer)
}, [addressInput])

// ─── Hooks ───────────────────────────────────────────────────────────────────
const suggestionsQuery = useGetAddressSuggestions(queryAddress)
const addressByPlaceIdQuery = useGetAddressByPlaceId(selectedPlaceId)

// Khi coords về từ placeId → stage pendingSelection
useEffect(() => {
  if (!addressByPlaceIdQuery.data?.result || !selectedPlaceId) return
  const { lat, lng } = addressByPlaceIdQuery.data.result
  setPendingSelection({ lat, lng, placeId: selectedPlaceId, address: addressInput })
}, [addressByPlaceIdQuery.data, selectedPlaceId, addressInput])
```

- [ ] **Step 2: Thêm search input + suggestions UI**

Thay thế `{/* Header */}` block bằng:

```typescript
{/* Header */}
<View style={styles.header}>
  <Text style={[styles.title, { color: isDark ? colors.gray[50] : colors.gray[900] }]}>
    {t('menu.deliveryAddress', 'Địa chỉ giao hàng')}
  </Text>
  <Pressable onPress={onClose} hitSlop={8}>
    <X size={20} color={isDark ? colors.gray[400] : colors.gray[500]} />
  </Pressable>
</View>

{/* Search row */}
<View style={styles.searchRow}>
  <View
    style={[
      styles.inputWrapper,
      {
        backgroundColor: isDark ? colors.gray[800] : colors.gray[50],
        borderColor: showSuggestions
          ? primaryColor
          : isDark ? colors.gray[700] : colors.gray[200],
      },
    ]}
  >
    <MapPin size={14} color={isDark ? colors.gray[400] : colors.gray[500]} />
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
      placeholder={t('menu.deliveryAddress', 'Nhập địa chỉ giao hàng...')}
      placeholderTextColor={isDark ? colors.gray[500] : colors.gray[400]}
      style={[styles.input, { color: isDark ? colors.gray[50] : colors.gray[900] }]}
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
        <X size={14} color={isDark ? colors.gray[400] : colors.gray[500]} />
      </Pressable>
    )}
  </View>
  {/* GPS button — sẽ implement ở Task 7 */}
  <Pressable style={[styles.gpsBtn, { backgroundColor: isDark ? colors.gray[800] : '#ede9fe' }]}>
    <Navigation size={16} color={primaryColor} />
  </Pressable>
</View>
```

- [ ] **Step 3: Thêm suggestions list (absolute over map)**

Thay thế `{/* Map ... */}` block:

```typescript
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
        coordinate={{ latitude: branchLocation.lat, longitude: branchLocation.lng }}
        pinColor={primaryColor}
        title="Chi nhánh"
      />
    )}
    {pendingSelection && (
      <Marker
        coordinate={{ latitude: pendingSelection.lat, longitude: pendingSelection.lng }}
        pinColor="#ef4444"
      />
    )}
  </MapView>

  {/* Suggestions overlay */}
  {showSuggestions && (
    <View
      style={[
        styles.suggestionsOverlay,
        {
          backgroundColor: isDark ? colors.gray[900] : colors.white.light,
          borderColor: isDark ? colors.gray[700] : colors.gray[200],
        },
      ]}
    >
      {suggestionsQuery.isLoading && (
        <ActivityIndicator size="small" color={primaryColor} style={{ padding: 12 }} />
      )}
      <FlatList
        data={suggestionsQuery.data?.result ?? []}
        keyExtractor={(item) => item.placePrediction.placeId}
        keyboardShouldPersistTaps="always"
        renderItem={({ item }: { item: IAddressSuggestion }) => (
          <Pressable
            onPress={() => {
              const text = item.placePrediction.text.text
              setAddressInput(text)
              setSelectedPlaceId(item.placePrediction.placeId)
              setShowSuggestions(false)
              Keyboard.dismiss()
            }}
            style={[
              styles.suggestionItem,
              { borderBottomColor: isDark ? colors.gray[800] : colors.gray[100] },
            ]}
          >
            <MapPin size={12} color={isDark ? colors.gray[400] : colors.gray[500]} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.suggestionMain, { color: isDark ? colors.gray[100] : colors.gray[900] }]}
                numberOfLines={1}
              >
                {item.placePrediction.structuredFormat.mainText.text}
              </Text>
              <Text
                style={[styles.suggestionSub, { color: isDark ? colors.gray[400] : colors.gray[500] }]}
                numberOfLines={1}
              >
                {item.placePrediction.structuredFormat.secondaryText.text}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  )}
</View>
```

- [ ] **Step 4: Thêm styles mới**

Thêm vào `StyleSheet.create`:

```typescript
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
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx
git commit -m "feat(delivery): add autocomplete search and suggestion list to DeliveryAddressSheet"
```

---

## Task 7: `delivery-address-sheet` — GPS flow

**Files:**
- Modify: `components/delivery/delivery-address-sheet.tsx`

- [ ] **Step 1: Thêm state và GPS handler**

Thêm vào phần Local state:

```typescript
const [isLocating, setIsLocating] = useState(false)
```

Thêm GPS handler trước `return`:

```typescript
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

    // Reverse geocode → address text → auto-fill input để trigger suggestions
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
      // queryAddress sẽ được set sau 300ms debounce
    }
  } catch {
    showToast('Không thể xác định vị trí')
  } finally {
    setIsLocating(false)
  }
}, [])
```

- [ ] **Step 2: Thêm import expo-location**

Ở đầu file, thêm:

```typescript
import * as Location from 'expo-location'
```

- [ ] **Step 3: Gắn handler vào GPS button**

Tìm GPS button placeholder và sửa thành:

```typescript
<Pressable
  onPress={handleGPS}
  disabled={isLocating}
  style={[
    styles.gpsBtn,
    { backgroundColor: isDark ? colors.gray[800] : '#ede9fe' },
  ]}
>
  {isLocating
    ? <ActivityIndicator size="small" color={primaryColor} />
    : <Navigation size={16} color={primaryColor} />
  }
</Pressable>
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx
git commit -m "feat(delivery): add GPS flow to DeliveryAddressSheet using expo-location"
```

---

## Task 8: `delivery-address-sheet` — distance check + route polyline + persist

**Files:**
- Modify: `components/delivery/delivery-address-sheet.tsx`

- [ ] **Step 1: Thêm deduplicate refs và distance/direction hooks**

Thêm vào phần Local state (sau `pendingSelection`):

```typescript
const lastProcessedKeyRef = useRef('')
const lastRejectedKeyRef = useRef('')

const pendingLat = pendingSelection?.lat ?? 0
const pendingLng = pendingSelection?.lng ?? 0
const hasCoords = !!pendingSelection

const distanceQuery = useGetDistanceAndDuration(branchSlug, pendingLat, pendingLng)
const directionQuery = useGetAddressDirection(branchSlug, pendingLat, pendingLng)
```

> Note: Hooks `useGetDistanceAndDuration` và `useGetAddressDirection` đã có `enabled: !!branch && !!lat && !!lng` — khi `pendingLat/pendingLng` là 0 (default) chúng sẽ tự disable.

- [ ] **Step 2: Thêm distance check effect**

```typescript
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
    showToast(
      t('cart.deliveryAddressNote', { distance: maxDistance }) ??
        `Địa chỉ cách chi nhánh quá ${maxDistance}km`,
    )
    return
  }

  if (lastProcessedKeyRef.current === key) return
  lastProcessedKeyRef.current = key

  actions.setDeliveryAddress(address)
  actions.setDeliveryCoords(lat, lng, placeId)
  actions.setDeliveryDistanceDuration(distance, duration)
}, [distanceQuery.data, pendingSelection, maxDistance, actions, t])
```

- [ ] **Step 3: Decode polyline và render route**

Thêm computed value:

```typescript
const routeCoords = useMemo(() => {
  if (!directionQuery.data?.result) return []
  return directionQuery.data.result.legs
    .flatMap((leg) => leg.steps)
    .flatMap((step) => decodePolyline(step.polyline.points))
}, [directionQuery.data])
```

Trong `MapView`, thêm `Polyline` sau 2 markers:

```typescript
{routeCoords.length > 0 && (
  <Polyline
    coordinates={routeCoords}
    strokeColor="#22c55e"
    strokeWidth={3}
  />
)}
```

- [ ] **Step 4: Thêm distance/fee info bar**

Thêm sau `{/* Fee note */}` block (và trước fee note, chỉ hiện khi có distance):

```typescript
{/* Hiện distance bar khi địa chỉ đã được persist vào store (currentAddress có giá trị) */}
{actions.currentAddress && distanceQuery.data?.result && (
  <View style={[styles.distanceBar, { backgroundColor: isDark ? '#14532d' : '#f0fdf4', borderColor: isDark ? '#166534' : '#bbf7d0' }]}>
    <Text style={[styles.distanceText, { color: isDark ? '#86efac' : '#15803d' }]}>
      📏 {distanceQuery.data.result.distance.toFixed(1)} km · ~{Math.round(distanceQuery.data.result.duration / 60)} phút
    </Text>
    <Text style={[styles.feeValue, { color: isDark ? '#86efac' : '#15803d' }]}>
      {formatCurrencyNative((distanceQuery.data.result.distance * (feePerKm ?? 0)))}
    </Text>
  </View>
)}
```

Thêm styles:

```typescript
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
feeValue: {
  fontSize: 14,
  fontWeight: '800',
},
```

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx
git commit -m "feat(delivery): add distance check, reject logic, and route polyline to DeliveryAddressSheet"
```

---

## Task 9: `delivery-address-sheet` — phone input + confirm + state restore

**Files:**
- Modify: `components/delivery/delivery-address-sheet.tsx`

- [ ] **Step 1: Thêm phone state**

Thêm vào local state:

```typescript
const [phoneInput, setPhoneInput] = useState('')
const userPhone = useUserStore((s) => s.userInfo?.phone ?? '')
const isHydrated = useOrderFlowStore((s) => s.isHydrated)
```

- [ ] **Step 2: Restore state từ store khi mount / hydrate**

```typescript
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
}, [isHydrated, visible])
```

- [ ] **Step 3: Thêm phone input + confirm button UI**

Thêm sau distance bar (trước `{/* Fee note */}`):

```typescript
{/* Phone input */}
<View style={[styles.inputWrapper, { backgroundColor: isDark ? colors.gray[800] : colors.gray[50], borderColor: isDark ? colors.gray[700] : colors.gray[200] }]}>
  <Text style={{ fontSize: 14 }}>📞</Text>
  <BottomSheetTextInput
    value={phoneInput}
    onChangeText={(text) => {
      setPhoneInput(text)
      actions.setDeliveryPhone(text)
    }}
    placeholder={t('menu.deliveryPhone', 'Số điện thoại nhận hàng')}
    placeholderTextColor={isDark ? colors.gray[500] : colors.gray[400]}
    style={[styles.input, { color: isDark ? colors.gray[50] : colors.gray[900] }]}
    keyboardType="phone-pad"
    returnKeyType="done"
  />
</View>

{/* Confirm button */}
{(() => {
  const hasAddress = !!actions.currentAddress
  const hasValidPhone = !!phoneInput && PHONE_NUMBER_REGEX.test(phoneInput)
  const canConfirm = hasAddress && hasValidPhone
  return (
    <Pressable
      onPress={() => {
        if (canConfirm) onClose()
      }}
      disabled={!canConfirm}
      style={[
        styles.confirmBtn,
        {
          backgroundColor: canConfirm ? primaryColor : isDark ? colors.gray[700] : colors.gray[300],
        },
      ]}
    >
      <Text
        style={[
          styles.confirmText,
          { color: canConfirm ? colors.white.light : isDark ? colors.gray[400] : colors.gray[500] },
        ]}
      >
        {canConfirm ? `✓ ${t('menu.confirmDeliveryAddress', 'Xác nhận địa chỉ này')}` : t('menu.deliveryInfoMissing', 'Thiếu thông tin giao hàng')}
      </Text>
    </Pressable>
  )
})()}
```

Thêm styles:

```typescript
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
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx
git commit -m "feat(delivery): add phone input, confirm button, and state restore to DeliveryAddressSheet"
```

---

## Task 10: Thêm Delivery option vào `cart-order-type-sheet.tsx`

**Files:**
- Modify: `components/cart/cart-order-type-sheet.tsx`

- [ ] **Step 1: Import Truck icon và thêm vào icon map**

Tìm dòng:

```typescript
const Icon = opt.value === 'take-out' ? PackageCheck : UtensilsCrossed
```

Sửa thành:

```typescript
import { PackageCheck, Truck, UtensilsCrossed } from 'lucide-react-native'

// ...

const Icon =
  opt.value === 'take-out'
    ? PackageCheck
    : opt.value === 'delivery'
      ? Truck
      : UtensilsCrossed
```

> Tìm dòng import `{ PackageCheck, UtensilsCrossed }` ở đầu file và thêm `Truck` vào.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/cart/cart-order-type-sheet.tsx
git commit -m "feat(delivery): add Truck icon for Delivery option in order type sheet"
```

---

## Task 11: `cart-footer.tsx` — tích hợp Delivery

**Files:**
- Modify: `components/cart/cart-footer.tsx`

- [ ] **Step 1: Import thêm các dependencies**

Thêm vào imports hiện có:

```typescript
import { DeliveryAddressSheet, DeliveryInfoRow } from '@/components/delivery'
import { useCalculateDeliveryFee } from '@/hooks/use-branch-delivery'
import {
  useOrderFlowDeliveryAddress,
  useOrderFlowDeliveryPhone,
} from '@/stores/selectors/order-flow.selectors'
import { PHONE_NUMBER_REGEX } from '@/constants'
import { parseKm } from '@/utils'
```

> Note: Nếu `useOrderFlowDeliveryAddress` và `useOrderFlowDeliveryPhone` chưa tồn tại trong selectors, thêm chúng:
>
> ```typescript
> // stores/selectors/order-flow.selectors.ts — thêm vào file
> export const useOrderFlowDeliveryAddress = () =>
>   useOrderFlowStore((s) => s.orderingData?.deliveryAddress ?? '')
> export const useOrderFlowDeliveryPhone = () =>
>   useOrderFlowStore((s) => s.orderingData?.deliveryPhone ?? '')
> export const useOrderFlowDeliveryDistance = () =>
>   useOrderFlowStore((s) => s.orderingData?.deliveryDistance ?? 0)
> ```

- [ ] **Step 2: Thêm state và computed values**

Trong `CartFooter`, thêm sau khai báo `[tableSheetVisible, setTableSheetVisible]`:

```typescript
const [deliverySheetVisible, setDeliverySheetVisible] = useState(false)
const deliveryAddress = useOrderFlowDeliveryAddress()
const deliveryPhone = useOrderFlowDeliveryPhone()
const deliveryDistance = useOrderFlowDeliveryDistance()
const branchSlug = useBranchStore((s) => s.branch?.slug) ?? ''

const { deliveryFee } = useCalculateDeliveryFee(
  parseKm(deliveryDistance) ?? 0,
  branchSlug,
  { enabled: orderType === 'delivery' && deliveryDistance > 0 },
)

const openDeliverySheet = useCallback(() => setDeliverySheetVisible(true), [])
const closeDeliverySheet = useCallback(() => setDeliverySheetVisible(false), [])
```

- [ ] **Step 3: Cập nhật `isOrderDisabled`**

Tìm:

```typescript
const isOrderDisabled = showTableSelect && !tableName
```

Sửa thành:

```typescript
const needsDeliveryInfo =
  orderType === 'delivery' &&
  (!deliveryAddress ||
    !deliveryPhone ||
    !PHONE_NUMBER_REGEX.test(deliveryPhone))

const isOrderDisabled = (showTableSelect && !tableName) || needsDeliveryInfo
```

- [ ] **Step 4: Thêm DeliveryInfoRow vào render**

Tìm `{showTableSelect && (` block (table select row), thêm **sau** nó:

```typescript
{orderType === 'delivery' && (
  <DeliveryInfoRow
    address={deliveryAddress}
    onPress={openDeliverySheet}
    isDark={isDark}
  />
)}
```

- [ ] **Step 5: Cập nhật total để cộng delivery fee**

Tìm `const finalTotal = total - voucherDiscount` và sửa thành:

```typescript
const finalTotal = total - voucherDiscount + (deliveryFee ?? 0)
```

Và trong total display, thêm fee note nếu có:

```typescript
// Sau <Text style={[footerStyles.totalValue, ...]}>
{orderType === 'delivery' && (deliveryFee ?? 0) > 0 && (
  <Text style={[footerStyles.deliveryFeeNote, ft.mutedColor]}>
    (+{formatCurrencyNative(deliveryFee ?? 0)} ship)
  </Text>
)}
```

Thêm style:

```typescript
deliveryFeeNote: {
  fontSize: 10,
  marginTop: 1,
},
```

- [ ] **Step 6: Mount DeliveryAddressSheet**

Tìm `<VoucherSheet .../>` ở cuối render và thêm sau:

```typescript
<DeliveryAddressSheet
  visible={deliverySheetVisible}
  onClose={closeDeliverySheet}
  mode="cart"
  branchSlug={branchSlug}
  isDark={isDark}
  primaryColor={primaryColor}
/>
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/cart/cart-footer.tsx stores/selectors/order-flow.selectors.ts
git commit -m "feat(delivery): integrate DeliveryAddressSheet into CartFooter with fee calculation"
```

---

## Task 12: `update-order-footer.tsx` — tích hợp Delivery

**Files:**
- Modify: `app/update-order/components/update-order-footer.tsx`

- [ ] **Step 1: Import thêm dependencies**

```typescript
import { DeliveryAddressSheet, DeliveryInfoRow } from '@/components/delivery'
import { useCalculateDeliveryFee } from '@/hooks/use-branch-delivery'
import { PHONE_NUMBER_REGEX } from '@/constants'
import { parseKm } from '@/utils'
```

- [ ] **Step 2: Thêm delivery state và computed values**

Trong component, thêm sau khai báo `draft`:

```typescript
const [deliverySheetVisible, setDeliverySheetVisible] = useState(false)
const draftDeliveryAddress = draft?.deliveryAddress ?? ''
const draftDeliveryPhone = draft?.deliveryPhone ?? ''
const draftDeliveryDistance = draft?.deliveryDistance ?? 0

const { deliveryFee } = useCalculateDeliveryFee(
  parseKm(draftDeliveryDistance) ?? 0,
  branchSlug ?? '',
  { enabled: orderType === OrderTypeEnum.DELIVERY && draftDeliveryDistance > 0 },
)

const openDeliverySheet = useCallback(() => setDeliverySheetVisible(true), [])
const closeDeliverySheet = useCallback(() => setDeliverySheetVisible(false), [])

const needsDeliveryInfo =
  orderType === OrderTypeEnum.DELIVERY &&
  (!draftDeliveryAddress ||
    !draftDeliveryPhone ||
    !PHONE_NUMBER_REGEX.test(draftDeliveryPhone))
```

- [ ] **Step 3: Thêm DeliveryInfoRow trong render**

Tìm chỗ hiển thị `showTableSelect` row (order type + table select), thêm sau nó:

```typescript
{orderType === OrderTypeEnum.DELIVERY && (
  <DeliveryInfoRow
    address={draftDeliveryAddress}
    onPress={openDeliverySheet}
    isDark={isDark}
  />
)}
```

- [ ] **Step 4: Cập nhật confirm button disabled state**

Tìm nơi `ConfirmUpdateOrderDialog` hoặc confirm button nhận disabled prop, thêm điều kiện `needsDeliveryInfo` vào.

- [ ] **Step 5: Cập nhật finalTotal với delivery fee từ địa chỉ mới**

File hiện tại có `deliveryFee = originalOrder?.deliveryFee ?? 0` (line 52). Thay bằng:

```typescript
// Ưu tiên fee từ địa chỉ mới (draft); fallback về originalOrder.deliveryFee
const effectiveDeliveryFee =
  orderType === OrderTypeEnum.DELIVERY && draftDeliveryDistance > 0
    ? (deliveryFee ?? originalOrder?.deliveryFee ?? 0)
    : (originalOrder?.deliveryFee ?? 0)
```

Sau đó sửa dòng tính `finalTotal` (line 86-87):

```typescript
const finalTotal =
  (cartTotals?.finalTotal ?? 0) + effectiveDeliveryFee - accumulatedPointsToUse
```

Và trong render tại `{formatCurrencyNative(finalTotal)}`, thêm fee note bên dưới khi delivery:

```typescript
{orderType === OrderTypeEnum.DELIVERY && effectiveDeliveryFee > 0 && (
  <Text style={[f.deliveryFeeNote, ft.mutedColor]}>
    (+{formatCurrencyNative(effectiveDeliveryFee)} ship)
  </Text>
)}
```

Thêm style `deliveryFeeNote: { fontSize: 10, marginTop: 1 }` vào StyleSheet.

- [ ] **Step 6: Mount DeliveryAddressSheet**

```typescript
<DeliveryAddressSheet
  visible={deliverySheetVisible}
  onClose={closeDeliverySheet}
  mode="update-order"
  branchSlug={branchSlug ?? ''}
  isDark={isDark}
  primaryColor={primaryColor}
/>
```

- [ ] **Step 7: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add app/update-order/components/update-order-footer.tsx
git commit -m "feat(delivery): integrate DeliveryAddressSheet into UpdateOrderFooter"
```

---

## Task 13: `order-info-section.tsx` — hiển thị delivery info trong confirm dialog

**Files:**
- Modify: `components/dialog/order-info-section.tsx`

- [ ] **Step 1: Đọc file hiện tại**

```bash
cat components/dialog/order-info-section.tsx
```

- [ ] **Step 2: Thêm delivery info section**

Tìm chỗ render order type info (thường là Text hiển thị `order.type`), thêm sau đó:

```typescript
{order?.type === OrderTypeEnum.DELIVERY && (
  <>
    <View style={orderInfoStyles.row}>
      <Text style={[orderInfoStyles.label, { color: mutedColor }]}>
        {t('menu.deliveryAddress', 'Địa chỉ giao hàng')}
      </Text>
      <Text
        style={[orderInfoStyles.value, { color: textColor }]}
        numberOfLines={2}
      >
        {order.deliveryAddress || '—'}
      </Text>
    </View>
    <View style={orderInfoStyles.row}>
      <Text style={[orderInfoStyles.label, { color: mutedColor }]}>
        {t('menu.deliveryPhone', 'SĐT nhận hàng')}
      </Text>
      <Text style={[orderInfoStyles.value, { color: textColor }]}>
        {order.deliveryPhone || '—'}
      </Text>
    </View>
  </>
)}
```

> Dùng đúng style names đang có trong file (đọc file trước ở Step 1 để confirm tên styles).

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/dialog/order-info-section.tsx
git commit -m "feat(delivery): show delivery address and phone in order confirm dialog"
```

---

## Final: Full check

- [ ] **Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Run lint**

```bash
npm run lint
```

Expected: no errors / warnings.

- [ ] **Run tests**

```bash
npm test --no-coverage
```

Expected: all tests pass.
