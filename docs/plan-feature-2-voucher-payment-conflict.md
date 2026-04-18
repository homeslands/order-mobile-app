# Feature 2: Voucher ↔ Payment Method Conflict Dialog

## Mô tả

Khi user chọn payment method không compatible với voucher đang áp dụng, hiện Bottom Sheet cảnh báo với 2 lựa chọn: giữ voucher (revert) hoặc xóa voucher (gọi API rồi cho phép method mới).

---

## Files cần tạo mới

### `app/payment/voucher-conflict-bottom-sheet.tsx`

Props interface:

```typescript
interface VoucherConflictBottomSheetProps {
  visible: boolean
  voucherCode: string // hiển thị tên voucher trong dialog
  paymentMethodLabel: string // tên method user muốn chọn
  isDark: boolean
  primaryColor: string
  isRemoving: boolean // spinner khi đang gọi API
  onKeepVoucher: () => void // đóng sheet, revert
  onRemoveVoucher: () => void // gọi API xóa voucher
}
```

UI Layout:

```
┌─────────────────────────────────────────────────────┐
│ ⚠️  Voucher không tương thích                        │
│                                                     │
│ Voucher "{voucherCode}" không hỗ trợ                │
│ phương thức "{paymentMethodLabel}".                 │
│                                                     │
│ Bạn muốn:                                          │
│                                                     │
│ [Giữ voucher]    [Xóa voucher & tiếp tục]          │
└─────────────────────────────────────────────────────┘
```

Pattern: Dùng `Modal` transparent + animated slide-up (hoặc `@gorhom/bottom-sheet` snapPoints `['35%']`).
Bấm backdrop → gọi `onKeepVoucher`.

---

## Files cần sửa

### `components/radio/payment-method-option.tsx`

Thêm prop `onSelectDisabled`:

```typescript
interface PaymentMethodOptionProps {
  // ...existing props...
  onSelectDisabled?: (method: PaymentMethod) => void
}

// Sửa Pressable handler:
const handlePress = useCallback(() => {
  if (isSupported) {
    onSelect(method)
  } else if (onSelectDisabled) {
    onSelectDisabled(method) // Trigger conflict dialog thay vì ignore
  }
}, [isSupported, onSelect, onSelectDisabled, method])

// Bỏ disabled={!isSupported} — cho phép bấm khi conflict
// Giữ nguyên visual style grayed out
```

### `components/radio/payment-method-radio-group.tsx`

Thêm prop `onConflict`:

```typescript
interface PaymentMethodRadioGroupProps {
  // ...existing props...
  onConflict?: (blockedMethod: PaymentMethod) => void
}

// Truyền onSelectDisabled xuống PaymentMethodOption:
<PaymentMethodOption
  // ...existing props...
  onSelectDisabled={order?.voucher ? (method) => onConflict?.(method) : undefined}
/>
```

### `app/payment/[order].tsx`

State + handlers mới:

```typescript
const [conflictPendingMethod, setConflictPendingMethod] =
  useState<PaymentMethod | null>(null)
const [showConflictSheet, setShowConflictSheet] = useState(false)
const [isRemovingVoucher, setIsRemovingVoucher] = useState(false)

const { mutate: updateVoucher } = isLoggedIn
  ? useUpdateVoucherInOrder()
  : useUpdatePublicVoucherInOrder()

const handlePaymentMethodConflict = useCallback(
  (blockedMethod: PaymentMethod) => {
    setConflictPendingMethod(blockedMethod)
    setShowConflictSheet(true)
  },
  [],
)

const handleKeepVoucher = useCallback(() => {
  setShowConflictSheet(false)
  setConflictPendingMethod(null)
}, [])

const handleRemoveVoucher = useCallback(() => {
  if (!orderSlug || !order) return
  setIsRemovingVoucher(true)

  const orderItems = order.orderItems.map((item) => ({
    quantity: item.quantity,
    variant: item.variant?.slug ?? '',
    promotion: item.promotion?.slug ?? null,
    order: orderSlug,
  }))

  updateVoucher(
    { slug: orderSlug, voucher: null, orderItems },
    {
      onSuccess: () => {
        setShowConflictSheet(false)
        setIsRemovingVoucher(false)
        // Apply pending payment method
        if (conflictPendingMethod) {
          handleMethodChange(conflictPendingMethod)
        }
        setConflictPendingMethod(null)
        // Cancel loyalty reservation (Feature 3 sẽ handle nhưng gọi trực tiếp để tránh race)
        if ((order.accumulatedPointsToUse ?? 0) > 0) {
          cancelLoyaltyReservation(orderSlug)
        }
        refetchOrder()
      },
      onError: () => {
        setIsRemovingVoucher(false)
        showErrorToastMessage('Không thể xóa voucher')
      },
    },
  )
}, [
  orderSlug,
  order,
  conflictPendingMethod,
  updateVoucher,
  handleMethodChange,
  refetchOrder,
])
```

Truyền xuống component + mount sheet:

```tsx
;<PaymentMethodSection
  // ...existing props...
  onConflict={handlePaymentMethodConflict}
/>

{
  /* Conflict sheet */
}
;<VoucherConflictBottomSheet
  visible={showConflictSheet}
  voucherCode={order?.voucher?.code ?? ''}
  paymentMethodLabel={getPaymentMethodLabel(conflictPendingMethod)}
  isDark={isDark}
  primaryColor={primaryColor}
  isRemoving={isRemovingVoucher}
  onKeepVoucher={handleKeepVoucher}
  onRemoveVoucher={handleRemoveVoucher}
/>
```

Cần expose `onConflict` từ `PaymentMethodSection` ra ngoài (thêm vào props interface).

---

## Helper

```typescript
// Mapping label tiếng Việt
function getPaymentMethodLabel(method: PaymentMethod | null): string {
  if (!method) return ''
  const labels: Record<PaymentMethod, string> = {
    [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản',
    [PaymentMethod.CASH]: 'Tiền mặt',
    [PaymentMethod.POINT]: 'Điểm tích lũy',
    [PaymentMethod.CREDIT_CARD]: 'Thẻ tín dụng',
  }
  return labels[method] ?? method
}
```

---

## Edge Cases

| Case                                              | Xử lý                                                                                        |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Bấm backdrop → đóng sheet                         | Treat như "Giữ voucher" → gọi `onKeepVoucher`                                                |
| `isRemoving = true`                               | Disable cả 2 buttons, spinner trên "Xóa voucher"                                             |
| Payment method pending bị invalid sau xóa voucher | Trước khi gọi `handleMethodChange`, kiểm tra method còn trong `getAvailablePaymentMethods()` |
| Double conflict (user click nhanh)                | `conflictPendingMethod` chỉ lưu 1 giá trị, idempotent                                        |
| `order.voucher` null khi sheet đang mở            | Check trong `handleRemoveVoucher`, đóng sheet sớm                                            |
| `accumulatedPointsToUse > 0` khi xóa voucher      | Gọi `cancelLoyaltyReservation` trực tiếp trước `refetchOrder`                                |

---

## Thứ tự implement

1. Thêm `onSelectDisabled` vào `PaymentMethodOption` — cho phép bấm khi không supported
2. Thêm `onConflict` vào `PaymentMethodRadioGroup`, truyền `onSelectDisabled` xuống
3. Expose `onConflict` qua `PaymentMethodSection` props
4. Tạo `voucher-conflict-bottom-sheet.tsx` với layout + 2 actions
5. Thêm state `conflictPendingMethod` + `showConflictSheet` + `isRemovingVoucher` vào `PaymentPageContent`
6. Implement `handleRemoveVoucher` với `updateVoucherInOrder`
7. Wire `onConflict` → sheet → mount trong JSX

---

## Verification

- Có voucher chỉ support `bank-transfer` → chọn `cash` → Bottom Sheet hiện
- Sheet hiển thị đúng tên voucher + tên method
- "Giữ voucher" → sheet đóng, payment method không đổi
- "Xóa voucher" → spinner → API remove voucher → sheet đóng → method `cash` được select → refetch
- Bấm backdrop → sheet đóng, method không đổi
- Không có voucher → click bất kỳ method → không hiện sheet
