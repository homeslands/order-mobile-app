# Gift Card Deeplink Fix + Recipient Info in Detail Sheet

**Goal:** Fix push notification deeplink for gift card orders so tapping routes to the correct screen with detail sheet auto-opened; add sender/recipient info to the gift card order detail sheet for GIFT-type orders.

**Architecture:** Two targeted changes — one routing fix in the notification navigation layer, one UI addition to the existing detail sheet component. No new routes, no new stores.

**Tech Stack:** Expo Router (file-based routing, `useLocalSearchParams`), React Native, TanStack React Query, existing `useCardOrderBySlug` hook.

---

## Feature 1: Fix Gift Card Notification Deeplink

### Problem

`lib/notification-navigation.ts` currently maps `NotificationMessageCode.CARD_ORDER_PAID` to `/payment/{order}` — the same route as regular food orders. Tapping a gift card paid notification opens the payment QR screen instead of the gift card order detail.

### Solution

**`lib/notification-navigation.ts`**

Change the `CARD_ORDER_PAID` case to produce `/profile/gift-card-orders?autoOpen={order}`. `ORDER_PAID` (food orders) remains `/payment/{order}` unchanged.

```
Before: CARD_ORDER_PAID → /payment/abc123
After:  CARD_ORDER_PAID → /profile/gift-card-orders?autoOpen=abc123
```

**`app/profile/gift-card-orders.tsx`**

Read `autoOpen` from `useLocalSearchParams<{ autoOpen?: string }>()`. On first mount, if `autoOpen` is present, set `detailSlug` to that value so the detail sheet opens automatically. Use a `useRef` boolean guard so the param is consumed only once — re-renders and focus events do not re-trigger it.

```
notification tap
  → navigateFromNotification("card-order-paid", slug)
  → router.push("/profile/gift-card-orders?autoOpen=abc123")
  → gift-card-orders mounts with params.autoOpen = "abc123"
  → useEffect (guarded by ref) → setDetailSlug("abc123")
  → GiftCardOrderDetailSheet opens with orderSlug="abc123"
  → user closes sheet → setDetailSlug(null) — normal flow resumes
```

### Edge Cases

- **Cold start**: `navigateFromNotification` already handles 600ms delay for app mount — no additional handling needed.
- **Sheet already open**: If user is already on gift-card-orders with a sheet open, the `autoOpen` param arriving via focus will not override because the ref guard has already fired.
- **Missing order**: `useCardOrderBySlug` returns null if slug is invalid — detail sheet shows existing empty state.

---

## Feature 2: Sender + Recipient Info in Gift Card Detail Sheet

### Problem

`components/gift-card/gift-card-order-detail-sheet.tsx` does not show who sent or received a gift for `GiftCardType.GIFT` orders, even though `ICardOrderResponse` contains `customerName`, `customerPhone`, and `receipients[]`.

### Solution

**`components/gift-card/gift-card-order-detail-sheet.tsx`**

After the existing info card, add a sender/recipient section rendered only when `order.type === GiftCardType.GIFT`.

**Người gửi section** — one row:
- Source: `order.customerName`, `order.customerPhone`

**Người nhận section** — one row per entry in `order.receipients[]`:
- `recipient.name`, `recipient.phone`
- `recipient.message` (shown below name/phone if non-empty)

Both sections use `.map()` (no FlashList — recipient count is small). Styling follows existing info row pattern in the sheet (muted label header, normal-weight value text, separator lines between recipients).

### Data

```
ICardOrderResponse.customerName     → Người gửi: tên
ICardOrderResponse.customerPhone    → Người gửi: SĐT
IReceiverGiftCardResponse.name      → Người nhận: tên
IReceiverGiftCardResponse.phone     → Người nhận: SĐT
IReceiverGiftCardResponse.message   → Người nhận: lời nhắn (optional)
```

### Out of Scope

- Resend SMS button: backend does not support SMS for gift cards — not added.
- SELF and BUY order types: no sender/recipient section needed — existing gift card codes section unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/notification-navigation.ts` | Map `CARD_ORDER_PAID` to new route with `autoOpen` param |
| `app/profile/gift-card-orders.tsx` | Consume `autoOpen` param on mount to auto-open detail sheet |
| `components/gift-card/gift-card-order-detail-sheet.tsx` | Add sender + recipient section for GIFT-type orders |

## Testing

- Simulate `CARD_ORDER_PAID` notification with a valid gift card order slug → confirm sheet opens on correct order
- Simulate with invalid slug → confirm empty state in sheet, no crash
- Open gift-card-orders normally (no param) → confirm no sheet auto-opens
- GIFT order in detail sheet → confirm sender row and recipient rows with messages render
- SELF/BUY order in detail sheet → confirm no sender/recipient section appears
- Recipient with empty `message` → confirm message row is omitted
