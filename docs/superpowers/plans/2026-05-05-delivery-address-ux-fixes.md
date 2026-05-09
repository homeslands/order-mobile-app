# Delivery Address UX Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 UX gaps in the delivery address selection feature: partial state persisting when closing the sheet without completing the form, delivery fields not clearing when switching order type away from DELIVERY, and missing delivery phone on the payment screen.

**Architecture:** All fixes are contained in existing files — no new files except one test file. Task 1 adds guard logic to the `closeDeliverySheet` callback in two parent components. Task 2 adds a `deliveryClear` spread to two store type-change methods. Task 3 adds one JSX row in the payment info card.

**Tech Stack:** Zustand (direct `getState()` / `setState()` access), React Native + TypeScript strict, Jest + `@testing-library/react-native`

---

## Files

| File                                                  | Change                                                                     |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| `components/cart/cart-footer.tsx`                     | `closeDeliverySheet` clears incomplete delivery state on dismiss           |
| `app/update-order/components/update-order-footer.tsx` | Same for update-order context                                              |
| `stores/order-flow.store.ts`                          | `setOrderingType` clears delivery fields when switching away from DELIVERY |
| `stores/slices/updating-table.slice.ts`               | `setDraftType` clears delivery fields when switching away from DELIVERY    |
| `app/payment/payment-order-info-card.tsx`             | Add `deliveryPhone` row for delivery orders                                |
| `__tests__/stores/delivery-clearing.test.ts`          | Unit tests for slice behavior (new file)                                   |

---

## Task 1: Clear partial delivery state when closing address sheet without confirming

**Problem:** If a user selects an address but closes the sheet before entering a valid phone number (backdrop tap, header X), the partial state (`deliveryAddress` without valid `deliveryPhone`) persists in the store. When the sheet reopens it restores the broken state.

**Fix location:** The `closeDeliverySheet` callback in the two parent components. After hiding the sheet, check if the store has an address without a valid phone — if so, call `clearDeliveryInfo()` to wipe the partial state.

**Note:** This only clears when `address exists AND phone is invalid/missing`. If both are valid (user confirmed correctly), state is preserved.

**Files:**

- Modify: `components/cart/cart-footer.tsx:5-11, 128-131`
- Modify: `app/update-order/components/update-order-footer.tsx:7, 152-155`

---

- [ ] **Step 1: Add `PHONE_NUMBER_REGEX` to cart-footer.tsx constants import**

In `components/cart/cart-footer.tsx`, the existing `@/constants` import is on lines 5-11. Add `PHONE_NUMBER_REGEX`:

```typescript
import {
  colors,
  PHONE_NUMBER_REGEX,
  QUERYKEY,
  SystemLockFeatureChild,
  SystemLockFeatureGroup,
  SystemLockFeatureType,
} from '@/constants'
```

---

- [ ] **Step 2: Update `closeDeliverySheet` in `components/cart/cart-footer.tsx`**

The current callback on lines 128-131:

```typescript
const closeDeliverySheet = useCallback(() => setDeliverySheetVisible(false), [])
```

Replace with:

```typescript
const closeDeliverySheet = useCallback(() => {
  setDeliverySheetVisible(false)
  const s = useOrderFlowStore.getState()
  const addr = s.orderingData?.deliveryAddress ?? ''
  const phone = s.orderingData?.deliveryPhone ?? ''
  if (addr && !PHONE_NUMBER_REGEX.test(phone)) {
    s.clearDeliveryInfo()
  }
}, [])
```

---

- [ ] **Step 3: Add `PHONE_NUMBER_REGEX` to update-order-footer.tsx constants import**

In `app/update-order/components/update-order-footer.tsx`, the existing `@/constants` import on line 7:

```typescript
import { colors } from '@/constants'
```

Replace with:

```typescript
import { colors, PHONE_NUMBER_REGEX } from '@/constants'
```

---

- [ ] **Step 4: Update `closeDeliverySheet` in `app/update-order/components/update-order-footer.tsx`**

The current callback on lines 152-155:

```typescript
const closeDeliverySheet = useCallback(() => setDeliverySheetVisible(false), [])
```

Replace with:

```typescript
const closeDeliverySheet = useCallback(() => {
  setDeliverySheetVisible(false)
  const s = useOrderFlowStore.getState()
  const addr = s.updatingData?.updateDraft?.deliveryAddress ?? ''
  const phone = s.updatingData?.updateDraft?.deliveryPhone ?? ''
  if (addr && !PHONE_NUMBER_REGEX.test(phone)) {
    s.clearDraftDeliveryInfo()
  }
}, [])
```

---

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. (`clearDeliveryInfo` and `clearDraftDeliveryInfo` both exist on `IOrderFlowStore`; `PHONE_NUMBER_REGEX` is `export * from './regex'` via `constants/index.ts`.)

---

- [ ] **Step 6: Manual test — dismiss without phone clears state (cart)**

1. Open cart, set order type to DELIVERY
2. Open address sheet
3. Search and select an address — confirm button should appear (but phone field is empty)
4. Close the sheet by tapping the backdrop (do NOT tap confirm)
5. Reopen the address sheet
6. Expected: address input is empty — partial state was wiped

---

- [ ] **Step 7: Manual test — confirm path is not broken (cart)**

1. Open address sheet
2. Select address AND enter a valid 10-digit phone
3. Tap "Xác nhận địa chỉ này"
4. Sheet closes; `DeliveryInfoRow` shows the saved address
5. Reopen sheet
6. Expected: address and phone are restored (valid state preserved)

---

- [ ] **Step 8: Commit**

```bash
git add components/cart/cart-footer.tsx app/update-order/components/update-order-footer.tsx
git commit -m "fix(delivery): clear incomplete delivery state on sheet dismiss without confirming"
```

---

## Task 2: Clear delivery fields when switching order type away from DELIVERY

**Problem:** When a user switches order type from DELIVERY → TAKE_OUT (or AT_TABLE) → back to DELIVERY, the previously entered delivery address and phone repopulate. The store's `setOrderingType` and `setDraftType` do not clear delivery fields on non-DELIVERY transitions.

**Fix:** In both methods, compute a `deliveryClear` object when `type !== DELIVERY` and spread it into the updated state.

**Files:**

- Create: `__tests__/stores/delivery-clearing.test.ts`
- Modify: `stores/order-flow.store.ts:254-292`
- Modify: `stores/slices/updating-table.slice.ts:48-70`

---

- [ ] **Step 1: Create failing test file**

Create `__tests__/stores/delivery-clearing.test.ts`:

```typescript
// Tests the slice-level setDraftType delivery-clearing behavior.
// Uses createUpdatingTableMethods directly — no store hydration needed.

import { createUpdatingTableMethods } from '@/stores/slices/updating-table.slice'
import { OrderTypeEnum } from '@/types'

const DELIVERY_DRAFT = {
  id: 'test',
  slug: 'order-1',
  productSlug: '',
  status: 'PENDING' as any,
  type: OrderTypeEnum.DELIVERY,
  orderItems: [],
  table: '',
  tableName: '',
  paymentMethod: '',
  owner: '',
  ownerFullName: '',
  ownerPhoneNumber: '',
  ownerRole: '',
  voucher: null,
  description: '',
  approvalBy: '',
  deliveryAddress: '123 Main St',
  deliveryPhone: '0901234567',
  deliveryLat: 10.77,
  deliveryLng: 106.7,
  deliveryPlaceId: 'place-123',
  deliveryDistance: 2.5,
  deliveryDuration: 15,
}

function makeStore(draft = DELIVERY_DRAFT) {
  let state = {
    updatingData: {
      originalOrder: null as any,
      hasChanges: false,
      updateDraft: draft,
    },
    lastModified: 0,
    isHydrated: true,
  }
  const set = jest.fn((partial: any) => {
    state = { ...state, ...partial }
  })
  const get = () => state as any
  const methods = createUpdatingTableMethods(set, get)
  return { methods, get, set }
}

describe('setDraftType — delivery clearing', () => {
  it('clears delivery fields when switching to AT_TABLE', () => {
    const { methods, get } = makeStore()
    methods.setDraftType(OrderTypeEnum.AT_TABLE)
    const draft = get().updatingData.updateDraft
    expect(draft.deliveryAddress).toBe('')
    expect(draft.deliveryPhone).toBe('')
    expect(draft.deliveryLat).toBeUndefined()
    expect(draft.deliveryLng).toBeUndefined()
    expect(draft.deliveryPlaceId).toBe('')
    expect(draft.deliveryDistance).toBe(0)
    expect(draft.deliveryDuration).toBe(0)
  })

  it('clears delivery fields when switching to TAKE_OUT', () => {
    const { methods, get } = makeStore()
    methods.setDraftType(OrderTypeEnum.TAKE_OUT)
    const draft = get().updatingData.updateDraft
    expect(draft.deliveryAddress).toBe('')
    expect(draft.deliveryPhone).toBe('')
    expect(draft.deliveryLat).toBeUndefined()
  })

  it('preserves delivery fields when type stays DELIVERY', () => {
    const { methods, get } = makeStore()
    methods.setDraftType(OrderTypeEnum.DELIVERY)
    const draft = get().updatingData.updateDraft
    expect(draft.deliveryAddress).toBe('123 Main St')
    expect(draft.deliveryPhone).toBe('0901234567')
    expect(draft.deliveryLat).toBe(10.77)
  })

  it('clears table/tableName when switching to TAKE_OUT', () => {
    const { methods, get } = makeStore({
      ...DELIVERY_DRAFT,
      table: 'table-1',
      tableName: 'T1',
    })
    methods.setDraftType(OrderTypeEnum.TAKE_OUT)
    const draft = get().updatingData.updateDraft
    expect(draft.table).toBe('')
    expect(draft.tableName).toBe('')
  })

  it('returns early without crashing when updatingData is null', () => {
    let state: any = { updatingData: null, lastModified: 0, isHydrated: true }
    const set = jest.fn()
    const get = () => state
    const { setDraftType } = createUpdatingTableMethods(set, get)
    expect(() => setDraftType(OrderTypeEnum.AT_TABLE)).not.toThrow()
    expect(set).not.toHaveBeenCalled()
  })
})
```

---

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx jest __tests__/stores/delivery-clearing.test.ts --no-coverage
```

Expected: FAIL — the 2 "clears delivery fields" tests fail because `deliveryAddress` is still `'123 Main St'`.

---

- [ ] **Step 3: Update `setDraftType` in `stores/slices/updating-table.slice.ts`**

Replace the entire `setDraftType` method (lines 48-70):

```typescript
setDraftType: (type: OrderTypeEnum) => {
  const { updatingData } = get()
  if (!updatingData) return

  const deliveryClear =
    type !== OrderTypeEnum.DELIVERY
      ? {
          deliveryAddress: '',
          deliveryDistance: 0,
          deliveryDuration: 0,
          deliveryPhone: '',
          deliveryLat: undefined,
          deliveryLng: undefined,
          deliveryPlaceId: '',
        }
      : {}

  set({
    updatingData: {
      ...updatingData,
      updateDraft: {
        ...updatingData.updateDraft,
        type,
        ...(type === OrderTypeEnum.TAKE_OUT && {
          table: '',
          tableName: '',
        }),
        ...(type === OrderTypeEnum.AT_TABLE && {
          timeLeftTakeOut: undefined,
        }),
        ...deliveryClear,
      },
      hasChanges: true,
    },
    lastModified: dayjs().valueOf(),
  })
},
```

(`dayjs` is already imported in the file — no new imports needed.)

---

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx jest __tests__/stores/delivery-clearing.test.ts --no-coverage
```

Expected: PASS — all 5 tests pass.

---

- [ ] **Step 5: Update `setOrderingType` in `stores/order-flow.store.ts`**

Replace lines 254-292 with the updated method. The full replacement:

```typescript
setOrderingType: (type: OrderTypeEnum) => {
  const { orderingData } = get()

  const deliveryClear =
    type !== OrderTypeEnum.DELIVERY
      ? {
          deliveryAddress: '',
          deliveryDistance: 0,
          deliveryDuration: 0,
          deliveryPhone: '',
          deliveryLat: undefined,
          deliveryLng: undefined,
          deliveryPlaceId: '',
        }
      : {}

  // If orderingData is null, initialize it first
  if (!orderingData) {
    get().initializeOrdering()
    const { orderingData: newOrderingData } = get()
    if (!newOrderingData) return

    set({
      orderingData: {
        ...newOrderingData,
        type,
        ...(type === OrderTypeEnum.TAKE_OUT
          ? { table: '', tableName: '' }
          : { timeLeftTakeOut: undefined }),
        ...deliveryClear,
      },
      lastModified: dayjs().valueOf(),
    })
  } else {
    set({
      orderingData: {
        ...orderingData,
        type,
        ...(type === OrderTypeEnum.TAKE_OUT
          ? { table: '', tableName: '' }
          : { timeLeftTakeOut: undefined }),
        ...deliveryClear,
      },
      lastModified: dayjs().valueOf(),
    })
  }
},
```

---

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. (`deliveryAddress`, `deliveryPhone`, etc. are all optional (`?`) on `IOrderingData`, so assigning `''` and `undefined` is valid.)

---

- [ ] **Step 7: Manual test**

1. Cart → set order type to DELIVERY
2. Open address sheet, select address + enter phone → confirm
3. `DeliveryInfoRow` shows the confirmed address
4. Tap order type selector → switch to TAKE_OUT
5. Switch back to DELIVERY
6. Open address sheet
7. Expected: address input is empty (was cleared on type switch)

---

- [ ] **Step 8: Commit**

```bash
git add stores/order-flow.store.ts stores/slices/updating-table.slice.ts __tests__/stores/delivery-clearing.test.ts
git commit -m "fix(delivery): clear delivery fields when switching order type away from DELIVERY"
```

---

## Task 3: Show delivery phone on payment screen

**Problem:** `payment-order-info-card.tsx` shows the delivery address for delivery orders but omits the delivery phone. `order.deliveryPhone` exists on `IOrder` (typed as `string | undefined`, from API response at `types/dish.type.ts:55`).

**Files:**

- Modify: `app/payment/payment-order-info-card.tsx:129-141`

---

- [ ] **Step 1: Add delivery phone row after the delivery address row**

In `app/payment/payment-order-info-card.tsx`, locate the delivery address block (lines 129-141):

```tsx
{
  order.type === OrderTypeEnum.DELIVERY &&
    order.deliveryTo?.formattedAddress && (
      <View style={s.row}>
        <Text style={[s.label, theme.subtle]}>
          {t('order.deliveryAddress', 'Địa chỉ')}
        </Text>
        <Text style={[s.value, theme.value, { flex: 1, textAlign: 'right' }]}>
          {order.deliveryTo.formattedAddress}
        </Text>
      </View>
    )
}
```

Insert immediately after (before the `{order.description ? (` block):

```tsx
{
  order.type === OrderTypeEnum.DELIVERY && order.deliveryPhone && (
    <View style={s.row}>
      <Text style={[s.label, theme.subtle]}>
        {t('order.deliveryPhone', 'SĐT nhận hàng')}
      </Text>
      <Text style={[s.value, theme.value]}>{order.deliveryPhone}</Text>
    </View>
  )
}
```

---

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. (`order.deliveryPhone` is `string | undefined` on `IOrder`; the `&&` guard handles the `undefined` case.)

---

- [ ] **Step 3: Manual test**

1. Place a delivery order with a confirmed address + phone
2. Navigate to the payment screen (`/payment/[order]`)
3. Scroll to the order info card
4. Expected: the card shows both:
   - **Địa chỉ**: `<formattedAddress>`
   - **SĐT nhận hàng**: `<phone>`

---

- [ ] **Step 4: Commit**

```bash
git add app/payment/payment-order-info-card.tsx
git commit -m "feat(payment): show delivery phone number on order info card"
```

---

## Self-Review

**Spec coverage:**

- Gap 1 (dismiss without confirm) → Task 1 ✓
- Gap 2 (order type change) → Task 2 ✓
- Gap 3 (phone clear after confirm — overlaps with Gap 1) → covered by Task 1: closing with invalid phone clears state ✓
- Gap 4 (delivery phone on payment) → Task 3 ✓
- Gap 5 (deliveryFee not sent to backend) → intentionally excluded — requires backend coordination to confirm if backend recalculates independently or expects the fee from client

**Placeholder scan:** No TBD/TODO in steps. All code blocks are complete.

**Type consistency:**

- `clearDeliveryInfo()` — exists on `IOrderFlowStore` (via `ordering-delivery.slice.ts`) ✓
- `clearDraftDeliveryInfo()` — exists on `IOrderFlowStore` (bridged at `order-flow.store.ts:515`) ✓
- `PHONE_NUMBER_REGEX` — exported from `constants/regex.ts`, re-exported via `constants/index.ts` ✓
- `deliveryAddress`, `deliveryPhone`, `deliveryLat`, `deliveryLng`, `deliveryPlaceId`, `deliveryDistance`, `deliveryDuration` — all optional fields on both `IOrderingData` and `IOrderToUpdate` ✓
- `order.deliveryPhone` — `string | undefined` on `IOrder` (types/dish.type.ts:55) ✓
