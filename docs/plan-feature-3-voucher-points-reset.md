# Feature 3: Voucher ↔ Loyalty Points Reset

## Mô tả
Khi voucher thay đổi (thêm/đổi/xóa) trên payment screen, tự động cancel loyalty points reservation và reset input về 0 để tránh stale state.

---

## Files cần tạo mới

Không cần tạo file mới. Logic thêm vào `app/payment/[order].tsx` và `app/payment/loyalty-points-input.tsx`.

---

## Files cần sửa

### `app/payment/loyalty-points-input.tsx`

Thêm prop `onResetRef` (đã plan trong Feature 1):
```typescript
// Trong props interface (đã có từ Feature 1):
onResetRef?: React.MutableRefObject<() => void>

// Trong component:
useEffect(() => {
  if (onResetRef) {
    onResetRef.current = () => setInputValue('')
  }
}, [onResetRef])
```

### `app/payment/[order].tsx`

**Import thêm:**
```typescript
import { useCancelReservationForOrder } from '@/hooks/use-loyalty-point'
```

**State + ref mới:**
```typescript
const { mutate: cancelLoyaltyReservation } = useCancelReservationForOrder()

// Ref để track voucher slug trước đó — undefined = chưa init
const prevVoucherSlugRef = useRef<string | null | undefined>(undefined)

// Reset ref đã setup ở Feature 1:
const loyaltyInputResetRef = useRef<() => void>(() => {})
const resetLoyaltyPointsInput = useCallback(() => {
  loyaltyInputResetRef.current()
}, [])
```

**useEffect watch voucher change:**
```typescript
useEffect(() => {
  const currentSlug = order?.voucher?.slug ?? null

  // Skip lần đầu mount (undefined → giá trị thực)
  if (prevVoucherSlugRef.current === undefined) {
    prevVoucherSlugRef.current = currentSlug
    return
  }

  // Voucher không thay đổi → bỏ qua
  if (prevVoucherSlugRef.current === currentSlug) return

  prevVoucherSlugRef.current = currentSlug

  // Có điểm đang reserved → cancel trước khi reset UI
  if ((order?.accumulatedPointsToUse ?? 0) > 0 && orderSlug) {
    cancelLoyaltyReservation(orderSlug, {
      onSuccess: () => {
        refetchOrder()        // Cập nhật accumulatedPointsToUse về 0 trong receipt
        resetLoyaltyPointsInput()
      },
      onError: () => {
        // Silent fail — không block user
        if (__DEV__) {
          console.warn('[Payment] Failed to cancel loyalty reservation on voucher change')
        }
      },
    })
  } else {
    // Không có điểm reserved → chỉ reset UI
    resetLoyaltyPointsInput()
  }
}, [order?.voucher?.slug])
// Intentionally minimal deps — chỉ watch voucher slug
```

---

## Logic chi tiết

### Trigger conditions
```
1. User chọn voucher mới trong VoucherSheet (slug A → slug B)
   → API apply voucher → refetchOrder → order.voucher.slug thay đổi → Effect trigger

2. User xóa voucher thủ công qua VoucherSheet
   → API remove → refetchOrder → order.voucher = null → Effect trigger

3. Voucher bị xóa do conflict với payment method (Feature 2)
   → Feature 2 đã gọi cancelLoyaltyReservation trực tiếp
   → refetchOrder → accumulatedPointsToUse = 0
   → Effect trigger nhưng check accumulatedPointsToUse === 0 → chỉ reset UI (không double-call)
```

### Deduplication với Feature 2
Feature 2 gọi `cancelLoyaltyReservation` trực tiếp khi xóa voucher.
Sau đó `refetchOrder()` → `accumulatedPointsToUse` sẽ là 0.
Effect này check `accumulatedPointsToUse > 0` → không gọi cancel lần nữa → chỉ `resetLoyaltyPointsInput()`.

### Sequence diagram (happy path: đổi voucher)
```
1. User chọn voucher mới trong VoucherSheet
2. VoucherSheet gọi updateVoucherInOrder(orderSlug, newVoucherSlug)
3. API success → onVoucherApplied() → refetchOrder()
4. order cập nhật: voucher.slug = B, accumulatedPointsToUse = N (điểm cũ)
5. useEffect detect: prevSlug (A) !== currentSlug (B)
6. accumulatedPointsToUse > 0 → cancelReservation(orderSlug)
7. onSuccess → refetchOrder() → accumulatedPointsToUse = 0 trong receipt
8. resetLoyaltyPointsInput() → input field cleared
```

---

## Edge Cases

| Case | Xử lý |
|------|--------|
| Voucher change nhưng `accumulatedPointsToUse === 0` | Chỉ reset UI, không gọi API |
| `cancelReservation` thất bại | Silent warn, không reset UI (giữ consistent state) |
| Order không còn PENDING khi effect chạy | `cancelReservation` idempotent ở backend, không harmful |
| `prevVoucherSlugRef` init là `undefined` | Guard ở đầu effect: skip lần đầu mount |
| StrictMode double-effect | Idempotent: cancel nhiều lần → ok, reset UI nhiều lần → ok |
| Feature 2 và Feature 3 cùng chạy | Feature 2 gọi cancel trực tiếp → Feature 3 check `accumulatedPointsToUse === 0` → skip cancel |
| `refetchOrder` bị stale (cache) | Dùng `{ cancelRefetch: false }` option hoặc `invalidateQueries` để force fresh |

---

## Thứ tự implement

1. Đảm bảo `onResetRef` đã được thêm vào `LoyaltyPointsInput` (từ Feature 1)
2. Thêm `loyaltyInputResetRef` + `resetLoyaltyPointsInput` vào `PaymentPageContent`
3. Import + setup `useCancelReservationForOrder`
4. Thêm `prevVoucherSlugRef`
5. Thêm `useEffect` watch `order?.voucher?.slug` với logic cancel + reset
6. Test integration với Feature 2: xóa voucher qua conflict dialog → không double-call cancel

---

## Verification

- Apply điểm → mở VoucherSheet → chọn voucher khác → điểm reset về 0, input cleared
- Apply điểm → xóa voucher trong sheet → điểm reset về 0
- Xóa voucher qua Feature 2 conflict dialog → `cancelReservation` gọi 1 lần (không 2 lần)
- `accumulatedPointsToUse === 0` → đổi voucher → không gọi `cancelReservation` (check network)
- Mount lần đầu → không trigger reset (prevVoucherSlugRef = undefined guard)
