# Payment Page: Detailed Logic & Use Cases

## 1. Loyalty Points Usage Logic

### 1.1 Max Usable Points Calculation

**File**: `src/components/app/input/loyalty-point-input.tsx` (Lines 42-48)

```typescript
// Max usable points = MIN(user's total points, remaining order total)
const maxUsablePoints = Math.min(totalPoints, orderTotal)

// Example:
// totalPoints: 500,000 points
// orderTotal: 600,000 VND
// maxUsablePoints: 500,000 (limited by balance, not order total)

// Example 2:
// totalPoints: 1,500,000 points
// orderTotal: 400,000 VND
// maxUsablePoints: 400,000 (limited by order total)
```

**Logic Explanation:**
```
Why take the minimum?

1. Never allow more than user has:
   ✗ Can't use 1M points if user only has 500K
   → Math.min checks user balance

2. Never deduct more than order total:
   ✗ Can't reduce amount to negative
   → Math.min checks order total

Result: maxUsablePoints = the lesser of both
```

### 1.2 Points Input Validation

**File**: `src/components/app/input/loyalty-point-input.tsx`

#### Non-numeric Input Filtering (Lines 51-64)

```typescript
const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const value = e.target.value

  // Strip non-numeric characters: "/\D/g" = remove all non-digits
  const numericValue = value.replace(/\D/g, '')

  setPointsInput(numericValue ? parseInt(numericValue) : '')

  // If input is cleared:
  if (!numericValue) {
    // Auto-cancel reservation if points were previously applied
    if (usedPoints > 0) {
      cancelReservation()
    }
  }
}

// Examples:
// User types "100abc" → stored as "100"
// User types "50K" → stored as "50"
// User deletes all → cancels reservation automatically
```

#### Auto-Cap Logic (Lines 68-70)

```typescript
const handleApply = () => {
  // If user enters 600K but max is 400K:
  const finalAmount = Math.min(pointsInput, maxUsablePoints)
  // finalAmount = 400K

  applyLoyaltyPoint(finalAmount)
}
```

**UI Display for Exceeding Limit** (Lines 153-157):
```typescript
{maxUsablePoints < totalPoints && (
  <p className="text-warning">
    Limited by order total. Max: {maxUsablePoints.toLocaleString()} points
  </p>
)}
```

### 1.3 "Use All Points" Toggle Button Logic

**File**: `src/components/app/select/staff-loyalty-point-selector.tsx` (Lines 41-100)

#### Staff Selector Implementation:
```typescript
export const StaffLoyaltyPointSelector = ({ usedPoints }: Props) => {
  const [useAllPoints, setUseAllPoints] = useState(false)
  const [pointsInput, setPointsInput] = useState('')

  // Calculate max usable points
  const maxUsablePoints = Math.min(totalPoints, orderTotal)

  // When toggle is turned ON
  const handleToggle = (checked: boolean) => {
    setUseAllPoints(checked)

    if (checked) {
      // Auto-apply maximum points
      applyLoyaltyPoint(maxUsablePoints)
      setPointsInput('')  // Clear manual input
    } else {
      // Cancel points
      cancelReservationForOrder()
      setPointsInput('')
    }
  }

  return (
    <>
      {/* Toggle switch */}
      <Switch
        checked={useAllPoints}
        onCheckedChange={handleToggle}
        label="Use all available points"
      />

      {/* Show input ONLY if toggle is OFF */}
      {!useAllPoints && (
        <LoyaltyPointInput
          maxPoints={maxUsablePoints}
          onApply={applyLoyaltyPoint}
        />
      )}

      {/* Show applied discount */}
      {usedPoints > 0 && (
        <div className="text-green">
          Save: {usedPoints.toLocaleString()} đ
          Total: {(orderTotal - usedPoints).toLocaleString()} đ
        </div>
      )}
    </>
  )
}
```

**Client Selector** (Lines 45-84):
- Same functionality as staff selector
- Includes loading state handling (line 29)
- Error boundaries (lines 61-65)
- Auto-sync logic: If `usedPoints === maxUsablePoints`, auto-set toggle ON

### 1.4 Quick Selection Buttons (1K, 2K, 5K, Max)

**File**: `src/components/app/input/loyalty-point-input.tsx` (Lines 82-90)

```typescript
// Predefined quick selection amounts
const quickSelectOptions = [1000, 2000, 3000, 5000, 10000, 20000, 50000]

// Filter to show only options less than max
const visibleOptions = quickSelectOptions.filter(opt => opt < maxUsablePoints)

// Add "Maximum" button if needed
if (maxUsablePoints > Math.max(...visibleOptions)) {
  visibleOptions.push({
    label: 'Maximum',
    value: maxUsablePoints
  })
}

// Handle quick selection
const handleQuickSelect = (amount: number) => {
  const finalAmount = Math.min(amount, maxUsablePoints)
  setPointsInput(finalAmount)
  applyLoyaltyPoint(finalAmount)
}

// Render buttons
<div className="quick-buttons">
  {visibleOptions.map(opt => (
    <Button
      key={opt.value}
      onClick={() => handleQuickSelect(opt.value)}
      variant="outline"
    >
      {opt.label}  {/* "1K", "2K", or "Maximum" */}
    </Button>
  ))}
</div>
```

**Button Display Logic:**
```
Scenario 1: Max = 500K, totalPoints = 100K
├─ Show: 1K, 2K, 3K, 5K, 10K, 20K, 50K, 100K (Maximum)
│  (50K < 100K, so show Maximum)

Scenario 2: Max = 500K, totalPoints = 500K
├─ Show: 1K, 2K, 3K, 5K, 10K, 20K, 50K
├─ 500K > 50K, so automatically add "Maximum" button
│  → 8 buttons total

Scenario 3: Max = 80K, totalPoints = 100K
├─ Show: 1K, 2K, 3K, 5K, 10K, 20K, 50K
├─ 80K < 100K (limited by order total)
└─ Add "Maximum (80K)" button
   → Still shows 8 buttons
```

### 1.5 Real-Time Calculation When Points Change

**File**: `src/components/app/select/staff-loyalty-point-selector.tsx` (Lines 123-134)

```typescript
// When points change, automatically recalculate and display
useEffect(() => {
  if (usedPoints > 0) {
    const discount = usedPoints
    const newTotal = orderTotal - discount

    // Display in UI:
    // "Savings: 100,000 đ"
    // "New Total: 900,000 đ"
  }
}, [usedPoints, orderTotal])

// Display component:
<div className="discount-display">
  <span className="text-green">
    -{usedPoints.toLocaleString()}đ
  </span>
  <span className="text-primary">
    Total: {(orderTotal - usedPoints).toLocaleString()}đ
  </span>
</div>
```

### 1.6 Points Interaction with Voucher Discounts

**File**: `src/app/system/payment/payment-page.tsx` (Lines 44-75, 153)

```typescript
// Both voucher and points are passed to calculation function
const totals = calculatePlacedOrderTotals(
  orderItems,
  deliveryFee,
  voucher,           // Applied voucher discount
  accumulatedPointsToUse  // Applied loyalty points
)

// Formula:
// finalTotal = subtotal - promotionDiscount - voucherDiscount + deliveryFee - accumulatedPointsToUse

// When voucher changes:
// Points are automatically reset to 0 (lines 33-39 in loyalty-point-selector.tsx)

useEffect(() => {
  // Detect voucher change
  if (previousVoucher !== currentVoucher) {
    // Auto-reset points
    setPointsInput(0)
    setUseAllPoints(false)
    cancelReservationForOrder()
  }
}, [currentVoucher])
```

---

## 2. Payment Method - Voucher Compatibility Logic

### 2.1 Payment Methods Filtering Based on Voucher

**File**: `src/utils/payment-resolver.ts` (Lines 46-54)

```typescript
export function usePaymentResolver(order: Order) {
  // Step 1: Get voucher's allowed payment methods
  const voucherMethods = order?.voucher?.voucherPaymentMethods
    .map((v) => v.paymentMethod)
    ?? []

  // Step 2: Get all available methods (role-based)
  const allAvailableMethods = [
    // CUSTOMER: BANK_TRANSFER, POINT
    // STAFF/ADMIN: BANK_TRANSFER, CASH, CREDIT_CARD, POINT
    // GUEST: BANK_TRANSFER only
  ]

  // Step 3: Filter to intersection if voucher has restrictions
  const effectiveMethods =
    voucherMethods.length > 0
      ? voucherMethods.filter((m) => allAvailableMethods.includes(m))
      : allAvailableMethods

  return { effectiveMethods }
}
```

**Filtering Logic Diagram:**
```
┌─────────────────────────────────────────────────┐
│ PAYMENT METHOD FILTERING FLOW                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ Role = STAFF                                    │
│ └─ Available: [BANK_TRANSFER, CASH, CREDIT_CARD, POINT]
│                                                 │
│ Has Voucher?                                    │
│ ├─ NO: Use all available                        │
│ │  └─ Effective: [BANK_TRANSFER, CASH, CREDIT_CARD, POINT]
│ │                                               │
│ └─ YES: Check voucher methods                   │
│    └─ Voucher allows: [BANK_TRANSFER, CASH]    │
│       └─ Intersection of both:                  │
│          Effective: [BANK_TRANSFER, CASH]      │
│          (CREDIT_CARD and POINT disabled)      │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2.2 Role-Based Available Payment Methods

**File**: `src/utils/payment-resolver.ts` (Lines 20-42)

```typescript
const getAvailableMethodsByRole = (userRole?: UserRole) => {
  switch (userRole) {
    case UserRole.CUSTOMER:
      return [PaymentMethod.BANK_TRANSFER, PaymentMethod.POINT]

    case UserRole.STAFF:
    case UserRole.ADMIN:
      return [
        PaymentMethod.BANK_TRANSFER,
        PaymentMethod.CASH,
        PaymentMethod.CREDIT_CARD,
        PaymentMethod.POINT
      ]

    case UserRole.GUEST:
    default:
      return [PaymentMethod.BANK_TRANSFER]  // Guest can only use bank transfer
  }
}
```

**Role Comparison Table:**
| Role | Available Methods | Why |
|------|---|---|
| **GUEST** | BANK_TRANSFER only | No identity verification, security |
| **CUSTOMER** | BANK_TRANSFER, POINT | Can use personal payment or loyalty points |
| **STAFF/ADMIN** | BANK_TRANSFER, CASH, CREDIT_CARD, POINT | Can receive any payment type for customer orders |

### 2.3 VoucherPaymentMethods Field Structure

**File**: Payment entity / Voucher entity

```typescript
// Voucher data with payment method restrictions:
{
  slug: 'VOUCHER-ABC',
  code: 'SAVE20',
  voucherPaymentMethods: [
    { paymentMethod: 'BANK_TRANSFER' },
    { paymentMethod: 'CASH' }
  ]
  // This voucher ONLY works with Bank Transfer or Cash
  // Cannot be used with POINT or CREDIT_CARD
}

// Accessing in component:
const allowedMethods = voucher?.voucherPaymentMethods
  ?.map((v) => v.paymentMethod)
// Result: ['BANK_TRANSFER', 'CASH']
```

### 2.4 Check Payment Method Compatibility

**File**: `src/app/system/payment/payment-page.tsx` (Lines 107-109)

```typescript
// Simple check: Are there any compatible methods left?
const hasVoucherPaymentConflict = useMemo(() => {
  return (
    effectiveMethods.length === 0 &&  // No methods available
    !!voucher                         // But voucher exists
  )
}, [effectiveMethods.length, voucher])

// This flag triggers the warning dialog
// If true → Show "Remove Voucher" dialog immediately
```

**Validation Flow:**
```
┌──────────────────────────────┐
│ Payment Method Validation     │
├──────────────────────────────┤
│                              │
│ effectiveMethods.length > 0? │
│ ├─ YES:                      │
│ │  ✓ Can proceed             │
│ │  ✓ Dialog won't show       │
│ │                            │
│ └─ NO (all 0):               │
│    ├─ Has voucher?           │
│    │  ├─ YES:                │
│    │  │  ⚠️ CONFLICT!         │
│    │  │  → Show dialog        │
│    │  │                       │
│    │  └─ NO:                  │
│    │     ✓ No conflict        │
│    │     (User just has no    │
│    │      payment options)    │
│                              │
└──────────────────────────────┘
```

### 2.5 Changing Payment Method While Voucher Applied

**File**: `src/app/system/payment/payment-page.tsx` (Lines 392-437)

```typescript
const handleSelectPaymentMethod = async (method: PaymentMethod) => {
  // STEP 1: Save current state (for rollback if needed)
  const previousPaymentMethod = selectedPaymentMethod

  // STEP 2: Update UI immediately (optimistic)
  setSelectedPaymentMethod(method)
  setPendingPaymentMethod(method)

  // STEP 3: Check if selected method is disabled
  const isMethodDisabled = !effectiveMethods.includes(method)

  if (isMethodDisabled) {
    // Method conflicts with voucher
    setIsRemoveVoucherOption(true)
    isRemovingVoucherRef.current = true
    return  // Don't proceed further
  }

  // STEP 4: If voucher exists, validate method compatibility via API
  if (voucher) {
    const validationResult = await validateVoucherPaymentMethod({
      slug: voucher.slug,
      paymentMethod: method
    })

    // STEP 5A: If valid, confirm the selection
    if (validationResult.isValid) {
      updateStore({
        paymentMethod: method
      })
      setPendingPaymentMethod(undefined)
      // Continue to payment
    }

    // STEP 5B: If invalid, restore previous and show dialog
    else {
      setSelectedPaymentMethod(previousPaymentMethod)
      setIsRemoveVoucherOption(true)
      isRemovingVoucherRef.current = true
    }
  } else {
    // No voucher, just confirm selection
    updateStore({
      paymentMethod: method
    })
    setPendingPaymentMethod(undefined)
  }
}
```

**Step-by-Step Example:**
```
Scenario: Payment Method Selection with Voucher

State Before:
├─ Voucher: "SAVE20" (allows BANK_TRANSFER, CASH only)
├─ Selected: BANK_TRANSFER ✓
├─ Effective Methods: [BANK_TRANSFER, CASH]
└─ Available (POINT, CREDIT_CARD are disabled)

User clicks: POINT payment method
    ↓
STEP 1: Save previousPaymentMethod = BANK_TRANSFER
    ↓
STEP 2: Update UI: selectedPaymentMethod = POINT
    ↓
STEP 3: isMethodDisabled = !effectiveMethods.includes(POINT)
        = !['BANK_TRANSFER', 'CASH'].includes(POINT)
        = true
        → Method IS disabled
    ↓
STEP 4: Set isRemoveVoucherOption = true
        → Show dialog
    ↓
User clicks "Cancel" in dialog:
├─ Revert: selectedPaymentMethod = BANK_TRANSFER
├─ Close dialog
└─ Stay on payment page with BANK_TRANSFER

User clicks "Remove Voucher" in dialog:
├─ Remove voucher from order
├─ Recalculate effective methods (now includes POINT)
├─ Set selectedPaymentMethod = POINT
├─ Proceed to payment
```

---

## 3. Warning Dialog Logic

### 3.1 When Dialog Appears

**File**: `src/app/system/payment/payment-page.tsx` (Lines 211-237)

Dialog appears in 3 scenarios:

#### Scenario 1: Automatic Trigger - No Compatible Methods

```typescript
// Lines 211-214
useEffect(() => {
  // If there's a voucher but NO compatible payment methods left
  if (!isRemovingVoucherRef.current && hasVoucherPaymentConflict) {
    setIsRemoveVoucherOption(true)
    isRemovingVoucherRef.current = true
  }
}, [hasVoucherPaymentConflict])

// Example:
// Voucher allows: [BANK_TRANSFER]
// But user is CUSTOMER role
// CUSTOMER can only use: [BANK_TRANSFER, POINT]
// Intersection: [BANK_TRANSFER]
// If BANK_TRANSFER is somehow unavailable:
// → Conflict exists → Dialog shows
```

#### Scenario 2: User Selects Disabled Method

```typescript
// Lines 405-406
if (isMethodDisabled) {
  setIsRemoveVoucherOption(true)
  isRemovingVoucherRef.current = true
  return
}

// Example:
// Available: [BANK_TRANSFER, CASH]
// User clicks: CREDIT_CARD (disabled)
// → Dialog shows
```

#### Scenario 3: API Validation Fails

```typescript
// Lines 425
// validateVoucherPaymentMethod API call returns error
onError: () => {
  setSelectedPaymentMethod(previousPaymentMethod)
  setIsRemoveVoucherOption(true)
  isRemovingVoucherRef.current = true
}

// Example:
// Selected BANK_TRANSFER seems compatible
// But API validation fails (backend logic)
// → Dialog shows to offer removal
```

### 3.2 Dialog Component Display

**File**: `src/components/app/dialog/staff-remove-voucher-when-paying-dialog.tsx`

```typescript
export const StaffRemoveVoucherWhenPayingDialog = ({
  isOpen,
  onCancel,
  onSuccess,
}: Props) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleRemoveVoucher = async () => {
    setIsLoading(true)

    try {
      // API call to remove voucher
      await updateVoucherInOrder({
        orderSlug: orderId,
        voucher: null  // Set to null to remove
      })

      // Show success message
      showToast({
        type: 'success',
        message: 'Voucher removed successfully'
      })

      // Close dialog immediately
      setIsOpen(false)

      // Call parent callback
      onSuccess?.()
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to remove voucher'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent>
        {/* Title */}
        <DialogHeader>
          <DialogTitle>Voucher Not Applicable</DialogTitle>
        </DialogHeader>

        {/* Description */}
        <div className="py-4">
          <p>
            The selected payment method is not supported by this voucher.
            You can either:
            1. Select another payment method, or
            2. Remove the voucher and use this method
          </p>
        </div>

        {/* Action buttons */}
        <DialogFooter>
          {/* Cancel button - reverts to previous */}
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>

          {/* Remove voucher button - destructive */}
          <Button
            variant="destructive"
            onClick={handleRemoveVoucher}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner className="mr-2" />
                Removing...
              </>
            ) : (
              'Remove Voucher'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 3.3 User Options in Dialog

**Cancel Button** (Lines 48-58):
```typescript
const handleCancel = () => {
  // Option 1: Keep current voucher, revert to previous payment method

  // STEP 1: Reset to previous payment method
  setSelectedPaymentMethod(previousPaymentMethod)

  // STEP 2: Update store with previous method
  updatePaymentStore({
    paymentMethod: previousPaymentMethod
  })

  // STEP 3: Call parent callback
  onCancel?.()

  // STEP 4: Clear pending states
  setPendingPaymentMethod(undefined)
  setIsRemoveVoucherOption(false)

  // Dialog closes automatically (state update)
}

// Result:
// ✓ Voucher is KEPT
// ✓ Payment method reverts to previous
// ✓ No API calls made
// ✓ User stays on payment page
```

**Remove Voucher Button** (Lines 60-107):
```typescript
const handleRemoveVoucher = async () => {
  // Option 2: Remove voucher, allow new payment method

  // STEP 1: Mark as removing (prevent duplicate dialogs)
  isRemovingVoucherRef.current = true
  setIsLoading(true)

  // STEP 2: Call API to remove voucher
  const response = await updateVoucherInOrder({
    orderSlug: orderId,
    voucher: null,  // ← Remove voucher
    orderItems: currentItems
  })

  // STEP 3: Show success toast
  toast({
    type: 'success',
    message: 'Removed voucher successfully'
  })

  // STEP 4: Close dialog immediately
  setIsOpen(false)

  // STEP 5: Call parent success callback
  onSuccess?.()

  // Result:
  // ✓ Voucher removed
  // ✓ Payment method can now be updated
  // ✓ Order recalculated without voucher discount
  // ✓ Loyalty points reset to 0
  // ✓ User can now select any allowed method
}
```

### 3.4 Dialog Triggering & Dismissal

**Auto-Trigger Logic** (Lines 811-866 in payment-page.tsx):

```typescript
// Render dialog
<StaffRemoveVoucherWhenPayingDialog
  isOpen={isRemoveVoucherOption}
  previousPaymentMethod={previousPaymentMethod}
  pendingPaymentMethod={pendingPaymentMethod}
  onCancel={() => {
    // User clicked "Cancel"
    setSelectedPaymentMethod(previousPaymentMethod)
    setPendingPaymentMethod(undefined)
    setIsRemoveVoucherOption(false)
    isRemovingVoucherRef.current = false
  }}
  onSuccess={() => {
    // User clicked "Remove Voucher"
    setIsRemoveVoucherOption(false)

    // After removal, update to new method
    setPendingPaymentMethod(undefined)

    // Refetch order (voucher is now gone)
    refetchOrder()

    // Re-initialize payment with new method
    initializePayment()

    // Clear ref after delay (prevent race conditions)
    setTimeout(() => {
      isRemovingVoucherRef.current = false
    }, 100)
  }}
/>
```

**Auto-Close Condition** (Lines 216-217):
```typescript
// Watch for when voucher becomes null
useEffect(() => {
  // If voucher was removed, close dialog
  if (!voucher && isRemoveVoucherOption) {
    setIsRemoveVoucherOption(false)
  }
}, [voucher])
```

### 3.5 Duplicate Prevention with Ref

**Purpose**: Prevent showing dialog multiple times during payment method changes

**File**: Lines 49, 206-208, 819-821, 830, 860

```typescript
const isRemovingVoucherRef = useRef(false)

// Flag is set when starting removal
const handleRemoveVoucher = async () => {
  isRemovingVoucherRef.current = true  // LINE 821
  // ... API call ...
}

// Flag is checked before showing dialog
useEffect(() => {
  if (!isRemovingVoucherRef.current && hasVoucherPaymentConflict) {
    setIsRemoveVoucherOption(true)  // LINE 211
    isRemovingVoucherRef.current = true
  }
}, [hasVoucherPaymentConflict])

// Flag is cleared after removal completes
const handleSuccess = () => {
  setIsRemoveVoucherOption(false)

  // ... other logic ...

  // Clear flag after delay to let state updates finish
  setTimeout(() => {
    isRemovingVoucherRef.current = false  // LINE 862
  }, 100)
}
```

**Why Needed:**
```
Without ref guard:

User changes payment method
  ↓
Dialog shows → isRemoveVoucherOption = true
  ↓
State update triggers useEffect
  ↓
useEffect checks: hasVoucherPaymentConflict = true
  ↓
Tries to show dialog AGAIN (duplicate!)
  ↓
User confused (dialog appears twice)

With ref guard:

User changes payment method
  ↓
Dialog shows → isRemoveVoucherOption = true
             → isRemovingVoucherRef.current = true
  ↓
State update triggers useEffect
  ↓
useEffect checks: isRemovingVoucherRef.current = true
  ↓
Guard prevents dialog from showing twice
  ↓
Dialog shows only once ✓
```

---

## 4. Voucher Selection/Re-selection Logic

### 4.1 Opening Voucher Selection Sheet

**File**: `src/app/system/payment/payment-page.tsx` (Lines 798-808)

```typescript
<StaffVoucherListSheetInPayment
  order={order?.result}
  onSuccess={() => {
    // After voucher is applied, refetch everything
    refetchOrder()

    // Re-initialize payment calculator
    initializePaymentCalculator()
  }}
/>

// Sheet is rendered with built-in trigger button:
<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
  <SheetTrigger asChild>
    <Button>
      {voucher ? 'Change Voucher' : 'Add Voucher'}
    </Button>
  </SheetTrigger>

  <SheetContent>
    {/* Voucher list and selection */}
  </SheetContent>
</Sheet>
```

**Trigger Display Logic:**
```typescript
// Show different text based on voucher state
const triggerButtonText = useMemo(() => {
  if (orderData?.voucher) {
    return `Change Voucher: ${orderData.voucher.code}`
  }
  return 'Add Voucher'
}, [orderData?.voucher])
```

### 4.2 Can Voucher Be Changed After Selection

**Yes** - Full workflow to change vouchers:

**File**: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` (Lines 176-294)

```typescript
// User can open sheet anytime to change
const handleOpenSheet = () => {
  setSheetOpen(true)

  // When sheet opens, pre-select current voucher (if any)
  if (orderData?.voucher) {
    setSelectedVoucher(orderData.voucher.slug)
  }
}

// User can click different voucher to switch
const handleVoucherClick = (voucher) => {
  // Toggle: if clicking same voucher, deselect
  if (selectedVoucher === voucher.slug) {
    setSelectedVoucher(null)  // Deselect
  } else {
    setSelectedVoucher(voucher.slug)  // Select new
  }
}

// Complete selection saves the change
const handleCompleteSelection = async () => {
  // New voucher is different from current
  if (selectedVoucher !== orderData?.voucher?.slug) {
    // Validate and apply new voucher
    await applyNewVoucher(selectedVoucher)
  }

  setSheetOpen(false)
}
```

### 4.3 Remove/Clear Current Voucher

**File**: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` (Lines 191-223)

```typescript
// User deselects all vouchers and completes selection
const handleCompleteSelection = async () => {
  // If NO voucher selected
  if (!selectedVoucher) {
    // And there IS a current voucher
    if (orderData?.voucher) {
      // Remove it
      await removeCurrentVoucher()
    }

    // Close sheet
    setSheetOpen(false)
    return
  }

  // ... otherwise apply new voucher
}

// API call to remove
const removeCurrentVoucher = async () => {
  try {
    const response = await updateVoucherInOrder({
      orderSlug: orderId,
      voucher: null,  // ← Set to null to remove
      orderItems: currentOrderItems
    })

    // Show success
    toast.success('Voucher removed')

    // Update store
    orderFlowStore.setVoucher(null)

    // Reset points to 0
    pointsStore.resetPoints()
  } catch (error) {
    toast.error('Failed to remove voucher')
  }
}
```

**UI for Removal:**
```typescript
// Visual indicator when voucher is selected/deselected
<VoucherCard
  voucher={voucher}
  isSelected={selectedVoucher === voucher.slug}
  onClick={() => handleVoucherClick(voucher)}
>
  {isSelected && (
    <div className="selected-badge">
      ✓ Selected
    </div>
  )}
</VoucherCard>

// Complete button saves selection (or removes if none selected)
<Button onClick={handleCompleteSelection}>
  {selectedVoucher ? 'Apply Voucher' : 'Remove Voucher'}
</Button>
```

### 4.4 What Happens to Points When Voucher Changed

**File**: `src/components/app/select/loyalty-point-selector.tsx` (Lines 33-39)

When order state updates (voucher changes), points are automatically reset:

```typescript
// Watch for order changes
useEffect(() => {
  // When voucher changes, accumulatedPointsToUse becomes 0

  // If points were applied, reset them
  setPointsInput(usedPoints)  // Now 0

  if (usedPoints === 0 && useAllPoints) {
    // Reset "Use All Points" toggle
    setUseAllPoints(false)
  }

  // Cancel any pending reservations
  cancelReservationForOrder()
}, [usedPoints, useAllPoints])

// Result:
// ✓ Points input field is cleared
// ✓ "Use All Points" toggle is turned OFF
// ✓ Points reservation is cancelled on backend
// ✓ User must reapply points with new voucher
```

### 4.5 Reapply or Select Different Voucher

**File**: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` (Lines 297-313)

```typescript
// When sheet opens, sync with current state
useEffect(() => {
  if (sheetOpen) {
    // Pre-select current voucher
    setSelectedVoucher(orderData?.voucher?.slug)
  }
}, [orderData?.voucher, sheetOpen])

// User can select different voucher
const handleVoucherSelection = (voucherSlug) => {
  // Deselect if clicking same
  if (selectedVoucher === voucherSlug) {
    setSelectedVoucher(null)
    return
  }

  // Select new one
  setSelectedVoucher(voucherSlug)
}

// When completing:
const handleCompleteSelection = async () => {
  // Same voucher = no API call needed
  if (orderData.voucher?.slug === selectedVoucher) {
    setSheetOpen(false)  // Just close
    return  // Skip API call
  }

  // Different voucher = apply new one
  await applyVoucher(selectedVoucher)
  setSheetOpen(false)
}
```

### 4.6 Validation Flow for New Voucher

**File**: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` (Lines 234-293)

#### Step 1: Client-Side Validation (Lines 235-239)

```typescript
const isVoucherValid = (voucher) => {
  // Check 1: Is voucher active?
  if (voucher.status !== 'ACTIVE') return false

  // Check 2: Has voucher expired?
  if (new Date() > new Date(voucher.expiryDate)) return false

  // Check 3: Does voucher still have usage left?
  if (voucher.remainingCount <= 0) return false

  // Check 4: Does order meet minimum value?
  if (orderTotal < voucher.minOrderValue) {
    toast.warning(`Minimum order: ${voucher.minOrderValue}`)
    return false
  }

  // Check 5: Are eligible products in order?
  const hasEligibleItems = checkApplicableProducts(
    orderItems,
    voucher.applicabilityRule,
    voucher.voucherProducts
  )
  if (!hasEligibleItems) {
    toast.warning('No eligible items in order')
    return false
  }

  // Check 6: Is identity verification required?
  if (voucher.isVerificationIdentity && !userIsVerified) {
    toast.warning('Verify your identity to use this voucher')
    return false
  }

  // Check 7: Valid date range?
  const now = new Date()
  if (now < new Date(voucher.startDate) || now > new Date(voucher.expiryDate)) {
    return false
  }

  return true
}
```

#### Step 2: Duplicate Check (Lines 242-245)

```typescript
if (orderData.voucher?.slug === selectedVoucher) {
  // User selected same voucher that's already applied
  setSheetOpen(false)

  // No API call needed
  return
}
```

#### Step 3: Backend Validation (Lines 268-293)

```typescript
// Validate on backend
const { data: validationResult } = await validateVoucher({
  code: selectedVoucher.code,
  orderSlug: orderId,
  userId: userInfo.id
})

if (!validationResult) {
  toast.error('Voucher validation failed')
  return
}

// If validation passes, apply voucher
const { data: updateResult } = await updateVoucherInOrder({
  orderSlug: orderId,
  voucher: validationResult,  // Apply validated voucher
  orderItems: currentOrderItems
})

if (updateResult) {
  toast.success('Voucher applied')

  // Sync order state
  orderFlowStore.setVoucher(validationResult)

  // Reset points
  accumulatedPointsStore.reset()

  // Close sheet and refresh
  setSheetOpen(false)
  refetchOrderData()
}
```

### 4.7 Handling Payment Method Compatibility During Voucher Change

**File**: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx` (Lines 113-157)

#### Sheet Filters Vouchers by Payment Method

```typescript
// When sheet opens, get current payment method
const paymentMethod = useMemo(() => {
  // Use selected method if available
  if (paymentData?.paymentMethod) {
    return paymentData.paymentMethod
  }

  // Or use voucher's first allowed method
  if (voucher?.voucherPaymentMethods?.length > 0) {
    return voucher.voucherPaymentMethods[0].paymentMethod
  }

  // Default fallback
  return undefined
}, [paymentData?.paymentMethod, voucher?.voucherPaymentMethods])

// Load vouchers filtered by payment method
const loadVouchers = async () => {
  const response = await getEligibleVouchers({
    orderSlug: orderId,
    paymentMethod: paymentMethod,  // ← Filter by this
    userId: userInfo.id
  })

  setVouchers(response.data)
}
```

**Result:**
- User only sees vouchers compatible with current payment method
- When applying new voucher, no conflict dialog appears (already filtered)
- If user later changes payment method, payment page detects conflict and shows dialog

#### Auto-Validation After Voucher Change

```typescript
// After applying new voucher, payment page auto-validates
useEffect(() => {
  // New voucher applied
  if (previousVoucher !== currentVoucher) {
    // Re-check payment method compatibility
    validatePaymentMethodForNewVoucher(currentVoucher)
  }
}, [currentVoucher])

// If conflict detected:
// → Dialog auto-triggers
// → User can remove new voucher or change payment method
```

---

## 5. Complete Interaction Flow Diagram

### 5.1 Full Payment Page Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ PAYMENT PAGE LOAD                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ 1. Initialize State                                          │
│    ├─ Load order data                                        │
│    ├─ Fetch user's loyalty points balance                   │
│    └─ Calculate max usable points                           │
│       = MIN(userPoints, orderTotal)                         │
│                                                              │
│ 2. Determine Available Payment Methods                       │
│    ├─ Get role-based methods                                │
│    ├─ Filter by voucher restrictions (if any)              │
│    └─ Set as `effectiveMethods`                             │
│                                                              │
│ 3. Display Payment Page                                      │
│    ├─ Show current voucher (if any)                         │
│    ├─ Show add/change voucher button                        │
│    ├─ Show loyalty points selector                          │
│    └─ Show payment method radio group                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│ USER INTERACTIONS (Any order)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ INTERACTION 1: Apply Loyalty Points                         │
│ ─────────────────────────────────────                       │
│ User input: Points amount or "Use All"                      │
│     ↓                                                        │
│ Validation:                                                  │
│ ├─ Input must be numeric                                    │
│ ├─ Input <= maxUsablePoints                                │
│ └─ Input <= userBalance                                     │
│     ↓                                                        │
│ If valid:                                                    │
│ ├─ POST /loyalty-point/apply                               │
│ ├─ Server reserves points                                   │
│ ├─ Update store: accumulatedPointsToUse = amount            │
│ └─ Recalculate totals                                       │
│                                                              │
│                                                              │
│ INTERACTION 2: Apply/Change Voucher                         │
│ ────────────────────────────────                            │
│ User clicks: "Add Voucher" or "Change Voucher"             │
│     ↓                                                        │
│ Open sheet with eligible vouchers                           │
│ ├─ Pre-select current voucher (if any)                      │
│ └─ Filter by payment method compatibility                   │
│     ↓                                                        │
│ User selects voucher (or deselects all)                     │
│     ↓                                                        │
│ Validation:                                                  │
│ ├─ Client-side checks (active, not expired, etc)           │
│ ├─ API validation (backend confirms)                        │
│ └─ Skip if same voucher selected                            │
│     ↓                                                        │
│ If valid:                                                    │
│ ├─ PATCH /orders/{slug}/voucher                            │
│ ├─ Update store: orderData.voucher = new voucher            │
│ ├─ AUTO-RESET: accumulatedPointsToUse = 0                  │
│ └─ Recalculate totals                                       │
│                                                              │
│                                                              │
│ INTERACTION 3: Select Payment Method                        │
│ ─────────────────────────────────────                       │
│ User clicks payment method radio                            │
│     ↓                                                        │
│ Check 1: Is method disabled by voucher?                     │
│ ├─ If YES:                                                   │
│ │  ├─ Show "Remove Voucher" dialog                          │
│ │  ├─ User options:                                         │
│ │  │  A. Cancel → Revert to previous method (keep voucher) │
│ │  │  B. Remove → Apply new method, remove voucher          │
│ │  └─ Handle selection                                      │
│ │                                                            │
│ └─ If NO: Proceed to Step 2                                 │
│                                                              │
│ Check 2: Has voucher? Validate with API                     │
│ ├─ If validation passes: Confirm method                     │
│ └─ If validation fails: Show dialog (same as above)         │
│                                                              │
│ Update store: paymentMethod = selected                      │
│                                                              │
│                                                              │
│ INTERACTION 4: Confirm Payment                              │
│ ────────────────────────────                                │
│ User clicks: "Confirm Payment" / "Pay Now"                 │
│     ↓                                                        │
│ Final validation:                                            │
│ ├─ All required fields filled?                              │
│ ├─ Points + total > 0?                                      │
│ ├─ Payment method selected?                                 │
│ └─ Voucher still applicable?                                │
│     ↓                                                        │
│ POST /payment/initiate                                      │
│ {                                                            │
│   amount: finalTotal,  ← After all discounts                │
│   paymentMethod: selected,                                  │
│   voucher: {...},      ← If applied                         │
│   accumulatedPointsToUse: points,  ← If applied            │
│ }                                                            │
│     ↓                                                        │
│ Payment created, show QR/instructions                       │
│ Polling starts for order status                             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Dialog Trigger Decision Tree

```
┌─────────────────────────────────────────────────────┐
│ USER SELECTS PAYMENT METHOD                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Save: previousPaymentMethod = current              │
│ Update UI: selectedPaymentMethod = new             │
│                                                     │
│ Question 1: Is selected method in effectiveMethods?
│ ├─ NO (disabled by voucher):                       │
│ │  └─ SHOW DIALOG (Option: remove voucher)         │
│ │                                                   │
│ └─ YES (method available):                         │
│    └─ Go to Question 2                             │
│                                                     │
│ Question 2: Is there a voucher applied?            │
│ ├─ NO voucher:                                     │
│ │  └─ CONFIRM selection (no dialog)                │
│ │                                                   │
│ └─ YES voucher:                                    │
│    └─ Go to Question 3                             │
│                                                     │
│ Question 3: Validate with API                      │
│ POST /voucher/validate/payment-method              │
│ {                                                   │
│   paymentMethod: selectedMethod,                    │
│   voucherSlug: currentVoucher                       │
│ }                                                   │
│ ├─ API Error or isValid = false:                  │
│ │  └─ SHOW DIALOG (Option: remove voucher)         │
│ │                                                   │
│ └─ API OK and isValid = true:                     │
│    └─ CONFIRM selection (no dialog)                │
│                                                     │
└─────────────────────────────────────────────────────┘

DIALOG OPTIONS:

┌─ User clicks "Cancel"                              │
│  ├─ Revert: selectedPaymentMethod = previous       │
│  ├─ Update store with previous method              │
│  └─ Keep voucher (no changes)                      │
│                                                     │
└─ User clicks "Remove Voucher"                      │
   ├─ API: Remove voucher from order                 │
   ├─ Update store: voucher = null                   │
   ├─ Reset: accumulatedPointsToUse = 0              │
   ├─ Confirm: paymentMethod = selected              │
   ├─ Refetch order (recalculate totals)             │
   └─ Close dialog                                   │
```

---

## 6. Use Cases & Scenarios

### Use Case 1: Customer Applies Points, Then Voucher

```
Initial State:
├─ Order total: 1,000,000 VND
├─ User points: 300,000 available
└─ No voucher, no points applied

Action 1: Apply 100,000 points
├─ POST /loyalty-point/apply { pointsToUse: 100,000 }
├─ Order total becomes: 900,000 VND
└─ UI shows: "Save 100,000 đ"

Action 2: Customer applies "SAVE20" voucher (20% off)
├─ Voucher discount: 900,000 * 20% = 180,000 VND
│  (calculated on subtotal BEFORE points deduction)
├─ New order breakdown:
│  - Subtotal: 900,000 VND (after promo)
│  - Voucher: -180,000 VND
│  - Delivery: +50,000 VND
│  - Points: -100,000 VND (from earlier)
│  = FINAL: 670,000 VND
│
├─ BUT in implementation:
│  When voucher is applied, accumulatedPointsToUse resets to 0
│  So final calculation is:
│  - Subtotal: 1,000,000 VND (original)
│  - Promo: -100,000 VND (per-item 10%)
│  - Voucher: -180,000 VND (20% of subtotal after promo)
│  - Delivery: +50,000 VND
│  - Points: 0 (reset when voucher applied)
│  = FINAL: 770,000 VND
│
└─ User must reapply points: 100,000
   Final: 670,000 VND ✓
```

### Use Case 2: Voucher Payment Method Conflict

```
Initial State:
├─ User role: CUSTOMER
├─ Available methods: [BANK_TRANSFER, POINT]
├─ Applied voucher: "SAVE20" (allows BANK_TRANSFER, CASH only)
├─ Effective methods: [BANK_TRANSFER] (intersection)
└─ Selected method: BANK_TRANSFER

Action: Customer tries to change to POINT payment
├─ STEP 1: Check if POINT in effectiveMethods?
│  → NO (effectiveMethods = [BANK_TRANSFER])
│
├─ STEP 2: isMethodDisabled = true
│
├─ STEP 3: Set isRemoveVoucherOption = true
│
└─ RESULT: Dialog shows
   ┌─────────────────────────────────┐
   │ Option A: Cancel (Click)        │
   │ ├─ Revert: BANK_TRANSFER        │
   │ ├─ Keep voucher "SAVE20"        │
   │ └─ Dialog closes                │
   │                                  │
   │ Option B: Remove Voucher        │
   │ ├─ Remove "SAVE20"              │
   │ ├─ Reset points to 0            │
   │ ├─ Recalc totals without voucher│
   │ ├─ Now can select POINT method  │
   │ └─ Dialog closes                │
   └─────────────────────────────────┘
```

### Use Case 3: Re-selecting Voucher

```
Current State:
├─ Voucher: "SAVE20" applied
├─ Points: 50,000 applied
├─ Total: 670,000 VND

Action: Open voucher sheet and click "Change Voucher"
├─ Sheet opens
├─ Pre-selects "SAVE20" (currently applied)
│
Action: User clicks "SAVE30" voucher (30% off instead)
├─ Deselects "SAVE20"
├─ Selects "SAVE30"
│
Action: Click "Apply Voucher" button
├─ Validation passes
├─ API: PATCH /orders/{slug}/voucher { voucher: SAVE30 data }
├─ Order updated:
│  - Voucher changed: SAVE20 → SAVE30
│  - Points RESET: 50,000 → 0 (auto-reset on voucher change)
│  - Delivery fee recalculated
│  - New total: 700,000 VND (with 30% voucher, no points)
│
│ User sees notification:
│ "Voucher changed and loyalty points were reset.
│  Please reapply your loyalty points if desired."
│
Action: User reapplies points (click "Use All" or manual)
├─ POST /loyalty-point/apply { pointsToUse: maxUsable }
├─ New final total: 650,000 VND
└─ Ready to confirm payment
```

---

## 7. Key Code Files Reference

### Loyalty Points
- **Input Component**: `src/components/app/input/loyalty-point-input.tsx`
  - Lines 42-48: Max calculation
  - Lines 51-64: Input validation
  - Lines 68-70: Auto-cap
  - Lines 76-90: Quick buttons
  - Lines 123-134: Real-time display

- **Selector Component (Staff)**: `src/components/app/select/staff-loyalty-point-selector.tsx`
  - Lines 24-25: Max calculation with context
  - Lines 41-62: Toggle logic
  - Lines 88-100: UI display

### Payment Method Validation
- **Payment Resolver**: `src/utils/payment-resolver.ts`
  - Lines 20-42: Role-based methods
  - Lines 46-54: Voucher filtering

- **Payment Page**: `src/app/system/payment/payment-page.tsx`
  - Lines 107-109: Conflict detection
  - Lines 392-437: Method selection & validation
  - Lines 211-237: Dialog trigger conditions

### Dialog Logic
- **Dialog Component**: `src/components/app/dialog/staff-remove-voucher-when-paying-dialog.tsx`
  - Complete dialog implementation

- **Dialog Integration**: `src/app/system/payment/payment-page.tsx`
  - Lines 811-866: Dialog rendering & callbacks
  - Lines 49, 206-208, 819-821: Ref-based duplicate prevention

### Voucher Selection
- **Voucher Sheet**: `src/components/app/sheet/staff-voucher-list-sheet-in-payment.tsx`
  - Lines 176-294: Selection & validation flow
  - Lines 234-293: Validation steps
  - Lines 113-157: Payment method filtering
  - Lines 297-313: State sync

- **Payment Page Integration**: `src/app/system/payment/payment-page.tsx`
  - Lines 798-808: Sheet rendering
  - Lines 44-75: Order state & calculations

---

## 8. Summary Table

| Feature | Key File | Key Lines | Logic |
|---------|----------|-----------|-------|
| **Points Max Calc** | loyalty-point-input.tsx | 42-48 | MIN(balance, order total) |
| **Input Validation** | loyalty-point-input.tsx | 51-64 | Numeric only, auto-cap |
| **Use All Toggle** | staff-loyalty-point-selector.tsx | 41-62 | Auto-apply max or cancel |
| **Quick Buttons** | loyalty-point-input.tsx | 82-90 | Filter < max, add Maximum |
| **Real-time Calc** | Both selectors | 123-134, 149-160 | Update display on change |
| **Payment Filtering** | payment-resolver.ts | 46-54 | Voucher methods ∩ role methods |
| **Conflict Detection** | payment-page.tsx | 107-109 | effectiveMethods.length === 0 |
| **Method Change** | payment-page.tsx | 392-437 | Check disabled, validate API |
| **Dialog Trigger** | payment-page.tsx | 211-237 | Auto-show on conflict |
| **Dialog Options** | staff-remove-voucher-when-paying-dialog.tsx | 48-107 | Cancel or Remove |
| **Duplicate Prevention** | payment-page.tsx | 49, 206-208, 860 | Use ref to guard |
| **Voucher Sheet** | staff-voucher-list-sheet-in-payment.tsx | 176-294 | Select, validate, apply |
| **Points Reset** | loyalty-point-selector.tsx | 33-39 | Auto-reset on voucher change |
| **Validation Flow** | voucher sheet | 235-293 | Client checks → API validation |

---

## 9. Conclusion

```
┌────────────────────────────────────────────────────┐
│ PAYMENT PAGE LOGIC SUMMARY                         │
├────────────────────────────────────────────────────┤
│                                                    │
│ 1. LOYALTY POINTS:                                 │
│    ✓ Max = MIN(balance, order total)              │
│    ✓ Numeric input with auto-cap                  │
│    ✓ Quick buttons for common amounts             │
│    ✓ Real-time discount display                   │
│    ✓ Auto-reset when voucher changes              │
│                                                    │
│ 2. PAYMENT METHOD FILTERING:                       │
│    ✓ Based on role (Customer, Staff, Guest)       │
│    ✓ Further filtered by voucher restrictions     │
│    ✓ Conflict detected when no methods available  │
│                                                    │
│ 3. WARNING DIALOG:                                 │
│    ✓ Auto-trigger on incompatible selection       │
│    ✓ Cancel: Keep voucher, revert method          │
│    ✓ Remove: Remove voucher, use new method       │
│    ✓ Duplicate-prevention via ref                 │
│                                                    │
│ 4. VOUCHER RE-SELECTION:                           │
│    ✓ Open sheet anytime to change                 │
│    ✓ Pre-select current voucher                   │
│    ✓ Skip API if same voucher                     │
│    ✓ Reset points on voucher change               │
│    ✓ Auto-validate compatibility                  │
│                                                    │
└────────────────────────────────────────────────────┘
```
