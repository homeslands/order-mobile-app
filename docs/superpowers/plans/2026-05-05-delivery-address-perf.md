# Delivery Address Performance Optimizations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate per-keystroke re-renders, store mutations, and MapView reconciliation when user types a phone number in the delivery address confirmation view.

**Architecture:** Seven independent, incremental changes across four files — each committed separately. No new files created. Changes are isolated: query hook staleTime, store subscription granularity, and DeliveryAddressSheet internal component extraction. The largest refactor is splitting `delivery-address-sheet.tsx` into focused sub-components (`SheetFooterInner`, `DeliveryMap`, `SuggestionItem`) defined at module scope above the main component.

**Tech Stack:** React Native, React 19, Zustand (`useShallow`), `@gorhom/bottom-sheet`, `react-native-maps`, TanStack React Query, TypeScript strict

---

## File Map

| File                                                  | Change                                                                                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/use-order.ts`                                  | Add `staleTime` to 4 delivery query hooks                                                                                        |
| `components/cart/cart-footer.tsx`                     | Replace 3 separate store subscriptions with `useOrderFlowCartFooterData`; replace `useSafeAreaInsets` with `STATIC_BOTTOM_INSET` |
| `app/update-order/components/update-order-footer.tsx` | Replace whole-object `updatingData` subscription with granular `draft`/`originalOrder` subscriptions                             |
| `components/delivery/delivery-address-sheet.tsx`      | (4 tasks) phone debounce, SheetFooterInner extraction, DeliveryMap extraction, misc cleanup                                      |

---

## Task 1: staleTime for delivery query hooks

**Files:**

- Modify: `hooks/use-order.ts:337–375`

Context: The 4 delivery query hooks (`useGetAddressSuggestions`, `useGetAddressByPlaceId`, `useGetAddressDirection`, `useGetDistanceAndDuration`) have no `staleTime`, so they re-fetch every time the sheet is closed and re-opened. Address coordinates and route data don't change between sheet openings.

- [ ] **Step 1: Open file and locate the 4 hooks**

The hooks are at lines 337–375. No imports to add — just add `staleTime` to each `useQuery` call.

- [ ] **Step 2: Add staleTime to all 4 hooks**

Replace the 4 hook bodies:

```typescript
export const useGetAddressSuggestions = (address: string) => {
  return useQuery({
    queryKey: [QUERYKEY.addressSuggestions, address],
    queryFn: () => getAddressSuggestions(address),
    enabled: !!address,
    staleTime: 60_000,
  })
}

export const useGetAddressByPlaceId = (placeId: string) => {
  return useQuery({
    queryKey: [QUERYKEY.addressByPlaceId, placeId],
    queryFn: () => getAddressByPlaceId(placeId),
    enabled: !!placeId,
    staleTime: 5 * 60_000,
  })
}

export const useGetAddressDirection = (
  branch: string,
  lat: number,
  lng: number,
) => {
  return useQuery({
    queryKey: [QUERYKEY.addressDirection, branch, lat, lng],
    queryFn: () => getAddressDirection(branch, lat, lng),
    enabled: !!branch && !!lat && !!lng,
    staleTime: 5 * 60_000,
  })
}

export const useGetDistanceAndDuration = (
  branch: string,
  lat: number,
  lng: number,
) => {
  return useQuery({
    queryKey: [QUERYKEY.distanceAndDuration, branch, lat, lng],
    queryFn: () => getDistanceAndDuration(branch, lat, lng),
    enabled: !!branch && !!lat && !!lng,
    staleTime: 5 * 60_000,
  })
}
```

- [ ] **Step 3: Verify typecheck + lint**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add hooks/use-order.ts
git commit -m "perf(delivery): add staleTime to delivery query hooks to prevent re-fetch on sheet reopen"
```

---

## Task 2: CartFooter — consolidate store subscriptions + STATIC_BOTTOM_INSET

**Files:**

- Modify: `components/cart/cart-footer.tsx`

Context: `CartFooter` currently has 3 separate store subscriptions for `orderType`, `tableName`, `deliveryDistance`, plus 2 raw `useOrderFlowStore` calls for `deliveryAddress` and `deliveryPhone`. The selector `useOrderFlowCartFooterData` returns all 5 in one shallow-compared subscription. Also replaces `useSafeAreaInsets()` hook with static constant.

- [ ] **Step 1: Update imports**

Current imports block (lines 1–45). Make these two changes:

1. Remove `useSafeAreaInsets` from the `react-native-safe-area-context` import (line 38) — remove the entire line since it's the only import from that package.

2. Add `STATIC_BOTTOM_INSET` to the existing `@/constants/status-bar` import (line 13):

```typescript
import {
  FOOTER_BOTTOM_EXTRA,
  STATIC_BOTTOM_INSET,
} from '@/constants/status-bar'
```

3. Add `useOrderFlowCartFooterData` to the existing `@/stores/selectors/order-flow.selectors` import (lines 25–28):

```typescript
import {
  useOrderFlowCartFooterData,
  useOrderFlowDeliveryDistance,
  useOrderFlowOrderType,
  useOrderFlowTableName,
} from '@/stores/selectors/order-flow.selectors'
```

(Keep the existing 3 selector imports for now — we'll remove unused ones after.)

- [ ] **Step 2: Replace subscriptions and bottomInset**

Inside `CartFooter`, replace these lines (approximately lines 79–98):

```typescript
// BEFORE
const { bottom: bottomInset } = useSafeAreaInsets()
...
const orderType = useOrderFlowOrderType()
const tableName = useOrderFlowTableName()
...
const deliveryDistance = useOrderFlowDeliveryDistance()
const deliveryAddress = useOrderFlowStore(
  (s) => s.orderingData?.deliveryAddress ?? '',
)
const deliveryPhone = useOrderFlowStore(
  (s) => s.orderingData?.deliveryPhone ?? '',
)
```

```typescript
// AFTER
const bottomInset = STATIC_BOTTOM_INSET
...
const {
  type: orderType,
  tableName,
  deliveryDistance,
  deliveryAddress,
  deliveryPhone,
} = useOrderFlowCartFooterData()
```

`useOrderFlowCartFooterData` returns `deliveryAddress` and `deliveryPhone` as `string | undefined`. Since the old code had `?? ''`, the component already handles falsy values correctly (e.g., `needsDeliveryInfo` check, `DeliveryInfoRow` props). No use-site changes needed — existing `??` guards in the JSX cover undefined.

- [ ] **Step 3: Remove now-unused selector imports**

Remove `useOrderFlowDeliveryDistance`, `useOrderFlowOrderType`, `useOrderFlowTableName` from the selectors import if they're no longer used elsewhere in the file.

Also remove the `useOrderFlowStore` import line if no other `useOrderFlowStore` calls remain (check: `setOrderingType`, `validate` callback uses `useOrderFlowStore.getState()` — keep import).

After editing, the selectors import should be:

```typescript
import { useOrderFlowCartFooterData } from '@/stores/selectors/order-flow.selectors'
```

- [ ] **Step 4: Verify typecheck + lint**

```bash
npm run check
```

Expected: no errors. If lint reports unused imports, remove them.

- [ ] **Step 5: Commit**

```bash
git add components/cart/cart-footer.tsx
git commit -m "perf(cart): consolidate store subscriptions and replace useSafeAreaInsets with STATIC_BOTTOM_INSET"
```

---

## Task 3: UpdateOrderFooter — granular store subscription

**Files:**

- Modify: `app/update-order/components/update-order-footer.tsx`

Context: The footer subscribes to the entire `updatingData` object (line 47), which re-renders the footer (including `calculateOrderDisplayAndTotals`) whenever any field inside `updatingData` changes — including unrelated fields like `originalOrder`. Fix: subscribe directly to `updateDraft` and `originalOrder` as separate shallow-compared slices.

- [ ] **Step 1: Add useShallow import**

The file currently imports from `'@/stores'` but not `useShallow`. Add to imports:

```typescript
import { useShallow } from 'zustand/react/shallow'
```

- [ ] **Step 2: Replace the updatingData subscription**

Current (lines 47–48):

```typescript
const updatingData = useOrderFlowStore((s) => s.updatingData)
const removeDraftVoucher = useOrderFlowStore((s) => s.removeDraftVoucher)
```

Replace with:

```typescript
const draft = useOrderFlowStore(useShallow((s) => s.updatingData?.updateDraft))
const originalOrder = useOrderFlowStore(
  useShallow((s) => s.updatingData?.originalOrder),
)
const removeDraftVoucher = useOrderFlowStore((s) => s.removeDraftVoucher)
```

- [ ] **Step 3: Update references to updatingData**

Remove these two lines that used to derive `draft` and `originalOrder` from `updatingData`:

```typescript
// DELETE these two lines:
const draft = updatingData?.updateDraft
const originalOrder = updatingData?.originalOrder
```

`draft` and `originalOrder` are now directly from the store subscriptions — all existing references to `draft` and `originalOrder` in the component body continue to work unchanged.

- [ ] **Step 4: Verify typecheck + lint**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/update-order/components/update-order-footer.tsx
git commit -m "perf(update-order): subscribe to updateDraft and originalOrder directly instead of entire updatingData"
```

---

## Task 4: DeliveryAddressSheet — phone debounce + renderFooter decoupling

**Files:**

- Modify: `components/delivery/delivery-address-sheet.tsx`

Context: The `onChangeText` handler on the phone input (line 537) calls `actions.setDeliveryPhone(text)` on every keystroke. This triggers store mutations that cause `CartFooter` and `UpdateOrderFooter` to re-render 10 times per phone entry. Additionally, `renderFooter` recreates on every keystroke because `phoneInput` is in its deps (line 393). Fix: buffer phone in local state; flush to store only when complete or on blur. Remove `phoneInput` from `renderFooter` deps using a ref.

- [ ] **Step 1: Add phoneInputRef below existing refs**

After the existing `mountTextRef` ref (around line 122), add:

```typescript
const phoneInputRef = useRef(phoneInput)
useEffect(() => {
  phoneInputRef.current = phoneInput
}, [phoneInput])
```

- [ ] **Step 2: Add stable phone handlers**

After the `handleAddressClear` callback (around line 175), add:

```typescript
const handlePhoneChange = useCallback(
  (text: string) => {
    setPhoneInput(text)
    // Only write to store when complete (10 digits) or cleared — prevents
    // per-keystroke store mutations that trigger CartFooter/UpdateOrderFooter re-renders
    if (!text || PHONE_NUMBER_REGEX.test(text)) {
      actions.setDeliveryPhone(text)
    }
  },
  [actions],
)

const handlePhoneBlur = useCallback(() => {
  // Final sync on blur covers partial entries user leaves without completing
  actions.setDeliveryPhone(phoneInputRef.current)
}, [actions])
```

- [ ] **Step 3: Update phone input JSX to use new handlers**

Locate the `BottomSheetTextInput` for phone input (around line 535). Replace its `onChangeText` and add `onBlur`:

```tsx
// BEFORE (line 537):
onChangeText={(text) => { setPhoneInput(text); actions.setDeliveryPhone(text) }}

// AFTER:
onChangeText={handlePhoneChange}
onBlur={handlePhoneBlur}
```

- [ ] **Step 4: Update the phone clear button**

The clear button onPress (around line 547) currently writes `actions.setDeliveryPhone('')` directly. This is fine (intentional flush) — no change needed there.

- [ ] **Step 5: Decouple renderFooter from phoneInput**

Add a `handleConfirm` callback before `renderFooter`. Replace the existing `renderFooter` (lines 362–394):

```typescript
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
```

`phoneInput` is no longer in `renderFooter`'s deps — it reads via `phoneInputRef`. `renderFooter` now only recreates when theme, confirm-ability, or handlers change (not on every keystroke).

- [ ] **Step 6: Verify typecheck + lint**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx
git commit -m "perf(delivery): debounce phone store writes and decouple renderFooter from phoneInput state"
```

---

## Task 5: DeliveryAddressSheet — extract DeliveryMap memo component

**Files:**

- Modify: `components/delivery/delivery-address-sheet.tsx`

Context: `MapView`, `Marker`s, and `Polyline` live in the same render scope as `phoneInput`. Every keystroke causes the map tree to reconcile. Extracting into a `memo` component with stable props eliminates this entirely. `mapRef` is forwarded via `forwardRef`. `branchLat`/`branchLng` are memoized to prevent `parseFloat(String(...))` running on every render.

- [ ] **Step 1: Add forwardRef to react import**

Current import (line 13):

```typescript
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

Add `forwardRef`:

```typescript
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
```

- [ ] **Step 2: Add DeliveryMap component above DeliveryAddressSheet**

Insert this entire block before the `DeliveryAddressSheet` component declaration (before line 53):

```typescript
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
```

- [ ] **Step 3: Memoize branchLat and branchLng**

Locate the two `parseFloat` calls (lines 401–402):

```typescript
const branchLat = parseFloat(String(branchLocation?.lat ?? 10.7769))
const branchLng = parseFloat(String(branchLocation?.lng ?? 106.7009))
```

Replace with:

```typescript
const branchLat = useMemo(
  () => parseFloat(String(branchLocation?.lat ?? 10.7769)),
  [branchLocation?.lat],
)
const branchLng = useMemo(
  () => parseFloat(String(branchLocation?.lng ?? 106.7009)),
  [branchLocation?.lng],
)
```

- [ ] **Step 4: Replace MapView JSX with DeliveryMap**

Locate the `<View style={[f.mapContainer, ...]}> ... </View>` block in CONFIRMATION VIEW (lines 448–486). Replace it:

```tsx
{
  /* Map */
}
;<View style={[f.mapContainer, { borderColor: borderDefault }]}>
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
```

- [ ] **Step 5: Verify typecheck + lint**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx
git commit -m "perf(delivery): extract DeliveryMap as memo component to isolate MapView from phone input re-renders"
```

---

## Task 6: DeliveryAddressSheet — extract SuggestionItem + misc cleanup

**Files:**

- Modify: `components/delivery/delivery-address-sheet.tsx`

Context: Suggestion items have inline lambdas inside `.map()` — a new closure per item per render. Extract `SuggestionItem` as a memo'd component with a stable `onSelect` callback. Also: memoize `phoneIsValid`, fix `addressByPlaceIdQuery` effect's `addressInput` dep using a ref, replace `useSafeAreaInsets` with `STATIC_BOTTOM_INSET`, memoize the `actions` object.

- [ ] **Step 1: Replace useSafeAreaInsets with STATIC_BOTTOM_INSET**

Remove the `useSafeAreaInsets` import (line 24):

```typescript
// DELETE:
import { useSafeAreaInsets } from 'react-native-safe-area-context'
```

Add `STATIC_BOTTOM_INSET` to the existing `@/constants/status-bar` import. Currently there is no import from that path in delivery-address-sheet.tsx, so add:

```typescript
import { STATIC_BOTTOM_INSET } from '@/constants/status-bar'
```

Replace line 62:

```typescript
// BEFORE:
const { bottom: bottomInset } = useSafeAreaInsets()

// AFTER:
const bottomInset = STATIC_BOTTOM_INSET
```

- [ ] **Step 2: Add SuggestionItem component above DeliveryAddressSheet**

Insert this block before the `DeliveryAddressSheet` component declaration (after the `DeliveryMap` block from Task 5):

```typescript
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
```

- [ ] **Step 3: Add addressInputRef and use in addressByPlaceIdQuery effect**

After the `mountTextRef` ref, add:

```typescript
const addressInputRef = useRef(addressInput)
useEffect(() => {
  addressInputRef.current = addressInput
}, [addressInput])
```

Replace the `addressByPlaceIdQuery` effect (lines 134–143):

```typescript
// BEFORE:
useEffect(() => {
  if (!addressByPlaceIdQuery.data?.result || !selectedPlaceId) return
  const { lat, lng } = addressByPlaceIdQuery.data.result
  setPendingSelection({
    lat: parseFloat(String(lat)),
    lng: parseFloat(String(lng)),
    placeId: selectedPlaceId,
    address: addressInput,
  })
}, [addressByPlaceIdQuery.data, selectedPlaceId, addressInput])

// AFTER:
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
```

- [ ] **Step 4: Memoize phoneIsValid**

Locate lines 332–342:

```typescript
const phoneIsInvalid = !!phoneInput && !PHONE_NUMBER_REGEX.test(phoneInput)
const canConfirm =
  !!actions.currentAddress &&
  !!phoneInput &&
  PHONE_NUMBER_REGEX.test(phoneInput)
```

Replace with:

```typescript
const phoneIsValid = useMemo(
  () => !!phoneInput && PHONE_NUMBER_REGEX.test(phoneInput),
  [phoneInput],
)
const phoneIsInvalid = !!phoneInput && !phoneIsValid
const canConfirm = !!actions.currentAddress && phoneIsValid
```

- [ ] **Step 5: Add stable handleSelectSuggestion callback and use SuggestionItem**

After `handleAddressClear` callback, add:

```typescript
const handleSelectSuggestion = useCallback(
  (placeId: string, text: string) => {
    setAddressText(text)
    setSelectedPlaceId(placeId)
    setShowSuggestions(false)
    Keyboard.dismiss()
  },
  [setAddressText],
)
```

In the render, replace the `{(suggestionsQuery.data?.result ?? []).map(...)}` block (lines 629–652) with:

```tsx
{
  ;(suggestionsQuery.data?.result ?? []).map((item: IAddressSuggestion) => (
    <SuggestionItem
      key={item.placePrediction.placeId}
      item={item}
      onSelect={handleSelectSuggestion}
      isDark={isDark}
    />
  ))
}
```

- [ ] **Step 6: Verify typecheck + lint**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/delivery/delivery-address-sheet.tsx
git commit -m "perf(delivery): extract SuggestionItem, memoize phoneIsValid, fix addressInputRef, use STATIC_BOTTOM_INSET"
```

---

## Post-implementation smoke test

After all tasks are complete, manually verify:

1. Open app in delivery mode (cart footer → delivery order type)
2. Open delivery address sheet
3. Type an address → select a suggestion → verify map appears and route loads
4. Type in the phone field → observe: map does NOT visually stutter, confirm button style updates correctly at 10 digits
5. Tap confirm → sheet closes, delivery info row shows address + phone
6. Re-open the sheet → verify address and phone are pre-populated (state restore)
7. Tap "Sửa địa chỉ" → verify SELECTION VIEW reappears with previous address in input
8. In update-order flow: add a new item → footer total updates correctly

```bash
npm run check
```

Expected: 0 TypeScript errors, 0 ESLint errors.
