# Feature 1: Loyalty Points Input UI

## Mô tả
Cho phép người dùng đã đăng nhập nhập số điểm muốn dùng khi thanh toán đơn PENDING, với quick-select buttons, nút "Dùng tất cả", auto-cap, hiển thị savings, và tự cancel reservation khi xóa hết input.

---

## Files cần tạo mới

### `app/payment/loyalty-points-input.tsx`

Props interface:
```typescript
interface LoyaltyPointsInputProps {
  orderSlug: string
  orderTotal: number          // order.subtotal (sau voucher discount)
  userTotalPoints: number     // từ useLoyaltyPoints hook
  currentPointsUsed: number   // order.accumulatedPointsToUse
  isDark: boolean
  primaryColor: string
  onApplied: () => void       // → refetchOrder()
  onCancelled: () => void     // → refetchOrder()
  onResetRef?: React.MutableRefObject<() => void>  // cho Feature 3
}
```

---

## Files cần sửa

### `app/payment/[order].tsx`

Thêm:
```typescript
// Hook lấy điểm user
const userSlug = userInfo?.slug
const { data: loyaltyData } = useLoyaltyPoints(
  userSlug,
  { enabled: isLoggedIn && !!userSlug && order?.status === OrderStatus.PENDING }
)
const userTotalPoints = loyaltyData?.result?.totalPoints ?? 0

// Ref để reset input từ bên ngoài (Feature 3)
const loyaltyInputResetRef = useRef<() => void>(() => {})
const resetLoyaltyPointsInput = useCallback(() => {
  loyaltyInputResetRef.current()
}, [])
```

Chèn vào JSX sau `<PaymentMethodSection>`:
```tsx
{isLoggedIn && order.status === OrderStatus.PENDING && userTotalPoints > 0 && (
  <LoyaltyPointsInput
    orderSlug={orderSlug}
    orderTotal={order.subtotal}
    userTotalPoints={userTotalPoints}
    currentPointsUsed={order.accumulatedPointsToUse ?? 0}
    isDark={isDark}
    primaryColor={primaryColor}
    onApplied={refetchOrder}
    onCancelled={refetchOrder}
    onResetRef={loyaltyInputResetRef}
  />
)}
```

---

## Logic chi tiết

### Tính toán
```typescript
const QUICK_SELECT_PRESETS = [1000, 2000, 3000, 5000, 10000, 20000, 50000]

// maxUsablePoints = MIN(userPoints, orderTotal)
const maxUsablePoints = useMemo(
  () => Math.min(userTotalPoints, Math.max(0, orderTotal)),
  [userTotalPoints, orderTotal]
)

// Quick select: chỉ lấy preset < maxUsablePoints
const quickSelectValues = useMemo(
  () => QUICK_SELECT_PRESETS.filter((v) => v < maxUsablePoints),
  [maxUsablePoints]
)

// Parse input → clamp về max
const parsedPoints = useMemo(() => {
  const n = parseInt(inputValue, 10)
  return isNaN(n) ? 0 : n
}, [inputValue])

const clampedPoints = Math.min(parsedPoints, maxUsablePoints)
const isUseAll = clampedPoints === maxUsablePoints && maxUsablePoints > 0
```

### Handlers
```typescript
// Chỉ nhận số
const handleInputChange = (text: string) => {
  setInputValue(text.replace(/[^0-9]/g, ''))
}

// Blur → auto-clamp + auto-cancel khi input rỗng
const handleInputBlur = () => {
  if (!inputValue || parsedPoints === 0) {
    if (currentPointsUsed > 0) {
      cancelReservation(orderSlug, { onSuccess: onCancelled })
    }
    return
  }
  if (parsedPoints > maxUsablePoints) {
    setInputValue(String(maxUsablePoints))
  }
}

// Apply
const handleApply = () => {
  const points = Math.min(parsedPoints, maxUsablePoints)
  if (points <= 0) return
  setIsApplying(true)
  applyPoints(
    { orderSlug, pointsToUse: points },
    {
      onSuccess: () => { onApplied(); setIsApplying(false) },
      onError: () => { showErrorToastMessage('Lỗi áp dụng điểm'); setIsApplying(false) }
    }
  )
}

// Toggle "Dùng tất cả"
const handleToggleUseAll = () => {
  setInputValue(isUseAll ? '' : String(maxUsablePoints))
}

// Quick select preset
const handleQuickSelect = (value: number) => setInputValue(String(value))

// Expose reset cho Feature 3
useEffect(() => {
  if (onResetRef) {
    onResetRef.current = () => setInputValue('')
  }
}, [onResetRef])

// Pre-fill khi mount với điểm đang reserved
useEffect(() => {
  if (currentPointsUsed > 0) {
    setInputValue(String(currentPointsUsed))
  }
}, [])  // Chỉ chạy 1 lần khi mount
```

### UI Layout
```
┌─────────────────────────────────────────────────────┐
│ Tiêu đề: "Điểm tích lũy"                            │
│ Subtext: "Bạn có {userTotalPoints} điểm"            │
├─────────────────────────────────────────────────────┤
│ [TextInput số điểm]   [Toggle "Dùng tất cả điểm"]  │
│ Hint: "Tối đa: {maxUsablePoints} điểm"              │
├─────────────────────────────────────────────────────┤
│ Quick select row:                                   │
│ [1K] [2K] [5K] ... [Tối đa]                        │
├─────────────────────────────────────────────────────┤
│ Savings: "Tiết kiệm: {clampedPoints} đ"             │  ← chỉ show khi > 0
├─────────────────────────────────────────────────────┤
│ [Nút "Áp dụng" — disabled khi isApplying]          │
└─────────────────────────────────────────────────────┘
```

---

## Edge Cases

| Case | Xử lý |
|------|--------|
| `userTotalPoints === 0` | Ẩn toàn bộ component (guard ở parent) |
| `orderTotal === 0` | `maxUsablePoints = 0` → disable input + show "Không thể dùng điểm" |
| Input > max | Auto-clamp khi blur |
| Input = "0" hoặc rỗng | Nếu `currentPointsUsed > 0` → auto cancel reservation |
| `currentPointsUsed > 0` khi mount | Pre-fill input, không gọi API lại |
| Apply thất bại | Toast error, giữ input value |
| `quickSelectValues` rỗng (max < 1000) | Chỉ hiển thị nút "Tối đa" |
| Double tap "Áp dụng" | Disable button khi `isApplying = true` |

---

## Thứ tự implement

1. Tạo `loyalty-points-input.tsx` — skeleton + StyleSheet
2. Implement logic: `maxUsablePoints`, `quickSelectValues`, `clampedPoints`
3. Implement UI: header, TextInput, toggle, quick select row, savings
4. Implement handlers: `handleInputChange`, `handleInputBlur`, `handleApply`, `handleToggleUseAll`
5. Implement `onResetRef` registration (cho Feature 3)
6. Sửa `[order].tsx`: import hook `useLoyaltyPoints`, mount `LoyaltyPointsInput` với guard

---

## Verification

- User có điểm + order PENDING → thấy section điểm tích lũy
- Nhập số lớn hơn max → blur → auto-clamp
- "Dùng tất cả" → input = max → toggle lại → input rỗng
- Quick select [2000] → input = 2000
- "Tối đa" → input = maxUsablePoints
- "Áp dụng" → spinner → API call → receipt cập nhật `accumulatedPointsToUse`
- Xóa input → blur → `cancelReservationForOrder` → `accumulatedPointsToUse` = 0
- User chưa đăng nhập / order PAID → section không hiện
