# Multi-Order Ready Sheet — Design Spec

## Goal

Redesign the `OrderReadyPickupSheet` flow so that when a customer has multiple orders ready simultaneously, each order is presented one at a time (FIFO), with snooze-and-re-show behavior instead of permanent dismissal.

## Context

Current bugs in the multi-order flow:
1. **LIFO bug** — store prepends newest notification, `.find()` returns newest first → wrong order shown
2. **Race condition** — `markAllReadByOrder` (sync Zustand) races with `usePathname()` async update during navigation → sheet B can flash during push animation to order A
3. **Content swap** — when multiple FCM arrive close together, sheet content changes mid-animation

These are fixed as part of this redesign.

---

## Architecture

```
NotificationStore
      │
      ▼
useOrderReadyQueue   ←──  snoozeMap (module-level Map<orderSlug, expireAt>)
      │                   snoozeTick (state counter, setInterval 10s)
      ▼
OrderReadyPickupSheet  (pure render — no business logic)
```

**Key principle:** All queue/snooze logic lives in `useOrderReadyQueue`. The component only calls hook methods and renders output.

---

## Hook: `useOrderReadyQueue`

**File:** `hooks/use-order-ready-queue.ts`

### Returned interface

```ts
interface OrderReadyQueue {
  activeOrder: PendingOrder | null  // oldest unread, non-snoozed ORDER_NEEDS_READY_TO_GET
  pendingCount: number              // total unread ORDER_NEEDS_READY_TO_GET (incl. snoozed)
  snooze: (orderSlug: string) => void       // "Để sau" / swipe dismiss
  markDone: (orderSlug: string) => void     // "Xem chi tiết" — mark read + clear snooze
  suppressFor: (ms: number) => void         // block present for N ms (post-navigate guard)
}
```

### Snooze state (module-level)

```ts
const snoozeMap = new Map<string, number>() // orderSlug → expireAt (ms since epoch)
const SNOOZE_MS = 90_000                    // 90 seconds
```

Module-level (not React state) so it persists across re-renders and component remounts. Cleared only on JS runtime kill.

### `isSnoozing(orderSlug)` helper

```ts
function isSnoozing(orderSlug: string): boolean {
  const exp = snoozeMap.get(orderSlug)
  if (!exp) return false
  if (Date.now() >= exp) { snoozeMap.delete(orderSlug); return false }
  return true
}
```

### FIFO selection

```ts
// Sort ASC by createdAt → oldest first → consistent FIFO order
const sorted = notifications
  .filter(n => !n.isRead && n.message === ORDER_NEEDS_READY_TO_GET)
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

const activeOrder = sorted.find(n => !isSnoozing(n.metadata.order)) ?? null
const pendingCount = sorted.length  // includes snoozed — shows total waiting
```

### Snooze re-trigger (interval)

```ts
const [snoozeTick, setSnoozeTick] = useState(0)

useEffect(() => {
  const id = setInterval(() => setSnoozeTick(t => t + 1), 10_000)
  return () => clearInterval(id)
}, [])
```

Every 10 seconds the component re-derives `activeOrder`. When a snooze expires, the expired entry is deleted by `isSnoozing()` and the order becomes `activeOrder` again → sheet presents.

### Navigation suppress guard

```ts
const suppressUntilRef = useRef(0)

function suppressFor(ms: number) {
  suppressUntilRef.current = Date.now() + ms
}

// In activeOrder derivation:
const isSuppressed = Date.now() < suppressUntilRef.current
const activeOrder = isSuppressed ? null : (sorted.find(...) ?? null)
```

### `snooze(orderSlug)`

```ts
function snooze(orderSlug: string) {
  snoozeMap.set(orderSlug, Date.now() + SNOOZE_MS)
}
```

Called by: "Để sau" button, swipe-down dismiss, scrim tap.
Does NOT call `markAsRead` — notification stays unread in the list.

### `markDone(orderSlug)`

```ts
function markDone(orderSlug: string) {
  snoozeMap.delete(orderSlug)
  markAllReadByOrder(orderSlug)   // Zustand action
}
```

Called by: "Xem chi tiết đơn" button only.
Marks all notifications for this order as read → they disappear from the queue.

---

## Component: `OrderReadyPickupSheet`

**File:** `components/notification/order-ready-pickup-sheet.tsx`

### Changes from current

| Removed | Replaced with |
|---------|---------------|
| `dismissedInSession` Set | `snoozeMap` in hook |
| `isProgrammaticDismissRef` | `suppressFor(600)` called before navigate |
| `pendingOrderRef` | hook's `activeOrder` (always current) |
| `dismissAllByOrder` | `snooze(orderSlug)` |
| `markAllReadByOrder` subscription | `markDone(orderSlug)` |
| `onChange` debug handler | removed |

### Sheet present/dismiss logic

```ts
const { activeOrder, pendingCount, snooze, markDone, suppressFor } = useOrderReadyQueue()
const shownSlugRef = useRef<string | null>(null)

useEffect(() => {
  const shouldShow = !!activeOrder && !pathname?.startsWith('/order/')

  if (shouldShow && shownSlugRef.current !== activeOrder.orderSlug) {
    shownSlugRef.current = activeOrder.orderSlug
    requestAnimationFrame(() => sheetRef.current?.present())
  } else if (!shouldShow && shownSlugRef.current !== null) {
    sheetRef.current?.dismiss()
  }
}, [activeOrder, pathname])
```

**Note:** `shownSlugRef` tracks by `orderSlug` (not notification slug) to prevent re-presenting the same order when a duplicate FCM arrives for the same order.

### Button handlers

```ts
const handleDismissLater = useCallback(() => {
  if (!activeOrder) return
  snooze(activeOrder.orderSlug)
  isProgrammaticRef.current = true
  sheetRef.current?.dismiss()
  showToastInternal('Đã ẩn nhắc nhở', 'Sẽ nhắc lại sau 90 giây · Xem ở Thông báo', 'info')
}, [activeOrder, snooze])

const handleViewOrder = useCallback(() => {
  if (!activeOrder) return
  markDone(activeOrder.orderSlug)
  suppressFor(600)
  isProgrammaticRef.current = true
  sheetRef.current?.dismiss()
  navigateNative.push(`/order/${activeOrder.orderSlug}`)
}, [activeOrder, markDone, suppressFor])
```

### Swipe/scrim dismiss handler

```ts
// Sync ref so handleSheetDismiss can read latest activeOrder without
// adding it as a useCallback dependency (avoids stale closure).
const activeOrderRef = useRef<PendingOrder | null>(null)
useEffect(() => { activeOrderRef.current = activeOrder }, [activeOrder])

const handleSheetDismiss = useCallback(() => {
  if (!isProgrammaticRef.current && activeOrderRef.current) {
    snooze(activeOrderRef.current.orderSlug)
  }
  isProgrammaticRef.current = false
  shownSlugRef.current = null
}, [snooze])
```

### Pending badge UI

```tsx
{pendingCount > 1 && (
  <View style={s.pendingBadge}>
    <View style={s.pendingDot} />
    <Text style={s.pendingText}>
      Còn {pendingCount - 1} đơn nữa đang chờ
    </Text>
  </View>
)}
```

Badge appears between sheet handle and icon. Animated pulsing dot (Animated.loop or Reanimated withRepeat).

---

## Cases

| # | Trigger | Behavior |
|---|---------|----------|
| 1 | 1 đơn ready | Sheet bình thường, không badge |
| 2 | Đơn B tới khi đang xem sheet A | Badge "Còn 1 đơn nữa" xuất hiện, sheet A không bị đóng |
| 3 | Bấm "Để sau" | Snooze 90s, toast "Sẽ nhắc lại sau 90 giây", re-show sau |
| 4 | Xem chi tiết A → back | suppressFor(600ms) → sheet B hiện (FIFO) |
| 5 | Swipe down / tap scrim | Snooze 90s (giống "Để sau") |
| 6 | 3 đơn cùng lúc | Badge "Còn 2 đơn nữa", giảm khi xử lý từng đơn |

---

## Files Touched

| File | Action |
|------|--------|
| `hooks/use-order-ready-queue.ts` | **Create** — hook with all queue/snooze logic |
| `components/notification/order-ready-pickup-sheet.tsx` | **Modify** — consume hook, add pending badge |

No other files change. `stores/notification.store.ts` already has `markAllReadByOrder`.

---

## Not In Scope

- Notification settings (sound/vibration toggle) — separate feature
- Server-side sync of read state (C3 fix) — separate task
- `message` field conflation fix (C4) — separate task
