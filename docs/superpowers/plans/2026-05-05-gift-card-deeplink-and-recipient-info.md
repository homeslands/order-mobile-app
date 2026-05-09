# Gift Card Deeplink Fix + Recipient Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix gift card notification deeplink so tapping routes to the gift card orders screen with the correct order's detail sheet auto-opened; add sender name/phone and recipient name/phone/message to the detail sheet for GIFT-type orders.

**Architecture:** Three targeted file changes — (1) route mapping fix in `lib/notification-navigation.ts`, (2) param consumption in `app/profile/gift-card-orders.tsx`, (3) sender + recipient UI in `components/gift-card/gift-card-order-detail-sheet.tsx` with new i18n keys. No new routes, no new stores, no new hooks.

**Tech Stack:** Expo Router (`useLocalSearchParams`), React Native, existing `useCardOrderBySlug` hook, `ICardOrderResponse` / `IReceiverGiftCardResponse` types.

---

## File Map

| File                                                    | Change                                                                                             |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `lib/notification-navigation.ts`                        | Export `getRouteForMessage`; map `CARD_ORDER_PAID` to `/profile/gift-card-orders?autoOpen={order}` |
| `__tests__/lib/notification-navigation.test.ts`         | New — unit tests for `getRouteForMessage`                                                          |
| `app/profile/gift-card-orders.tsx`                      | Import `useLocalSearchParams`; add `useEffect` + `useRef` to consume `autoOpen` param on mount     |
| `components/gift-card/gift-card-order-detail-sheet.tsx` | Add sender section + recipients section for GIFT-type orders; add styles                           |
| `i18n/vi/gift-card.json`                                | Add `orderDetail.sender` and `orderDetail.recipientsSection` keys                                  |

---

## Task 1: Fix notification route mapping for CARD_ORDER_PAID

**Files:**

- Modify: `lib/notification-navigation.ts:36-63`
- Create: `__tests__/lib/notification-navigation.test.ts`

### Background

Currently `getRouteForMessage` handles both `ORDER_PAID` and `CARD_ORDER_PAID` in the same case arm, routing both to `/payment/{order}`. We need to split them: `CARD_ORDER_PAID` must route to `/profile/gift-card-orders?autoOpen={order}`. We also export `getRouteForMessage` so it can be unit-tested without mocking the navigation engine.

The function is a pure switch — no side effects, easy to test.

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/notification-navigation.test.ts`:

```typescript
jest.mock('@/lib/navigation', () => ({
  isNavigationLocked: jest.fn(() => false),
  navigateNative: { push: jest.fn() },
}))

jest.mock('@/constants', () => ({
  NotificationMessageCode: {
    ORDER_NEEDS_READY_TO_GET: 'order-needs-ready-to-get',
    ORDER_NEEDS_PROCESSED: 'order-needs-processed',
    ORDER_NEEDS_DELIVERED: 'order-needs-delivered',
    ORDER_NEEDS_CANCELLED: 'order-needs-cancelled',
    ORDER_PAID: 'order-paid',
    CARD_ORDER_PAID: 'card-order-paid',
    ORDER_BILL_FAILED_PRINTING: 'order-bill-failed-printing',
    ORDER_CHEF_ORDER_FAILED_PRINTING: 'order-chef-order-failed-printing',
    ORDER_LABEL_TICKET_FAILED_PRINTING: 'order-label-ticket-failed-printing',
  },
}))

import { getRouteForMessage } from '@/lib/notification-navigation'

describe('getRouteForMessage', () => {
  it('routes CARD_ORDER_PAID to gift-card-orders with autoOpen param', () => {
    const route = getRouteForMessage({
      message: 'card-order-paid',
      order: 'order-abc',
    })
    expect(route).toBe('/profile/gift-card-orders?autoOpen=order-abc')
  })

  it('returns null for CARD_ORDER_PAID when order is missing', () => {
    const route = getRouteForMessage({ message: 'card-order-paid' })
    expect(route).toBeNull()
  })

  it('still routes ORDER_PAID to payment screen', () => {
    const route = getRouteForMessage({
      message: 'order-paid',
      order: 'order-xyz',
    })
    expect(route).toBe('/payment/order-xyz')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest --testPathPatterns="notification-navigation" 2>&1 | tail -15
```

Expected: FAIL — `getRouteForMessage` is not exported.

- [ ] **Step 3: Export `getRouteForMessage` and fix the route mapping**

In `lib/notification-navigation.ts`, replace the existing `getRouteForMessage` function (lines 36-63) with:

```typescript
export function getRouteForMessage(
  routeData: NotificationRouteData,
): string | null {
  const { message, order } = routeData

  switch (message) {
    case NotificationMessageCode.ORDER_NEEDS_READY_TO_GET:
      return order ? `/payment/${order}` : null

    case NotificationMessageCode.ORDER_NEEDS_PROCESSED:
    case NotificationMessageCode.ORDER_NEEDS_DELIVERED:
    case NotificationMessageCode.ORDER_NEEDS_CANCELLED:
      return order ? `/payment/${order}` : null

    case NotificationMessageCode.ORDER_PAID:
      return order ? `/payment/${order}` : null

    case NotificationMessageCode.CARD_ORDER_PAID:
      return order ? `/profile/gift-card-orders?autoOpen=${order}` : null

    case NotificationMessageCode.ORDER_BILL_FAILED_PRINTING:
    case NotificationMessageCode.ORDER_CHEF_ORDER_FAILED_PRINTING:
    case NotificationMessageCode.ORDER_LABEL_TICKET_FAILED_PRINTING:
      return order ? `/payment/${order}` : null

    default:
      return null
  }
}
```

The rest of the file (`parseNotificationData`, module state, `isNotificationNavigationPending`, `navigateFromNotification`) stays unchanged.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest --testPathPatterns="notification-navigation" 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 5: Run quality checks**

```bash
npm run check 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/notification-navigation.ts __tests__/lib/notification-navigation.test.ts
git commit -m "fix(notification): route CARD_ORDER_PAID to gift-card-orders screen"
```

---

## Task 2: Auto-open detail sheet from `autoOpen` deeplink param

**Files:**

- Modify: `app/profile/gift-card-orders.tsx:30,584-595`

### Background

When the user taps the notification, they land on `/profile/gift-card-orders?autoOpen=<slug>`. The screen reads the param once on mount via a `useEffect` + `useRef` guard, sets `detailSlug`, and the existing `GiftCardOrderDetailSheet` opens automatically.

The `useRef` guard (`autoOpenConsumed`) prevents re-triggering if the screen re-renders or regains focus while still in the navigation stack with the param present in the URL.

No test needed — this is a React component integration change best verified by manual testing (open the app via simulated notification and confirm the sheet opens on the correct order).

- [ ] **Step 1: Add `useLocalSearchParams` import**

In `app/profile/gift-card-orders.tsx`, the file already imports from `'react'` and Expo packages. Find the existing import block (around line 30) and add `useLocalSearchParams` from `expo-router`.

The file currently imports:

```typescript
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
```

Add after the existing imports (or alongside other expo-router imports if any):

```typescript
import { useLocalSearchParams } from 'expo-router'
```

- [ ] **Step 2: Add `autoOpenConsumed` ref and the `useEffect`**

In the `GiftCardOrdersScreen` component (the main screen component at the bottom of the file, around line 555+), after the existing state declarations (around line 586-591):

```typescript
const [ready, setReady] = useState(false)
const [selectedType, setSelectedType] = useState('ALL')
const [detailSlug, setDetailSlug] = useState<string | null>(null)
```

Add below `detailSlug` declaration:

```typescript
const params = useLocalSearchParams<{ autoOpen?: string }>()
const autoOpenConsumed = useRef(false)
```

Then add the following `useEffect` immediately after the existing `useRunAfterTransition` call (around line 595):

```typescript
useRunAfterTransition(() => setReady(true), [])

useEffect(() => {
  if (params.autoOpen && !autoOpenConsumed.current) {
    autoOpenConsumed.current = true
    setDetailSlug(params.autoOpen)
  }
}, [params.autoOpen])
```

- [ ] **Step 3: Run quality checks**

```bash
npm run check 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Manual test — simulate deeplink navigation**

In the running app or simulator, navigate programmatically to verify:

```
Expo Go / dev build:
  In the app JS console or dev menu, trigger:
  router.push('/profile/gift-card-orders?autoOpen=<any-valid-gift-card-order-slug>')
```

Expected: `gift-card-orders` screen opens, detail sheet auto-opens for that order slug.

Open and close the sheet — confirm it closes normally and does not re-open.

Navigate away and back — confirm the sheet does not re-open.

- [ ] **Step 5: Commit**

```bash
git add app/profile/gift-card-orders.tsx
git commit -m "fix(gift-card): auto-open detail sheet from notification deeplink param"
```

---

## Task 3: Add sender + recipient section to gift card order detail sheet

**Files:**

- Modify: `components/gift-card/gift-card-order-detail-sheet.tsx:235-400,409-476`
- Modify: `i18n/vi/gift-card.json:165-175`

### Background

`ICardOrderResponse` already contains `customerName`, `customerPhone` (the buyer/sender) and `receipients: IReceiverGiftCardResponse[]` (each with `name`, `phone`, `message`). These are fetched by the existing `useCardOrderBySlug` call. We just need to render them for `GiftCardType.GIFT` orders.

Layout for GIFT-type orders (added after the info card):

```
[Người gửi]      ← sectionTitle
┌────────────────────────────┐
│ Nguyễn Văn A  0901234567  │  ← personTopLine (name left, phone right)
└────────────────────────────┘
[Người nhận]     ← sectionTitle
┌────────────────────────────┐
│ Trần Thị B    0912345678  │  ← personTopLine
│ "Chúc mừng sinh nhật!"     │  ← personMessage (only if r.message is non-empty)
├────────────────────────────┤
│ Lê Văn C      0923456789  │
│ "Chúc mừng!"               │
└────────────────────────────┘
```

Note: the field is spelled `receipients` (typo in the API type) — use this exact spelling everywhere.

- [ ] **Step 1: Add i18n keys**

In `i18n/vi/gift-card.json`, find the `"orderDetail"` object (around line 165):

```json
"orderDetail": {
  "title": "Đơn thẻ quà tặng",
  "status": "Trạng thái",
  "orderDate": "Ngày đặt hàng",
  "paymentMethod": "Phương thức TT",
  "quantity": "Số lượng",
  "type": "Loại",
  "orderCode": "Mã đơn hàng",
  "giftCardsSection": "Danh sách thẻ ({{count}})",
  "notFound": "Không tìm thấy đơn hàng"
},
```

Add two keys:

```json
"orderDetail": {
  "title": "Đơn thẻ quà tặng",
  "status": "Trạng thái",
  "orderDate": "Ngày đặt hàng",
  "paymentMethod": "Phương thức TT",
  "quantity": "Số lượng",
  "type": "Loại",
  "orderCode": "Mã đơn hàng",
  "giftCardsSection": "Danh sách thẻ ({{count}})",
  "notFound": "Không tìm thấy đơn hàng",
  "sender": "Người gửi",
  "recipientsSection": "Người nhận"
},
```

- [ ] **Step 2: Add derived data variables for sender and recipients**

In `gift-card-order-detail-sheet.tsx`, find the existing derived variables block (around line 235-237):

```typescript
const giftCards = order?.giftCards ?? []
const hasGiftCards = giftCards.length > 0 && order?.type === GiftCardType.BUY
```

Add below:

```typescript
const recipients = order?.receipients ?? []
const isGiftType = order?.type === GiftCardType.GIFT
```

- [ ] **Step 3: Add sender + recipients JSX after the info card**

In `gift-card-order-detail-sheet.tsx`, find the closing tag of the info card section (around line 351):

```tsx
            </View>

            {/* ── Gift cards list ───────────────────────────────────── */}
            {hasGiftCards && (
```

Insert a new section between the info card `</View>` and the gift cards section:

```tsx
            </View>

            {/* ── Sender + Recipients (GIFT type) ──────────────────── */}
            {isGiftType && (
              <>
                <Text style={[s.sectionTitle, { color: subColor }]}>
                  {t('orderDetail.sender')}
                </Text>
                <View style={[s.card, { backgroundColor: cardBg, borderColor }]}>
                  <View style={s.personRow}>
                    <View style={s.personTopLine}>
                      <Text style={[s.personName, { color: textColor }]}>
                        {order.customerName}
                      </Text>
                      <Text style={[s.personPhone, { color: subColor }]}>
                        {order.customerPhone}
                      </Text>
                    </View>
                  </View>
                </View>

                {recipients.length > 0 && (
                  <>
                    <Text style={[s.sectionTitle, { color: subColor }]}>
                      {t('orderDetail.recipientsSection')}
                    </Text>
                    <View
                      style={[s.card, { backgroundColor: cardBg, borderColor }]}
                    >
                      {recipients.map((r, i) => (
                        <View key={r.slug}>
                          <View style={s.personRow}>
                            <View style={s.personTopLine}>
                              <Text style={[s.personName, { color: textColor }]}>
                                {r.name}
                              </Text>
                              <Text style={[s.personPhone, { color: subColor }]}>
                                {r.phone}
                              </Text>
                            </View>
                            {!!r.message && (
                              <Text
                                style={[s.personMessage, { color: subColor }]}
                              >
                                {r.message}
                              </Text>
                            )}
                          </View>
                          {i < recipients.length - 1 && (
                            <View
                              style={[
                                s.divider,
                                { backgroundColor: borderColor },
                              ]}
                            />
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {/* ── Gift cards list ───────────────────────────────────── */}
            {hasGiftCards && (
```

- [ ] **Step 4: Add new styles**

In `gift-card-order-detail-sheet.tsx`, find the styles object (starting at line 409). Add new entries after the `gcVal` style:

```typescript
  gcVal: { fontSize: 13, fontWeight: '700' },

  // Person rows (sender / recipients)
  personRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  personTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  personName: { fontSize: 14, fontWeight: '600' },
  personPhone: { fontSize: 13 },
  personMessage: { fontSize: 12, fontStyle: 'italic' },
})
```

Remove the old closing `})` at the end of the styles and replace with the above block (which includes the closing `})`).

- [ ] **Step 5: Run quality checks**

```bash
npm run check 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 6: Manual test**

Open a GIFT-type gift card order in the detail sheet. Confirm:

- "Người gửi" section shows buyer name + phone
- "Người nhận" section shows each recipient's name, phone, and message (if any)
- Recipients with empty `message` show no message line
- SELF and BUY orders show no sender/recipient section

- [ ] **Step 7: Commit**

```bash
git add components/gift-card/gift-card-order-detail-sheet.tsx i18n/vi/gift-card.json
git commit -m "feat(gift-card): show sender and recipient info in order detail sheet"
```
