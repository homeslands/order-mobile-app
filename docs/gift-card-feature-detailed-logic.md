# Gift Card Feature: Detailed Logic & Use Cases

## 1. Quick Overview

Gift card là một **product tách biệt**, không phải discount:

```
Regular Order:
├─ Order items (food, drinks, etc)
├─ Subtotal
├─ Discounts (promotion, voucher)
├─ Delivery fee
└─ Total → Pay

Gift Card Order:
├─ Gift card (product)
├─ Price × Quantity
├─ NO discounts
└─ Total → Pay (same amount)
```

**Key Differences:**
- Gift card = **Product to purchase** (not discount)
- Granting **points/coins** to account (not payment method)
- **Separate order** from regular food orders
- **Independent payment** lifecycle
- Can **add to cart like any product**

---

## 2. Gift Card Types & Features

### 2.1 Gift Card Types (Enum)

**File**: `src/constants/gift-card.ts`

```typescript
enum GiftCardType {
  SELF = 'self',      // Khách mua cho mình (top-up coins)
  GIFT = 'gift',      // Khách tặng cho người khác
  BUY = 'buy',        // Mua như sản phẩm thường
  NONE = 'none'       // Mặc định/chưa set
}
```

**Use Cases by Type:**
| Type | Use Case | Example |
|------|----------|---------|
| **SELF** | Customer top-ups their own coins | "I want 100K coins for myself" |
| **GIFT** | Customer gifts to others | "Send 50K coins to my friend" |
| **BUY** | Alternative for regular purchase | Treat as regular product purchase |
| **NONE** | Default state | Not yet selected |

### 2.2 Gift Card Status

**File**: `src/constants/gift-card.ts`

```typescript
enum GiftCardStatus {
  ACTIVE = 'active',          // Available for purchase
  INACTIVE = 'inactive'       // Disabled/unavailable
}

enum GiftCardUsageStatus {
  AVAILABLE = 'available',    // Not yet used
  USED = 'used',              // Already redeemed
  EXPIRED = 'expired',        // Expiration date passed
  ALL = 'all'                 // Filter: show all
}
```

**Status Flow:**
```
┌──────────────────────────────────────┐
│ Gift Card Lifecycle                  │
├──────────────────────────────────────┤
│                                      │
│ CREATED (ACTIVE)                     │
│ └─ Available for purchase            │
│    ├─ Customer purchases it          │
│    └─ User receives serial + code    │
│       │                              │
│       └─ User can REDEEM anytime:    │
│          ├─ POST /gift-card/use      │
│          │  {serial, code, userSlug}│
│          │                           │
│          └─ Status becomes USED      │
│             └─ Points added to       │
│                account               │
│                                      │
│ Or EXPIRES:                          │
│ └─ Expiration date passes            │
│    └─ Status: EXPIRED                │
│       └─ Cannot redeem               │
│                                      │
└──────────────────────────────────────┘
```

### 2.3 Gift Card Properties

**File**: `src/types/gift-card.type.ts`

```typescript
interface IGiftCard {
  slug: string              // Unique ID
  title: string             // "Top Up 100K Coins"
  description: string       // Long description
  image: string             // Image URL
  price: number             // 100,000 VND (what customer pays)
  points: number            // 100,000 points (what customer receives)
  isActive: boolean         // Available for purchase?
  version: number           // For optimistic updates
}

interface IGiftCardCartItem extends IGiftCard {
  id: string                // Cart item ID
  quantity: number          // How many units
  receipients?: Array<{     // For GIFT type
    id: string
    phone: string
    email?: string
    name?: string
    quantity: number        // How many for this person
    message?: string        // Personalized message
  }>
  type?: GiftCardType       // SELF, GIFT, BUY, NONE
  customerInfo?: IUserInfo  // Who's purchasing
}
```

---

## 3. Gift Card APIs & Endpoints

### 3.1 Gift Card Management (Admin/System)

**File**: `src/api/gift-card.ts`

```typescript
// Get all gift cards (with filters, pagination)
export async function getGiftCards(params: {
  page?: number
  limit?: number
  search?: string
  isActive?: boolean
}): Promise<IPaginatedResponse<IGiftCard>>

// Get single gift card
export async function getGiftCardBySlug(slug: string): Promise<IApiResponse<IGiftCard>>

// Create gift card (Admin)
export async function createGiftCard(data: {
  title: string
  description: string
  points: number
  price: number
  isActive: boolean
  image: File
}): Promise<IApiResponse<IGiftCard>>

// Update gift card
export async function updateGiftCard(
  slug: string,
  data: Partial<IGiftCard>
): Promise<IApiResponse<IGiftCard>>

// Delete gift card
export async function deleteGiftCard(slug: string): Promise<IApiResponse<void>>
```

### 3.2 User Gift Cards (Customer)

**File**: `src/api/gift-card.ts`

```typescript
// Get user's received/owned gift cards
export async function getUserGiftCards(params: {
  userSlug: string
  status?: GiftCardUsageStatus  // 'available', 'used', 'expired', 'all'
  fromDate?: Date
  toDate?: Date
  page?: number
  limit?: number
}): Promise<IPaginatedResponse<IUserGiftCard>>

// Get details of specific user gift card
export async function getUserGiftCardBySlug(
  userSlug: string,
  giftCardSlug: string
): Promise<IApiResponse<IUserGiftCard>>

// Redeem/Use gift card
export async function useGiftCard(data: {
  serial: string                // Gift card serial number
  code: string                  // Gift card code
  userSlug: string
}): Promise<IApiResponse<{
  pointsAdded: number
  newBalance: number
  message: string
}>>
```

**Redeem Endpoint Details:**
```
Endpoint: POST /gift-card/use

Request:
{
  serial: "GC-2024-001234",      // Printed on card
  code: "ABC123XYZ789",          // Customer enters
  userSlug: "user-abc-123"
}

Response:
{
  code: 0,
  message: "Success",
  data: {
    pointsAdded: 100000,         // Points credited
    newBalance: 250000,          // Updated balance
    message: "Gift card redeemed successfully"
  }
}

Error Response (if gift card invalid):
{
  code: 158001,  // Gift card error code
  message: "Invalid gift card",
  data: null
}
```

### 3.3 Gift Card Order (Checkout & Payment)

**File**: `src/api/card-order.ts`

```typescript
// Create gift card order
export async function createCardOrder(data: {
  customerSlug: string          // Who's buying
  cardSlug: string              // Which gift card
  quantity: number              // How many units
  totalAmount: number           // price × quantity
  receipients?: Array<{         // For GIFT type
    phone: string
    quantity: number
    message?: string
    name?: string
  }>
  cardOrderType: GiftCardType   // SELF, GIFT, BUY, NONE
  cardVersion: number           // For optimistic updates
}): Promise<IApiResponse<ICardOrder>>

// Get card order details
export async function getCardOrderBySlug(
  slug: string
): Promise<IApiResponse<ICardOrder>>

// Cancel card order (before payment)
export async function cancelCardOrder(
  slug: string
): Promise<IApiResponse<void>>

// Initiate payment for gift card order
export async function initiateCardOrderPayment(data: {
  cardorderSlug: string
  paymentMethod: PaymentMethod  // BANK_TRANSFER, CASH
  cashierSlug?: string          // For staff payment
}): Promise<IApiResponse<{
  qrCode?: string               // For BANK_TRANSFER
  transactionId: string
  createdAt: Date
}>>

// Admin payment initiation
export async function initiateCardOrderPaymentAdmin(data: {
  cardorderSlug: string
  paymentMethod: PaymentMethod
  staffSlug: string
}): Promise<IApiResponse<{ qrCode?: string }>>
```

**Card Order Response Structure:**
```typescript
interface ICardOrder {
  slug: string
  customerSlug: string
  cardSlug: string
  quantity: number
  totalAmount: number
  cardOrderType: GiftCardType
  paymentStatus: OrderStatus         // PENDING, PAID, CANCELLED
  paymentMethod?: PaymentMethod
  receipients?: Array<{
    id: string
    phone: string
    quantity: number
    serialNumber?: string
    code?: string
    notificationStatus?: 'pending' | 'sent' | 'failed'
  }>
  createdAt: Date
  expiryDate?: Date
}
```

---

## 4. Gift Card In Payment Flow

### 4.1 Gift Card Architecture

Gift card orders are **completely separate** from regular food orders:

```
┌─────────────────────────────────────┐
│ Cart System                         │
├─────────────────────────────────────┤
│                                     │
│ Regular Items:                      │
│ ├─ Food, drinks, etc              │
│ ├─ Stored in `useCartItemStore`    │
│ └─ Normal checkout flow             │
│                                     │
│ Gift Cards:                         │
│ ├─ Stored in `useGiftCardStore`    │
│ ├─ Independent from items          │
│ └─ Separate checkout flow           │
│                                     │
└─────────────────────────────────────┘

Payment Flow:

┌─ Regular Order ─┐
│ /payment        │
│ /order-success  │
└─────────────────┘

┌─ Gift Card Order ─┐
│ /gift-card/checkout
│ /gift-card/checkout/{slug}
│ /gift-card/order-success
└───────────────────┘
```

### 4.2 Gift Card vs Voucher Interaction

**No Direct Interaction:**

```
Vouchers:
├─ Apply to regular order items
├─ Reduce order total
├─ Part of order calculation

Gift Cards:
├─ Are products themselves
├─ Have their own price
├─ Separate from regular orders
└─ Cannot be combined with vouchers
   (different order types)
```

**Scenario: Customer wants both?**
```
Option 1: Separate transactions
├─ Buy gift card first → checkout → pay
├─ Buy food order second → use voucher → pay

Option 2: Multiple shopping sessions
└─ Add gift card, purchase
   Later: Add food, use voucher, purchase
```

### 4.3 Gift Card vs Loyalty Points Interaction

**Points Granted vs Points Used:**

```
Gift Card Purchase:
├─ Customer buys gift card (product)
├─ Receives serial + code
└─ Later: Redeem code → Points added to account

Loyalty Points (Accumulated Points):
├─ Points earned from:
│  ├─ Food purchases
│  ├─ Referrals
│  └─ Special promotions
├─ Can be used as payment method
└─ Deducted from order total

Combined Usage:
├─ NOT in same order
├─ Customer buys gift card → receives points
│  Then later: Uses those points
│  For different order
```

### 4.4 Multiple Gift Cards in Cart

**Only ONE gift card allowed per cart:**

**File**: `src/components/app/gift-card/gift-card-selected-drawer.tsx`

```typescript
// When adding new gift card, check if one exists
const handleAddToCart = (giftCard: IGiftCard) => {
  const currentGiftCard = useGiftCardStore.getGiftCardItem()

  if (currentGiftCard && currentGiftCard.slug !== giftCard.slug) {
    // Different gift card already exists
    setShowWarningDialog(true)
    setNewGiftCard(giftCard)
    // Wait for user decision
  } else {
    // No gift card or same gift card, add it
    addToCart(giftCard)
  }
}
```

**Warning Dialog Options:**

```
Current Gift Card: "100K Coins" (quantity: 5)
New Gift Card: "50K Coins" (quantity: 3)

┌──────────────────────────────────┐
│ Replace Existing Gift Card?      │
├──────────────────────────────────┤
│                                  │
│ You already have:                │
│ □ 100K Coins (×5)               │
│   Total: 500,000 VND             │
│                                  │
│ Do you want to replace with:     │
│ □ 50K Coins (×3)                │
│   Total: 150,000 VND             │
│                                  │
│ [Cancel]  [Replace]              │
│                                  │
└──────────────────────────────────┘

User Options:
1. Cancel → Keep current gift card
2. Replace → Remove current, add new
```

---

## 5. Gift Card State Management

### 5.1 Gift Card Store (Zustand + localStorage)

**File**: `src/stores/gift-card.store.ts`

```typescript
interface IGiftCardStore {
  // Data
  giftCardItem: IGiftCardCartItem | null
  lastModified: number | null
  isHydrated: boolean

  // Actions
  setGiftCardItem: (item: IGiftCardCartItem) => void
  updateGiftCardQuantity: (quantity: number) => void
  clearGiftCard: (showNotification?: boolean) => void
  getGiftCardItem: () => IGiftCardCartItem | null
  synchronizeWithServer: (serverItem: IGiftCardCartItem) => void
}

// Usage
const giftCardStore = useGiftCardStore()

// Add gift card
giftCardStore.setGiftCardItem({
  slug: 'gc-100k',
  title: '100K Coins',
  price: 100000,
  points: 100000,
  quantity: 2,
  type: 'SELF'
  // ... other properties
})

// Change quantity
giftCardStore.updateGiftCardQuantity(5)

// Remove
giftCardStore.clearGiftCard(true)  // show toast notification
```

**Persistence Logic:**

```typescript
// Auto-save to localStorage
const giftCardStore = create<IGiftCardStore>(
  persist(
    (set) => ({
      // ... store definition
    }),
    {
      name: 'gift-card-store',
      storage: localStorage,
      partialize: (state) => ({
        giftCardItem: state.giftCardItem,
        lastModified: state.lastModified
      })
    }
  )
)

// Auto-load from localStorage on app start
useEffect(() => {
  const hydrationComplete = () => {
    giftCardStore.setState({ isHydrated: true })
  }

  giftCardStore.persist.rehydrate()
  // Now giftCardItem is restored from localStorage
}, [])
```

**Storage Structure (localStorage):**
```json
{
  "gift-card-store": {
    "state": {
      "giftCardItem": {
        "id": "gc-123",
        "slug": "gift-card-100k",
        "title": "100K Coins",
        "price": 100000,
        "points": 100000,
        "quantity": 2,
        "type": "SELF"
      },
      "lastModified": 1712055600000
    }
  }
}
```

---

## 6. Gift Card Validation Logic

### 6.1 Schema Validation (Zod)

**File**: `src/schemas/gift-card.schema.ts`

```typescript
// For creating gift card (admin)
export const createGiftCardSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must not exceed 500 characters'),

  description: z
    .string()
    .max(1000, 'Description too long')
    .optional(),

  points: z
    .number()
    .min(1000, 'Minimum 1,000 points')
    .max(10000000, 'Maximum 10,000,000 points'),

  price: z
    .number()
    .min(1000, 'Minimum price 1,000 VND')
    .max(10000000, 'Maximum price 10,000,000 VND'),

  isActive: z
    .boolean()
    .default(true),

  file: z
    .instanceof(File)
    .optional()
    .refine(
      (file) => !file || file.type.startsWith('image/'),
      'File must be an image'
    )
})

// For checkout (user selecting gift card)
export const giftCardCheckoutSchema = z.object({
  giftType: z
    .enum(['SELF', 'GIFT', 'BUY', 'NONE'])
    .default('NONE'),

  quantity: z
    .number()
    .min(1, 'Minimum 1 unit')
    .max(10, 'Maximum 10 units'),

  receivers: z
    .array(
      z.object({
        phone: z
          .string()
          .regex(/^[0-9]{10,11}$/, 'Invalid phone number'),

        name: z
          .string()
          .min(1, 'Name required')
          .optional(),

        quantity: z
          .number()
          .min(1, 'Minimum 1')
          .positive(),

        message: z
          .string()
          .max(500, 'Message too long')
          .optional()
      })
    )
    .refine(
      (receivers) => {
        const totalQty = receivers.reduce((sum, r) => sum + r.quantity, 0)
        return totalQty <= selectedGiftCardQuantity
      },
      'Total receiver quantities exceed available gift cards'
    )
}).refine(
  (data) => {
    // If GIFT type, receivers must not be empty
    if (data.giftType === 'GIFT') {
      return data.receivers.length > 0
    }
    return true
  },
  { message: 'Receivers required when gifting to others' }
)
```

### 6.2 Runtime Validations

**Before Adding to Cart:**

```typescript
const validateBeforeAddingToCart = (giftCard: IGiftCard) => {
  // Check 1: Is gift card active?
  if (!giftCard.isActive) {
    toast.error('This gift card is not available')
    return false
  }

  // Check 2: Is different gift card already in cart?
  const currentGiftCard = giftCardStore.getGiftCardItem()
  if (currentGiftCard && currentGiftCard.slug !== giftCard.slug) {
    // Show replacement dialog instead of error
    return false  // Dialog handles it
  }

  // Check 3: Valid price and points?
  if (giftCard.price <= 0 || giftCard.points <= 0) {
    toast.error('Invalid gift card data')
    return false
  }

  return true
}
```

**During Checkout:**

```typescript
const validateCheckoutData = (data: GiftCardCheckoutInput) => {
  // Check 1: Quantity valid?
  if (data.quantity < 1 || data.quantity > 10) {
    return { valid: false, error: 'Invalid quantity' }
  }

  // Check 2: Type selected?
  if (data.giftType === 'NONE') {
    return { valid: false, error: 'Select gift card type' }
  }

  // Check 3: Receivers for GIFT type
  if (data.giftType === 'GIFT') {
    if (!data.receivers || data.receivers.length === 0) {
      return { valid: false, error: 'Add at least one receiver' }
    }

    // Check receiver quantities don't exceed total
    const totalReceiverQty = data.receivers.reduce(
      (sum, r) => sum + r.quantity,
      0
    )
    if (totalReceiverQty > data.quantity) {
      return {
        valid: false,
        error: 'Total receiver quantity exceeds gift card quantity'
      }
    }
  }

  // Check 4: Required fields
  for (const receiver of data.receivers || []) {
    if (!receiver.phone || !receiver.name) {
      return { valid: false, error: 'Missing receiver details' }
    }
  }

  return { valid: true }
}
```

**When Redeeming Gift Card Code:**

```typescript
const validateRedeemInput = (serial: string, code: string) => {
  // Check 1: Not empty
  if (!serial.trim()) {
    return { valid: false, error: 'Enter serial number' }
  }

  if (!code.trim()) {
    return { valid: false, error: 'Enter code' }
  }

  // Check 2: Format check (optional, basic)
  if (serial.length < 5 || code.length < 5) {
    return { valid: false, error: 'Invalid format' }
  }

  return { valid: true }
}
```

**API Validation Error Handling:**

```typescript
const handleRedeemError = (errorCode: number, message: string) => {
  switch (errorCode) {
    case 158001:  // Invalid gift card
      return 'Gift card not found or invalid'

    case 158002:  // Already used
      return 'This gift card has already been used'

    case 158003:  // Expired
      return 'This gift card has expired'

    case 158004:  // Not active
      return 'This gift card is not available'

    default:
      return message || 'Failed to redeem gift card'
  }
}
```

---

## 7. Order Calculation with Gift Cards

### 7.1 Pricing Model

**Gift card IS a product, NOT a discount:**

```
Gift Card Property:
├─ price: 100,000 VND     ← What customer PAYS
├─ points: 100,000 points ← What customer RECEIVES
│
Calculation:
├─ Single gift card: total = 100,000 VND
├─ Quantity 2: total = 100,000 × 2 = 200,000 VND
├─ Quantity 5: total = 100,000 × 5 = 500,000 VND
│
NO DISCOUNTS APPLY:
├─ No promotion discount
├─ No voucher discount
├─ No delivery fee (product, not delivery)
└─ Total = Price × Quantity (flat calculation)
```

### 7.2 Order Calculation in Checkout

**File**: `src/components/app/gift-card/checkout/components/gift-card-details-table.tsx`

```typescript
interface GiftCardCheckoutTotal {
  cardPrice: number
  quantity: number
  totalAmount: number
  pointsPerCard: number
  totalPoints: number
}

const calculateGiftCardTotal = (
  giftCard: IGiftCard,
  quantity: number
): GiftCardCheckoutTotal => {
  const totalAmount = giftCard.price * quantity
  const totalPoints = giftCard.points * quantity

  return {
    cardPrice: giftCard.price,
    quantity: quantity,
    totalAmount: totalAmount,
    pointsPerCard: giftCard.points,
    totalPoints: totalPoints
  }
}

// Display in UI
<table>
  <tr>
    <td>Card Price</td>
    <td>{cardPrice.toLocaleString()} đ</td>
  </tr>
  <tr>
    <td>Quantity</td>
    <td>{quantity}</td>
  </tr>
  <tr>
    <td>Total Amount</td>
    <td className="font-bold text-primary">
      {totalAmount.toLocaleString()} đ
    </td>
  </tr>
  <tr>
    <td>Points per Card</td>
    <td>{pointsPerCard.toLocaleString()}</td>
  </tr>
  <tr>
    <td>Total Points</td>
    <td className="font-bold text-success">
      +{totalPoints.toLocaleString()} points
    </td>
  </tr>
</table>
```

### 7.3 For GIFT Type (Multiple Recipients)

**File**: `src/components/app/gift-card/checkout/components/gift-card-recipients-summary.tsx`

```typescript
// When gifting to multiple people
const calculateRecipientTotals = (
  giftCard: IGiftCard,
  recipients: Array<{ quantity: number }>
) => {
  const recipientTotals = recipients.map(recipient => ({
    quantity: recipient.quantity,
    amount: giftCard.price * recipient.quantity,
    points: giftCard.points * recipient.quantity
  }))

  const totalAmount = recipientTotals.reduce((sum, r) => sum + r.amount, 0)
  const totalPoints = recipientTotals.reduce((sum, r) => sum + r.points, 0)

  return {
    recipientTotals,
    totalAmount,
    totalPoints
  }
}

// Display example:
// Recipients:
// 1. John Doe: 2 × 100K = 200,000 đ (200K points)
// 2. Jane Doe: 3 × 100K = 300,000 đ (300K points)
// ─────────────────────────────────
// Total: 5 × 100K = 500,000 đ (500K points)
```

---

## 8. Gift Card Error Handling

### 8.1 Error Codes & Messages

**File**: `src/constants/error-codes.ts` (Gift card error range: 158000-158999)

```typescript
enum GiftCardErrorCode {
  INVALID_GIFT_CARD = 158001,
  ALREADY_USED = 158002,
  EXPIRED = 158003,
  NOT_ACTIVE = 158004,
  INSUFFICIENT_BALANCE = 158005,  // N/A for purchases
  FEATURE_LOCKED = 158006,
  INVALID_RECEIVER = 158007,
  MAX_RECEIVERS_EXCEEDED = 158008
}

// Error message mapping
const giftCardErrorMessages: Record<number, string> = {
  158001: 'Gift card not found or invalid',
  158002: 'This gift card has already been used',
  158003: 'This gift card has expired',
  158004: 'This gift card is not available',
  158005: 'Insufficient gift card balance',
  158006: 'Gift card feature is temporarily locked',
  158007: 'Invalid receiver information',
  158008: 'Too many receivers for this gift card'
}
```

### 8.2 Error Scenarios & Handling

**Scenario 1: Invalid Gift Card Code**

```typescript
const { mutate: useGiftCard } = useMutation({
  mutationFn: async (data: { serial: string; code: string }) => {
    return await giftCardApi.useGiftCard(data)
  },
  onError: (error) => {
    const errorCode = error.response?.data?.code

    if (errorCode === 158001) {
      // Invalid gift card
      toast.error('Gift card not found. Check serial and code.')
      // Clear inputs
      setSerial('')
      setCode('')
      // Focus on input
      serialInputRef.current?.focus()
    } else {
      toast.error('Failed to redeem gift card')
    }
  }
})
```

**Scenario 2: Expired Gift Card**

```typescript
// UI prevents redeeming expired cards
const giftCardStatus = giftCardData?.usageStatus  // AVAILABLE, USED, EXPIRED

{giftCardStatus === 'EXPIRED' && (
  <div className="error-banner">
    <AlertCircle className="icon-error" />
    <span>Payment has expired</span>
  </div>
)}

// Redeem button disabled
<Button disabled={giftCardStatus !== 'AVAILABLE'}>
  Redeem Gift Card
</Button>
```

**Scenario 3: Already Used Gift Card**

```typescript
// Shows in gift card history
<GiftCardHistoryTable>
  <tr>
    <td>Status: Used ✓</td>
    <td>Redeemed on: 2024-03-15 14:30</td>
    <td>Points Added: 100,000</td>
  </tr>
</GiftCardHistoryTable>

// Cannot redeem again
if (giftCardStatus === 'USED') {
  toast.error('This gift card has already been used')
  return
}
```

**Scenario 4: Gift Card Not Active**

```typescript
const giftCard = await fetchGiftCard(slug)

if (!giftCard.isActive) {
  // Overlay on card
  <div className="overlay">
    <Badge variant="warning">
      Gift Card Not Available
    </Badge>
  </div>

  // Quantity controls disabled
  <QuantitySelector disabled={!giftCard.isActive} />

  // Add to cart disabled
  <Button disabled={!giftCard.isActive}>
    Add to Cart
  </Button>
}
```

**Scenario 5: Gift Card Already in Cart**

```typescript
// Dialog shows both cards for comparison
<GiftCardExistsWarningDialog
  currentCard={{
    title: 'Top Up 100K Coins',
    price: 100000,
    quantity: 2,
    total: 200000
  }}
  newCard={{
    title: 'Top Up 50K Coins',
    price: 50000,
    quantity: 3,
    total: 150000
  }}
  onReplace={() => {
    // Remove old, add new
    giftCardStore.clearGiftCard(false)  // no toast
    giftCardStore.setGiftCardItem(newCard)
    toast.success('Gift card updated')
  }}
  onCancel={() => {
    // Keep old, discard new
    toast.info('Kept existing gift card')
  }}
/>
```

**Scenario 6: Feature Locked**

```typescript
// When feature flag is locked for gift card type
if (!isFeatureEnabled('gift_card_type_' + type)) {
  toast.error('Gift Card Feature locked, please try again later')

  // Disable option in UI
  <RadioGroup disabled={!isFeatureEnabled(...)}>
    <Radio value="SELF" label="Top Up for Myself" />
    <Radio value="GIFT" label="Gift to Others" disabled />  {/* Locked */}
  </RadioGroup>
}
```

**Scenario 7: Receiver Quantity Exceeds Total**

```typescript
const validateReceiverQuantities = (
  totalQuantity: number,
  receivers: Array<{ quantity: number }>
) => {
  const receiverTotal = receivers.reduce((sum, r) => sum + r.quantity, 0)

  if (receiverTotal > totalQuantity) {
    return {
      valid: false,
      error: `Total receiver quantities (${receiverTotal}) exceed available quantity (${totalQuantity})`
    }
  }

  return { valid: true }
}

// In UI, show validation error
{error && (
  <Alert variant="error" className="mt-4">
    {error.message}
  </Alert>
)}
```

---

## 9. Gift Card Checkout Flow (Complete)

### 9.1 Step-by-Step Process

**File**: `src/app/client/gift-card/checkout/page.tsx`

```
┌─────────────────────────────────────────────────┐
│ Step 1: Browse Gift Cards                       │
├─────────────────────────────────────────────────┤
│ User navigates to: /client/gift-card            │
│                                                  │
│ Component: GiftCardListPage                     │
│ ├─ GET /card (fetch all gift cards)            │
│ ├─ Display pagination                          │
│ └─ Show each card with:                        │
│    ├─ Image                                     │
│    ├─ Title: "100K Coins"                      │
│    ├─ Price: 100,000 đ                        │
│    ├─ Points: 100,000                         │
│    ├─ "Select" button                         │
│    └─ Pagination controls                      │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 2: Open Gift Card Drawer                   │
├─────────────────────────────────────────────────┤
│ User clicks: "Select" on a gift card           │
│                                                  │
│ Component: GiftCardSelectedDrawer               │
│ ├─ Shows gift card details                     │
│ ├─ Quantity selector (1-10)                    │
│ ├─ "Add to Cart" button                        │
│ └─ (Optional) Show comparison if exists        │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 3: Check for Existing Gift Card           │
├─────────────────────────────────────────────────┤
│ Logic in: gift-card-selected-drawer.tsx        │
│                                                  │
│ currentGiftCard = giftCardStore.getGiftCardItem()
│                                                  │
│ if (currentGiftCard && different slug):        │
│   → Show GiftCardExistsWarningDialog           │
│ else:                                          │
│   → Go to Step 4                               │
│                                                  │
│ Dialog Options:                                │
│ ├─ Cancel: Keep existing                      │
│ └─ Replace: Remove old, add new              │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 4: Add to Cart & Navigate                  │
├─────────────────────────────────────────────────┤
│ User clicks: "Add to Cart"                      │
│                                                  │
│ Action:                                        │
│ ├─ giftCardStore.setGiftCardItem({...})        │
│ ├─ Save to localStorage                        │
│ ├─ Toast: "Gift card added successfully"       │
│ ├─ Close drawer                                │
│ └─ Navigate to: /client/gift-card/checkout    │
│                                                  │
│ Stored in cart:                                │
│ ├─ slug, title, price, points                  │
│ ├─ quantity, type                              │
│ └─ Image, description                          │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 5: Select Gift Card Type                  │
├─────────────────────────────────────────────────┤
│ Page: GiftCardCheckoutPage                     │
│ Component: GiftCardTypeSelector                │
│                                                  │
│ User chooses:                                  │
│ ┌─ SELF ─────────────────────────────┐        │
│ │ Top up coins for myself             │        │
│ │ Just show summary, no receivers     │        │
│ └─────────────────────────────────────┘        │
│                                                  │
│ OR                                              │
│                                                  │
│ ┌─ GIFT ─────────────────────────────┐        │
│ │ Gift to others                      │        │
│ │ Add receivers:                      │        │
│ │ ├─ Phone number                    │        │
│ │ ├─ Name (optional)                 │        │
│ │ ├─ Quantity for this person        │        │
│ │ ├─ Message (optional)              │        │
│ │ └─ "Add Another Receiver" button   │        │
│ └─────────────────────────────────────┘        │
│                                                  │
│ Validation:                                    │
│ ├─ SELF: quantity >= 1                        │
│ ├─ GIFT: receivers not empty                  │
│ └─ GIFT: sum(receiver.qty) <= total qty      │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 6: Review Order Summary                   │
├─────────────────────────────────────────────────┤
│ Component: GiftCardDetailsTable                 │
│                                                  │
│ Display:                                       │
│ ├─ Card Price: 100,000 đ                      │
│ ├─ Quantity: 5                                 │
│ ├─ ──────────────────                          │
│ ├─ Total Amount: 500,000 đ                    │
│ ├─ Points Earned: 500,000                     │
│ ├─ ──────────────────                          │
│ │                                              │
│ │ For GIFT type (Receivers):                  │
│ │ 1. John Doe: 2 × 100K = 200,000 đ          │
│ │ 2. Jane Doe: 3 × 100K = 300,000 đ          │
│ │ ───────────────────────────────            │
│ │ Total: 5 × 100K = 500,000 đ                │
│ │ Total Points: 500,000                       │
│ └─────────────────────────────────────────────│
│                                                  │
│ [Back] [Confirm Order]                         │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 7: Confirm Order (Dialog)                 │
├─────────────────────────────────────────────────┤
│ Component: ConfirmGiftCardCheckoutDialog       │
│                                                  │
│ Shows:                                         │
│ ├─ All entered information                    │
│ ├─ Gift type (SELF/GIFT)                      │
│ ├─ Recipients (if GIFT)                       │
│ ├─ Total amount to pay                        │
│ └─ [Cancel] [Confirm] buttons                 │
│                                                  │
│ User clicks "Confirm":                        │
│ ├─ Validate form data                         │
│ ├─ POST /card-order (create order)            │
│ ├─ Save order slug                            │
│ └─ Navigate to payment page                   │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 8: Payment Initiation Page                │
├─────────────────────────────────────────────────┤
│ Page: GiftCardCheckoutWithSlugPage             │
│ Route: /gift-card/checkout/{cardorderSlug}    │
│                                                  │
│ GET /card-order/{slug}  ← fetch order data     │
│                                                  │
│ Display:                                       │
│ ├─ OrderInfo: Receipt summary                 │
│ ├─ PaymentMethodSection:                      │
│ │  ├─ BANK_TRANSFER (shows QR code)          │
│ │  └─ CASH (counter payment, staff)          │
│ └─ PaymentQRCodeSection (if bank transfer)   │
│                                                  │
│ User selects payment method:                  │
│ └─ BANK_TRANSFER:                              │
│    ├─ POST /card-order/payment/initiate       │
│    ├─ Response: { qrCode, transactionId }     │
│    ├─ Show QR code                            │
│    └─ Start polling                           │
│                                                  │
│ OR CASH (staff only):                         │
│    ├─ POST /card-order/payment/initiate       │
│    │  {paymentMethod: 'CASH', cashierSlug}    │
│    └─ Immediate payment (no QR)               │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 9: Payment Polling (Bank Transfer Only)  │
├─────────────────────────────────────────────────┤
│ Hook: useGiftCardPolling()                     │
│                                                  │
│ Polling Logic:                                 │
│ ├─ Interval: Every 15 seconds                 │
│ ├─ GET /card-order/{slug}                     │
│ ├─ Check: paymentStatus === COMPLETED?        │
│ │                                              │
│ │ Loop:                                       │
│ │ ├─ 00:00 → Status: PENDING                 │
│ │ ├─ 00:15 → Status: PENDING                 │
│ │ ├─ 00:30 → Status: PENDING (customer paying)
│ │ ├─ 00:45 → Status: COMPLETED ✓            │
│ │ └─ Navigate to success page                │
│ │                                              │
│ └─ Max attempts: Display countdown            │
│                                                  │
│ Timeout & Expiration:                         │
│ ├─ If timeout occurs:                         │
│ │  ├─ POST /card-order/{slug}/cancel         │
│ │  ├─ Order cancelled                        │
│ │  ├─ Toast: "Order expired"                 │
│ │  └─ Can retry from scratch                 │
│ │                                              │
│ └─ Component shows timer on page              │
│                                                  │
│ For CASH payment:                             │
│ └─ No polling needed (immediate)              │
│    └─ Just redirect to success                │
│                                                  │
└─────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────┐
│ Step 10: Payment Completion                    │
├─────────────────────────────────────────────────┤
│ Bank Transfer:                                 │
│ ├─ Customer scans QR code                     │
│ ├─ Confirms payment in bank app               │
│ ├─ Polling detects COMPLETED status           │
│ └─ Navigate to success page                   │
│                                                  │
│ Cash:                                          │
│ ├─ Payment processed immediately              │
│ ├─ Order status: COMPLETED                    │
│ └─ Navigate to success page                   │
│                                                  │
│ Success Page: /gift-card/order-success/{slug}
│ ├─ Show receipt:                              │
│ │  ├─ Order ID                                │
│ │  ├─ Gift card details                       │
│ │  ├─ Quantity, total amount                 │
│ │  ├─ Recipients (if GIFT)                    │
│ │  └─ Serial numbers & codes                 │
│ │     (for customer to give to recipients)    │
│ ├─ "Print Receipt" button                     │
│ └─ "Back to Home" button                      │
│                                                  │
│ For GIFT type:                                │
│ └─ Backend sends SMS/notification to          │
│    recipients with serial + code              │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 10. Use Cases & Real-World Scenarios

### Use Case 1: Self Top-Up with Gift Card

**User: Customer wants to buy 200K coins**

```
Step 1: Browse
├─ Go to /client/gift-card
├─ See: "200K Coins - 200,000 đ"
└─ Click "Select"

Step 2: Add to Cart
├─ Drawer opens
├─ Set quantity: 1
├─ Click "Add to Cart"
└─ Toast: "Gift card added successfully"

Step 3: Checkout
├─ Navigate to /client/gift-card/checkout
├─ Select type: "SELF" (top up for myself)
├─ Review:
│  ├─ Card Price: 200,000 đ
│  ├─ Quantity: 1
│  └─ Total: 200,000 đ
└─ Click "Confirm Order"

Step 4: Payment
├─ Redirected to /gift-card/checkout/{slug}
├─ Select: "Bank Transfer"
├─ Scan QR code with bank app
├─ Confirm payment (10 seconds)
├─ Polling detects payment
└─ Navigate to success page

Result:
├─ Order paid: 200,000 đ
├─ Points added to account: +200,000
├─ New balance: 200,000 points
└─ Can now use as payment method for food orders
```

### Use Case 2: Customer Gifting to Multiple Friends

**User: Customer buys 500K coins to gift**

```
Step 1: Select Gift Card
├─ Browse and select: "500K Coins"
├─ Price: 500,000 đ
└─ Add to cart (quantity: 1)

Step 2: Choose Gift Type
├─ Navigate to checkout
├─ Select type: "GIFT" (gift to others)
├─ Show receiver form

Step 3: Add Recipients
├─ Add Recipient 1:
│  ├─ Name: "John"
│  ├─ Phone: "0912345678"
│  ├─ Quantity: 2 (2 × 100K = 200K)
│  ├─ Message: "Happy Birthday!"
│  └─ "Add Recipient" button
│
├─ Add Recipient 2:
│  ├─ Name: "Jane"
│  ├─ Phone: "0987654321"
│  ├─ Quantity: 3 (3 × 100K = 300K)
│  ├─ Message: "Thank you for helping!"
│  └─ "Add Recipient" button
│
└─ Validation:
   ├─ Total: 2 + 3 = 5
   ├─ Available: 5 (matches!)
   └─ Valid ✓

Step 4: Review & Confirm
├─ Summary:
│  ├─ Card: 500K Coins
│  ├─ Total Amount: 500,000 đ
│  ├─ Recipients:
│  │  ├─ John: 2 × 100K = 200K
│  │  └─ Jane: 3 × 100K = 300K
│  └─ Total Points: 500,000
├─ Click "Confirm Order"
└─ Dialog shows all details

Step 5: Payment
├─ Select: "Bank Transfer"
├─ Scan QR
├─ Pay 500,000 đ
├─ Order completed

Step 6: Results
├─ Order receipt shows:
│  ├─ John's serial & code
│  └─ Jane's serial & code
├─ System sends SMS to both:
│  ├─ "You received 100K coins gift!"
│  ├─ "Serial: GC-xxx"
│  ├─ "Code: ABC123"
│  └─ "Redeem at /gift-card/use"
│
└─ Recipients can now:
   ├─ Go to /gift-card/use
   ├─ Enter serial + code
   └─ Points added to their account
```

### Use Case 3: Staff Processing Cash Payment

**User: Staff member selling gift cards at counter**

```
Step 1: Staff Creates Order
├─ Staff account logged in
├─ Navigate to system gift card page
├─ Create order:
│  ├─ Customer info: name, phone
│  ├─ Select: 100K gift card
│  └─ Quantity: 3

Step 2: Select Type
├─ Type: "SELF" (customer top-up)
├─ No receivers needed

Step 3: Payment Method
├─ Payment page opens
├─ Select: "CASH" (counter payment)
├─ Amount: 300,000 đ
├─ Cashier: [current staff member]

Step 4: Immediate Payment
├─ No QR code needed
├─ No polling
├─ POST /card-order/payment/initiate/admin
├─ Response: Payment marked COMPLETED
└─ Redirect to receipt

Step 5: Receipt
├─ Customer receives receipt with:
│  ├─ 3 gift cards (3 × 100K)
│  ├─ Total: 300,000 đ (paid in cash)
│  ├─ Serial numbers × 3
│  └─ Codes × 3
├─ Can redeem anytime
└─ Staff marks cash payment in system
```

### Use Case 4: Customer Redeeming Gift Card Code

**User: Received gift card, now wants to redeem**

```
Step 1: Access Use Gift Card
├─ Open app
├─ Go to sidebar / menu
├─ Click "Use Gift Card"
├─ Dialog opens: "Redeem Gift Card Code"

Step 2: Enter Code
├─ Input 1: "Serial Number"
│  └─ Enter: "GC-2024-001234"
├─ Input 2: "Code"
│  └─ Enter: "ABC123XYZ789"
└─ Click "Redeem"

Step 3: Validation
├─ POST /gift-card/use
├─ {
│    serial: "GC-2024-001234",
│    code: "ABC123XYZ789",
│    userSlug: "user-456"
│  }

Step 4: Success Response
├─ Response:
│  {
│    pointsAdded: 100000,
│    newBalance: 250000,
│    message: "Gift card redeemed successfully"
│  }
├─ Toast: "Congratulations! 100,000 points added"
├─ Display new balance: 250,000 points
└─ Dialog closes

Step 5: Use Points
├─ Points added to account balance
├─ Can now:
│  ├─ Use for payment on food orders
│  ├─ View in loyalty points section
│  └─ Check transaction history
```

### Use Case 5: Expired Gift Card Handling

**User: Tries to redeem expired gift card**

```
Step 1: Enter Code
├─ Dialog: Use gift card
├─ Enter serial: "GC-2024-001234"
├─ Enter code: "ABC123XYZ789"
└─ Click "Redeem"

Step 2: API Validation
├─ POST /gift-card/use
├─ Backend checks:
│  ├─ Valid code? ✓
│  ├─ Not used yet? ✓
│  ├─ NOT expired? ✗ (expired on 2024-02-28)
│  └─ Return error 158003

Step 3: Error Display
├─ Response error code: 158003
├─ Toast error: "This gift card has expired"
├─ Inputs cleared
├─ Serial input focused (for retry)

Step 4: Options
├─ Can try different code
├─ Or contact support
└─ Gift card cannot be redeemed
```

### Use Case 6: Multiple Gift Cards - Replace Warning

**User: Tries to add different gift card while one exists**

```
Current State:
├─ Cart has: "100K Coins" (qty: 2)
│  └─ Total: 200,000 đ

User Action:
└─ Click "Select" on "50K Coins"

Flow:
├─ Gift card drawer opens
├─ Set quantity: 3
├─ Click "Add to Cart"
├─ System detects:
│  └─ Different gift card already in cart
│  └─ Show warning dialog

Dialog:
┌────────────────────────────────┐
│ Replace Existing Gift Card?    │
├────────────────────────────────┤
│ Current:                       │
│ 100K Coins × 2 = 200,000 đ    │
│                                │
│ New:                           │
│ 50K Coins × 3 = 150,000 đ     │
│                                │
│ [Cancel] [Replace]             │
└────────────────────────────────┘

User clicks "Replace":
├─ Remove: 100K Coins from cart
├─ Add: 50K Coins × 3
├─ Toast: "Gift card updated"
├─ Close dialog
└─ Navigate to checkout

User clicks "Cancel":
├─ Keep: 100K Coins in cart
├─ Discard: 50K Coins selection
├─ Dialog closes
└─ User back to list
```

### Use Case 7: Feature Flag Locked - GIFT Type Unavailable

**Scenario: Gift card feature restricted**

```
User State:
├─ Feature flag: gift_card_gift_type = LOCKED
└─ Can only buy SELF type, not GIFT

Step 1: Checkout
├─ Navigate to checkout
├─ Reach gift card type selection

Step 2: Type Selection
├─ Visible:
│  └─ ☑ "Top Up Coins (SELF)" - ENABLED
├─ Hidden/Disabled:
│  └─ ☐ "Gift to Others (GIFT)" - LOCKED
└─ Message: "Gift feature coming soon"

Step 3: User Can Only Choose
├─ Select: "Top Up Coins"
├─ Cannot select "Gift to Others"
└─ Proceed with SELF type

Result:
└─ Gift feature temporarily disabled by admin
```

---

## 10.5 GIFT Feature: Deep Dive - Serial & Code Generation

### 10.5.1 Serial Number Generation

**Serial Number Format & Structure**

**File**: `src/gift-card-modules/card-order/card-order.service.ts` (or similar)

```typescript
// Serial number generation logic
const generateSerialNumber = (): string => {
  // Format: GC-{YEAR}-{RANDOM-6-DIGITS}
  // Example: GC-2024-001234

  const currentYear = new Date().getFullYear()
  const randomSuffix = String(Math.floor(Math.random() * 1000000))
    .padStart(6, '0')

  return `GC-${currentYear}-${randomSuffix}`
}

// Uniqueness check
const isSerialUnique = async (serial: string): Promise<boolean> => {
  const existing = await giftCardRepository.findOne({
    where: { serialNumber: serial }
  })

  return !existing  // True if unique, false if exists
}

// Generate unique serial
const generateUniqueSerial = async (): Promise<string> => {
  let serial = generateSerialNumber()

  // Keep generating until unique
  while (!await isSerialUnique(serial)) {
    serial = generateSerialNumber()
  }

  return serial
}
```

**Serial Properties:**
- Format: `GC-YYYY-XXXXXX` (15 characters)
- Unique per gift card recipient
- Printed on physical card (if exists)
- Used to validate gift card redemption
- Public-facing identifier (customer sees this)

**Example Serials:**
```
GC-2024-001234
GC-2024-567890
GC-2024-999999
```

### 10.5.2 Gift Card Code Generation

**Code Format & Structure**

**File**: `src/gift-card-modules/card-order/card-order.service.ts`

```typescript
// Code generation logic
const generateGiftCardCode = (): string => {
  // Format: {UPPERCASE-LETTERS}{NUMBERS}{UPPERCASE-LETTERS}
  // Example: ABC123XYZ789

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const nums = '0123456789'

  const part1 = Array(3).fill(0).map(() =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')

  const part2 = Array(3).fill(0).map(() =>
    nums[Math.floor(Math.random() * nums.length)]
  ).join('')

  const part3 = Array(3).fill(0).map(() =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')

  return `${part1}${part2}${part3}`  // 9 characters: ABC123XYZ
}

// With checksum (for validation)
const generateGiftCardCodeWithChecksum = (serial: string): string => {
  let baseCode = generateGiftCardCode()

  // Add checksum digit (Luhn algorithm or simple mod)
  const checksum = calculateChecksum(serial + baseCode)
  baseCode += checksum

  return baseCode  // 10 characters total
}

// Validate code format
const isValidCodeFormat = (code: string): boolean => {
  // Pattern: 3 letters + 3 numbers + 3 letters + optional 1 checksum
  const pattern = /^[A-Z]{3}\d{3}[A-Z]{3}\d?$/
  return pattern.test(code)
}
```

**Code Properties:**
- Format: `ABC123XYZ` (9 characters) or `ABC123XYZ7` (10 with checksum)
- Unique per gift card recipient
- Contains mix of letters and numbers
- Case-insensitive for redemption
- Secret identifier (confidential, printed on back of card)
- Example: `ABC123XYZ789`

**Security:**
```
Serial: PUBLIC (on front of card, visible)
Code: PRIVATE (on back of card, hidden)

To redeem, customer needs BOTH:
├─ Serial: GC-2024-001234
└─ Code: ABC123XYZ
```

### 10.5.3 When Serials & Codes Are Generated

**Timeline of Generation**

**File**: `src/gift-card-modules/card-order/card-order.service.ts`

```typescript
// Step 1: Order Creation
export async function createCardOrder(data: {
  customerSlug: string
  cardSlug: string
  quantity: number
  receipients: Array<{ phone, quantity, name, message }>
  cardOrderType: 'GIFT' | 'SELF' | 'BUY'
}) {
  // Create card order (no serials/codes yet)
  const cardOrder = await cardOrderRepository.save({
    slug: generateSlug(),
    customerSlug: data.customerSlug,
    cardSlug: data.cardSlug,
    quantity: data.quantity,
    receipients: data.receipients,  // Store receiver info
    cardOrderType: data.cardOrderType,
    paymentStatus: 'PENDING',
    createdAt: new Date()
    // ← NO serials/codes at this stage
  })

  return cardOrder
}

// Step 2: Payment Initiation (NO serials yet)
export async function initiateCardOrderPayment(
  cardOrderSlug: string,
  paymentMethod: 'BANK_TRANSFER' | 'CASH'
) {
  // Generate QR code for bank transfer
  // Update payment status to 'PENDING'
  // ← Still NO serials/codes
}

// Step 3: Payment Completion
export async function completeCardOrderPayment(
  cardOrderSlug: string
) {
  const cardOrder = await cardOrderRepository.findOne(cardOrderSlug)

  // MARK: Serials & codes generated HERE (on payment success)
  if (cardOrder.cardOrderType === 'GIFT') {
    // For each recipient
    for (const recipient of cardOrder.receipients) {
      // Generate serial & code per recipient
      const serial = await generateUniqueSerial()
      const code = generateGiftCardCode()

      // Create GiftCardRecipient record
      await giftCardRecipientRepository.save({
        id: generateUUID(),
        cardOrderSlug: cardOrder.slug,
        recipientPhone: recipient.phone,
        recipientName: recipient.name,
        serialNumber: serial,           // ← Generated
        code: code,                      // ← Generated
        quantity: recipient.quantity,
        message: recipient.message,
        notificationStatus: 'PENDING',   // Will send SMS
        createdAt: new Date()
      })
    }

    // Update order status
    await cardOrderRepository.update(cardOrderSlug, {
      paymentStatus: 'PAID',
      updatedAt: new Date()
    })
  } else if (cardOrder.cardOrderType === 'SELF') {
    // For SELF type, generate single serial/code
    const serial = await generateUniqueSerial()
    const code = generateGiftCardCode()

    await giftCardRecipientRepository.save({
      cardOrderSlug: cardOrder.slug,
      recipientPhone: cardOrder.customerPhone,
      recipientName: cardOrder.customerName,
      serialNumber: serial,
      code: code,
      quantity: cardOrder.quantity,
      notificationStatus: 'COMPLETED'  // No SMS for SELF
    })
  }
}
```

**Timeline:**

```
T0: Order Created
├─ Status: PENDING
├─ Receivers stored
└─ NO serials/codes

    ↓

T1: Payment Initiated
├─ QR code generated
├─ Poll every 2 seconds
└─ Still NO serials/codes

    ↓

T2: Payment Completed
├─ Status: PAID
├─ FOR EACH RECIPIENT:
│  ├─ Serial generated: GC-2024-001234
│  ├─ Code generated: ABC123XYZ
│  └─ Stored in DB
├─ SMS queued: Send to each recipient
└─ NOW has serials/codes!

    ↓

T3: SMS Sent
├─ "You received 100K coins!"
├─ "Serial: GC-2024-001234"
├─ "Code: ABC123XYZ"
└─ Status: SENT
```

### 10.5.4 Recipient Database Structure

**Database Tables**

**File**: `src/gift-card-modules/card-order/entities/gift-card-recipient.entity.ts`

```typescript
@Entity('gift_card_recipient')
export class GiftCardRecipient {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  cardOrderSlug: string             // FK to card_order

  @Column()
  recipientPhone: string            // Receiver's phone

  @Column({ nullable: true })
  recipientName?: string            // Receiver's name

  @Column({ length: 50 })
  serialNumber: string              // GC-2024-001234

  @Column({ length: 50 })
  code: string                       // ABC123XYZ

  @Column()
  quantity: number                  // Gift card units for this person

  @Column({ type: 'text', nullable: true })
  message?: string                  // Personal message

  @Column({ default: 'PENDING' })
  notificationStatus: string        // PENDING, SENT, FAILED, COMPLETED

  @Column({ nullable: true })
  notificationSentAt?: Date         // When SMS sent

  @Column({ nullable: true })
  notificationErrorMessage?: string // If SMS failed

  @Column({ default: false })
  hasRedeemed: boolean              // Was code used?

  @Column({ nullable: true })
  redeemedAt?: Date                 // When customer redeemed

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // Relations
  @ManyToOne(() => CardOrder)
  @JoinColumn({ name: 'cardOrderSlug' })
  cardOrder: CardOrder
}
```

**Example Data:**

```sql
INSERT INTO gift_card_recipient (
  id, cardOrderSlug, recipientPhone, recipientName,
  serialNumber, code, quantity, message,
  notificationStatus, notificationSentAt, hasRedeemed
) VALUES
(
  uuid(), 'co-abc-123', '0912345678', 'John Doe',
  'GC-2024-001234', 'ABC123XYZ', 2, 'Happy Birthday!',
  'SENT', '2024-04-01 14:35:00', false
),
(
  uuid(), 'co-abc-123', '0987654321', 'Jane Doe',
  'GC-2024-001235', 'XYZ789ABC', 3, 'Thank you!',
  'SENT', '2024-04-01 14:36:00', false
);
```

**Key Fields:**
- `recipientPhone`: For SMS delivery
- `recipientName`: For personalization
- `serialNumber`: Public identifier
- `code`: Secret code
- `quantity`: How many gift cards for this person
- `message`: Custom message from sender
- `notificationStatus`: SMS delivery status
- `hasRedeemed`: Track if code was used

### 10.5.5 SMS Sending Mechanism

**SMS Gateway Integration**

**File**: `src/gift-card-modules/notification/sms.service.ts`

```typescript
@Injectable()
export class SMSService {
  constructor(
    private readonly smsProvider: SmsProviderService  // Twilio, AWS SNS, etc
  ) {}

  // Send SMS to gift card recipient
  async sendGiftCardSMS(recipient: GiftCardRecipient): Promise<void> {
    try {
      // Step 1: Construct message
      const message = this.constructGiftCardMessage(recipient)
      // Message:
      // "You received a gift! 🎁
      //  Serial: GC-2024-001234
      //  Code: ABC123XYZ
      //  Points: 100,000
      //  Redeem: https://app.order.com/use-gift-card
      //  Happy Birthday! - From: ${senderName}"

      // Step 2: Send via SMS provider
      const result = await this.smsProvider.send({
        to: formatPhoneNumber(recipient.recipientPhone),  // +84912345678
        message: message,
        contentType: 'SMS'
      })

      // Step 3: Update recipient record
      await giftCardRecipientRepository.update(recipient.id, {
        notificationStatus: 'SENT',
        notificationSentAt: new Date()
      })

      // Step 4: Log success
      logger.log(`SMS sent to ${recipient.recipientPhone} for order ${recipient.cardOrderSlug}`)

    } catch (error) {
      // Handle failure
      await giftCardRecipientRepository.update(recipient.id, {
        notificationStatus: 'FAILED',
        notificationErrorMessage: error.message
      })

      logger.error(`SMS failed for ${recipient.recipientPhone}: ${error.message}`)

      // Trigger retry
      await this.queueSMSRetry(recipient.id)
    }
  }

  // Construct SMS message
  private constructGiftCardMessage(recipient: GiftCardRecipient): string {
    return `🎁 You received a gift!

Serial: ${recipient.serialNumber}
Code: ${recipient.code}
Units: ${recipient.quantity} (100K coins each)

${recipient.message ? `Message: ${recipient.message}\n` : ''}
Redeem at: https://app.order.com/use-gift-card

Thank you for using our service!`
  }
}

// Queue SMS sending (async)
@Injectable()
export class SMSQueueService {
  constructor(
    private readonly queue: QueueService,  // Bull, RabbitMQ, etc
    private readonly smsService: SMSService
  ) {}

  // On payment success, queue SMS for all recipients
  async queueSMSForRecipients(
    cardOrderSlug: string,
    recipients: GiftCardRecipient[]
  ): Promise<void> {
    for (const recipient of recipients) {
      await this.queue.add(
        'send-gift-card-sms',
        {
          recipientId: recipient.id,
          cardOrderSlug: cardOrderSlug
        },
        {
          delay: 2000,           // 2 second delay
          attempts: 3,           // Retry 3 times
          backoff: {
            type: 'exponential',
            delay: 2000          // 2s, 4s, 8s
          }
        }
      )
    }
  }

  // Worker: Process SMS queue
  @Process('send-gift-card-sms')
  async processSMSQueue(job: Job) {
    const { recipientId } = job.data

    const recipient = await giftCardRecipientRepository.findOne(recipientId)

    if (!recipient) {
      throw new Error(`Recipient ${recipientId} not found`)
    }

    await this.smsService.sendGiftCardSMS(recipient)
  }
}
```

**SMS Sending Timeline:**

```
Payment Success
    ↓
getCardOrderPayment() → paymentStatus = PAID
    ↓
generateSerials&Codes()
    ↓
for each recipient:
  ├─ Create GiftCardRecipient record
  └─ Queue SMS job
    ↓
SMS Queue Processing (async)
  ├─ Job 1: Send to 0912345678
  ├─ Job 2: Send to 0987654321
  └─ Each with 2s delay
    ↓
SMS Provider (Twilio/AWS)
  ├─ Validate phone number
  ├─ Send SMS message
  └─ Update notificationStatus
    ↓
User Receives SMS
  ├─ Serial: GC-2024-001234
  ├─ Code: ABC123XYZ
  └─ Redeem link
```

### 10.5.6 Error Handling: SMS Failures

**Failure Scenarios**

```typescript
// Scenario 1: Invalid phone number
if (!isValidPhoneNumber(recipient.phone)) {
  throw new ValidationException(
    158007,  // Invalid receiver
    'Phone number format invalid'
  )
}

// Scenario 2: SMS provider returns error
try {
  await smsProvider.send({ to, message })
} catch (error) {
  if (error.code === 'INVALID_PHONE') {
    notificationStatus = 'FAILED'
    errorMessage = 'Invalid phone number'
  } else if (error.code === 'RATE_LIMIT') {
    // Retry later
    await queueSMSRetry(recipient.id, { delayMs: 30000 })
  } else if (error.code === 'PROVIDER_DOWN') {
    // Queue for retry
    await queueSMSRetry(recipient.id, { delayMs: 60000 })
  }
}

// Scenario 3: Network timeout
// Automatic retry: 3 attempts with exponential backoff

// Scenario 4: Database error updating status
try {
  await giftCardRecipientRepository.update(id, {
    notificationStatus: 'SENT'
  })
} catch (error) {
  logger.error('DB update failed:', error)
  // Log incident, but don't block user
  // SMS was sent successfully, just couldn't update DB status
}
```

**Retry Mechanism:**

```typescript
// Automatic retry with exponential backoff
await this.queue.add(
  'send-gift-card-sms',
  { recipientId, cardOrderSlug },
  {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000  // 2s, 4s, 8s
    },
    removeOnComplete: true,
    removeOnFail: false  // Keep failed jobs for manual review
  }
)
```

### 10.5.7 Resend SMS Mechanism

**Manual Resend API**

**File**: `src/gift-card-modules/card-order/card-order.controller.ts`

```typescript
// Endpoint to resend SMS to specific recipient
@Post(':slug/resend-sms/:recipientId')
async resendSMS(
  @Param('slug') cardOrderSlug: string,
  @Param('recipientId') recipientId: string
) {
  // Validation
  const cardOrder = await cardOrderRepository.findOne(cardOrderSlug)
  if (!cardOrder) {
    throw new NotFoundException('Order not found')
  }

  const recipient = await giftCardRecipientRepository.findOne(recipientId)
  if (!recipient) {
    throw new NotFoundException('Recipient not found')
  }

  // Rate limit: Max 3 resends per recipient
  const resendCount = await getResendCount(recipientId)
  if (resendCount >= 3) {
    throw new BadRequestException('Max resend attempts exceeded')
  }

  // Queue SMS resend
  await smsQueueService.queueSMSForRecipients(
    cardOrderSlug,
    [recipient]
  )

  // Update resend count
  await incrementResendCount(recipientId)

  return {
    statusCode: 200,
    message: 'SMS queued for resend'
  }
}
```

**Manual Resend Flow:**

```
Customer receives wrong phone:
├─ Go to /gift-card/order/{orderId}
├─ See list of recipients
├─ Find recipient with failed SMS
├─ Click "Resend SMS"
│  └─ Hits: POST /card-order/{slug}/resend-sms/{recipientId}
├─ SMS queued again (with delay)
└─ Recipient receives SMS

Admin Resend:
├─ Admin dashboard → Orders
├─ Find order → Recipients
├─ See notificationStatus = FAILED
├─ Click "Resend"
└─ SMS queued
```

### 10.5.8 Recipient Management UI

**Frontend Components**

**File**: `src/components/app/gift-card/checkout/components/gift-card-recipients-form.tsx`

```typescript
export const GiftCardRecipientsForm = () => {
  const [receivers, setReceivers] = useState<Receiver[]>([])
  const [totalQuantity] = useState(5)  // From selected gift card

  // Add new receiver
  const handleAddReceiver = () => {
    setReceivers([
      ...receivers,
      {
        id: generateId(),
        phone: '',
        name: '',
        quantity: 1,
        message: ''
      }
    ])
  }

  // Remove receiver
  const handleRemoveReceiver = (id: string) => {
    setReceivers(receivers.filter(r => r.id !== id))
  }

  // Update receiver field
  const handleUpdateReceiver = (id: string, field: string, value: any) => {
    setReceivers(receivers.map(r =>
      r.id === id ? { ...r, [field]: value } : r
    ))
  }

  // Validate total quantity
  const totalReceiverQuantity = receivers.reduce((sum, r) => sum + r.quantity, 0)
  const isQuantityValid = totalReceiverQuantity <= totalQuantity

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">Gift Recipients</h3>

      {receivers.map((receiver, index) => (
        <div key={receiver.id} className="border rounded p-4 space-y-3">
          {/* Header with remove button */}
          <div className="flex justify-between items-center">
            <span className="font-semibold">Recipient {index + 1}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveReceiver(receiver.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Name input */}
          <div>
            <Label>Name (Optional)</Label>
            <Input
              value={receiver.name}
              onChange={(e) => handleUpdateReceiver(receiver.id, 'name', e.target.value)}
              placeholder="John Doe"
            />
          </div>

          {/* Phone input with validation */}
          <div>
            <Label>Phone Number *</Label>
            <Input
              value={receiver.phone}
              onChange={(e) => handleUpdateReceiver(receiver.id, 'phone', e.target.value)}
              placeholder="0912345678"
              error={receiver.phone && !isValidPhoneNumber(receiver.phone)}
              helperText={receiver.phone && !isValidPhoneNumber(receiver.phone) ? 'Invalid phone format' : ''}
            />
          </div>

          {/* Quantity input */}
          <div>
            <Label>Quantity (units)</Label>
            <Input
              type="number"
              min="1"
              max={totalQuantity - (totalReceiverQuantity - receiver.quantity)}
              value={receiver.quantity}
              onChange={(e) => handleUpdateReceiver(receiver.id, 'quantity', parseInt(e.target.value))}
            />
            <p className="text-xs text-gray-500">
              {receiver.quantity} × 100,000 = {(receiver.quantity * 100000).toLocaleString()} coins
            </p>
          </div>

          {/* Message input */}
          <div>
            <Label>Personal Message (Optional)</Label>
            <Textarea
              value={receiver.message}
              onChange={(e) => handleUpdateReceiver(receiver.id, 'message', e.target.value)}
              placeholder="Happy Birthday!"
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-gray-500">
              {receiver.message?.length || 0}/500 characters
            </p>
          </div>
        </div>
      ))}

      {/* Add recipient button */}
      <Button
        variant="outline"
        onClick={handleAddReceiver}
        disabled={totalReceiverQuantity >= totalQuantity}
      >
        + Add Another Recipient
      </Button>

      {/* Validation summary */}
      <div className="bg-blue-50 p-3 rounded">
        <p className="text-sm">
          <strong>Total Allocated:</strong> {totalReceiverQuantity} / {totalQuantity} units
        </p>
        {!isQuantityValid && (
          <p className="text-sm text-red-600 mt-1">
            ⚠️ Total recipient quantities exceed available gift cards
          </p>
        )}
      </div>

      {/* Recipient summary */}
      <div className="bg-gray-50 p-3 rounded">
        <p className="font-semibold text-sm mb-2">Recipients Summary:</p>
        <ul className="space-y-1 text-sm">
          {receivers.map((r, idx) => (
            <li key={r.id} className="flex justify-between">
              <span>{r.name || `Recipient ${idx + 1}`}</span>
              <span>{r.quantity} units</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

**UI Features:**
- Add/remove recipients dynamically
- Phone number validation (10-11 digits)
- Quantity per recipient
- Personal message
- Quantity allocation validation
- Summary display
- Error messages

### 10.5.9 Maximum Receivers Limit

**Configuration & Validation**

**File**: `src/constants/gift-card.ts`

```typescript
export const GIFT_CARD_CONFIG = {
  MAX_RECEIVERS_PER_ORDER: 10,      // Max recipients in single order
  MAX_QUANTITY_PER_RECIPIENT: 999,  // Max units per person
  MAX_MESSAGE_LENGTH: 500,          // Max characters in message
  SMS_RETRY_ATTEMPTS: 3,            // Auto-retry failed SMS
  RESEND_LIMIT: 3,                  // Manual resend limit per recipient
  SMS_SEND_DELAY: 2000,             // 2 seconds between SMS sends
  CODE_LENGTH: 9,                   // ABC123XYZ format
  SERIAL_FORMAT: 'GC-YYYY-XXXXXX'   // Pattern
}
```

**Validation in Schema & Runtime**

```typescript
// Zod schema validation
export const giftCardCheckoutSchema = z.object({
  receivers: z
    .array(
      z.object({
        phone: z
          .string()
          .regex(/^[0-9]{10,11}$/, 'Invalid phone number'),
        name: z.string().optional(),
        quantity: z
          .number()
          .min(1, 'Minimum 1 unit')
          .max(GIFT_CARD_CONFIG.MAX_QUANTITY_PER_RECIPIENT),
        message: z
          .string()
          .max(GIFT_CARD_CONFIG.MAX_MESSAGE_LENGTH)
          .optional()
      })
    )
    .min(1, 'At least one recipient required')
    .max(GIFT_CARD_CONFIG.MAX_RECEIVERS_PER_ORDER, 'Too many recipients'),

  // Validate total quantity
}).refine(
  (data) => {
    const total = data.receivers.reduce((sum, r) => sum + r.quantity, 0)
    return total <= selectedGiftCardQuantity
  },
  { message: 'Total recipient quantity exceeds available gift cards' }
)

// Runtime validation
const validateReceiversList = (receivers: Array<any>): ValidationResult => {
  if (receivers.length > GIFT_CARD_CONFIG.MAX_RECEIVERS_PER_ORDER) {
    return {
      valid: false,
      error: `Maximum ${GIFT_CARD_CONFIG.MAX_RECEIVERS_PER_ORDER} recipients allowed`
    }
  }

  for (const receiver of receivers) {
    if (!isValidPhoneNumber(receiver.phone)) {
      return {
        valid: false,
        error: `Invalid phone for recipient: ${receiver.phone}`
      }
    }

    if (receiver.quantity > GIFT_CARD_CONFIG.MAX_QUANTITY_PER_RECIPIENT) {
      return {
        valid: false,
        error: `Quantity cannot exceed ${GIFT_CARD_CONFIG.MAX_QUANTITY_PER_RECIPIENT}`
      }
    }
  }

  return { valid: true }
}
```

**Error Code: 158008**

```typescript
MAX_RECEIVERS_EXCEEDED: 158008  // Too many recipients in order
```

### 10.5.10 Gift Card History & Redemption Tracking

**History Management**

**File**: `src/gift-card-modules/gift-card/gift-card.service.ts`

```typescript
// Track gift card usage
interface GiftCardHistory {
  recipientId: string              // FK to gift_card_recipient
  eventType: 'CREATED' | 'SMS_SENT' | 'REDEEMED' | 'EXPIRED'
  timestamp: Date
  details?: string                 // Additional info
}

// When code is redeemed
async useGiftCard(data: {
  serial: string
  code: string
  userSlug: string
}) {
  // Step 1: Find recipient by serial & code
  const recipient = await giftCardRecipientRepository.findOne({
    where: {
      serialNumber: data.serial,
      code: data.code
    }
  })

  if (!recipient) {
    throw new NotFoundException(
      158001,  // Invalid gift card
      'Serial or code not found'
    )
  }

  // Step 2: Check if already redeemed
  if (recipient.hasRedeemed) {
    throw new BadRequestException(
      158002,  // Already used
      'This gift card has already been redeemed'
    )
  }

  // Step 3: Mark as redeemed
  await giftCardRecipientRepository.update(recipient.id, {
    hasRedeemed: true,
    redeemedAt: new Date()
  })

  // Step 4: Add points to user
  const pointsToAdd = recipient.quantity * 100000  // Each unit = 100K points
  await loyaltyPointService.addPoints(
    userSlug,
    pointsToAdd,
    `Gift card redeemed: ${data.serial}`
  )

  // Step 5: Create history record
  await giftCardHistoryRepository.save({
    recipientId: recipient.id,
    eventType: 'REDEEMED',
    timestamp: new Date(),
    details: `User ${userSlug} redeemed ${pointsToAdd} points`
  })

  return {
    pointsAdded: pointsToAdd,
    newBalance: await loyaltyPointService.getBalance(userSlug)
  }
}
```

**Recipient History Timeline:**

```
1. CREATED
   └─ GiftCardRecipient record created
      Timestamp: 2024-04-01 14:30:00
      Status: Record saved

2. SMS_SENT
   └─ SMS sent to recipient
      Timestamp: 2024-04-01 14:35:00
      Details: Serial & code delivered

3. REDEEMED
   └─ Customer enters serial & code
      Timestamp: 2024-04-05 10:15:00
      Details: 100,000 points added

4. (Lifecycle ends)
   └─ Gift card is now USED
      Status: hasRedeemed = true
```

---

## 10.6 Complete Request/Response Examples for All Use Cases

### 10.6.1 Use Case 1: SELF - Customer Buys For Themselves

**Scenario:** Customer buys 100K gift card to top-up their own coins

#### Step 1: Browse & Select Gift Card

**GET** `/card?page=1&limit=10`

```json
Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T10:30:00Z",
  "data": [
    {
      "slug": "gc-100k",
      "title": "Top Up 100K",
      "description": "100,000 coins",
      "image": "cards/gift-card-100k-1712142600000.png",
      "price": 100000,
      "points": 100000,
      "isActive": true,
      "version": 1
    },
    {
      "slug": "gc-50k",
      "title": "Top Up 50K",
      "description": "50,000 coins",
      "image": "cards/gift-card-50k-1712142600000.png",
      "price": 50000,
      "points": 50000,
      "isActive": true,
      "version": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2
  }
}
```

#### Step 2: Create Order (SELF Type, No Receivers)

**POST** `/card-order`

```json
Request:
{
  "customerSlug": "cust-user-001",
  "cardSlug": "gc-100k",
  "cardOrderType": "SELF",
  "quantity": 1,
  "totalAmount": 100000,
  "receipients": [],
  "cardVersion": 1
}

Response 201:
{
  "statusCode": 201,
  "timestamp": "2024-04-03T10:31:00Z",
  "result": {
    "slug": "co-self-2024-001",
    "code": "CO001",
    "sequence": 1,
    "status": "PENDING",
    "type": "SELF",
    "totalAmount": 100000,
    "orderDate": "2024-04-03T10:31:00Z",
    "quantity": 1,
    "cardSlug": "gc-100k",
    "cardTitle": "Top Up 100K",
    "cardPoint": 100000,
    "cardPrice": 100000,
    "cardImage": "cards/gift-card-100k-1712142600000.png",
    "customerSlug": "cust-user-001",
    "customerName": "Nguyễn Văn A",
    "customerPhone": "0912345678",
    "paymentStatus": "PENDING",
    "paymentMethod": null,
    "receipients": [],
    "giftCards": [],
    "createdAt": "2024-04-03T10:31:00Z"
  }
}
```

#### Step 3: Initiate Payment (Bank Transfer)

**POST** `/card-order/payment/initiate`

```json
Request:
{
  "cardorderSlug": "co-self-2024-001",
  "paymentMethod": "BANK_TRANSFER"
}

Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T10:32:00Z",
  "result": {
    "orderSlug": "co-self-2024-001",
    "paymentSlug": "pay-2024-001",
    "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAABkCAMAAACCP0s2AAAA...",
    "bankName": "Vietcombank",
    "accountName": "Restaurant Name",
    "accountNumber": "1234567890",
    "transferContent": "CO001",
    "amount": 100000,
    "validUntil": "2024-04-03T10:47:00Z"
  }
}
```

#### Step 4: Poll Payment Status (Every 2 seconds)

**POST** `/payment/poll`

```json
Request:
{
  "paymentSlug": "pay-2024-001"
}

Response 200 (Still Pending):
{
  "statusCode": 200,
  "result": {
    "slug": "pay-2024-001",
    "status": "PENDING",
    "statusCode": "PENDING",
    "method": "BANK_TRANSFER"
  }
}

Response 200 (Payment Completed):
{
  "statusCode": 200,
  "result": {
    "slug": "pay-2024-001",
    "status": "COMPLETED",
    "statusCode": "COMPLETED",
    "method": "BANK_TRANSFER",
    "transactionReference": "20240403001234",
    "completedAt": "2024-04-03T10:35:00Z"
  }
}
```

#### Step 5: Webhook - System Auto-Redeems (Backend)

When payment completes, backend calls `_generateAndRedeem()`:

```typescript
// Backend processes:
case CardOrderType.SELF:
  - Generate 1 code (serial + code)
  - Auto-redeem to customer: cust-user-001
  - Add 100,000 points to customer's account
  - Create PointTransaction record
```

#### Step 6: Get Order Details (After Payment)

**GET** `/card-order/co-self-2024-001`

```json
Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T10:36:00Z",
  "result": {
    "slug": "co-self-2024-001",
    "code": "CO001",
    "status": "COMPLETED",
    "type": "SELF",
    "totalAmount": 100000,
    "quantity": 1,
    "cardTitle": "Top Up 100K",
    "cardPoint": 100000,
    "paymentStatus": "COMPLETED",
    "paymentMethod": "BANK_TRANSFER",
    "customerSlug": "cust-user-001",
    "customerName": "Nguyễn Văn A",
    "receipients": [],
    "giftCards": [
      {
        "slug": "gc-item-001",
        "serial": "GC-2024-ABC1234567",
        "code": "ABC123XYZ7",
        "status": "USED",
        "cardName": "Top Up 100K",
        "cardPoints": 100000,
        "usedAt": "2024-04-03T10:35:30Z",
        "usedBySlug": "cust-user-001",
        "expiredAt": "2025-04-03T23:59:59Z"
      }
    ],
    "createdAt": "2024-04-03T10:31:00Z"
  }
}
```

#### Step 7: Verify Account Balance

**GET** `/user/balance`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "userSlug": "cust-user-001",
    "currentBalance": 100000,
    "totalSpent": 0,
    "totalEarned": 100000,
    "lastUpdated": "2024-04-03T10:35:30Z"
  }
}
```

---

### 10.6.2 Use Case 2: GIFT - Customer Buys For Others (Multiple Recipients)

**Scenario:** Customer buys 50K gift cards for 2 friends, SMS will be sent to them

#### Step 1: Create Order (GIFT Type, With Recipients)

**POST** `/card-order`

```json
Request:
{
  "customerSlug": "cust-user-002",
  "cardSlug": "gc-50k",
  "cardOrderType": "GIFT",
  "quantity": 2,
  "totalAmount": 100000,
  "receipients": [
    {
      "recipientSlug": "cust-friend-001",
      "phone": "0987654321",
      "quantity": 1,
      "message": "Happy birthday! 🎉",
      "name": "Bạn Tôi"
    },
    {
      "recipientSlug": "cust-friend-002",
      "phone": "0987654322",
      "quantity": 1,
      "message": "Thank you for being a great friend!",
      "name": "Bạn Khác"
    }
  ],
  "cardVersion": 1
}

Response 201:
{
  "statusCode": 201,
  "result": {
    "slug": "co-gift-2024-001",
    "code": "CO002",
    "status": "PENDING",
    "type": "GIFT",
    "totalAmount": 100000,
    "quantity": 2,
    "cardSlug": "gc-50k",
    "cardTitle": "Top Up 50K",
    "cardPoint": 50000,
    "cardPrice": 50000,
    "customerSlug": "cust-user-002",
    "customerName": "Người Tặng",
    "customerPhone": "0912999999",
    "paymentStatus": "PENDING",
    "receipients": [
      {
        "id": "recip-001",
        "recipientSlug": "cust-friend-001",
        "phone": "0987654321",
        "quantity": 1,
        "message": "Happy birthday! 🎉",
        "notificationStatus": "pending"
      },
      {
        "id": "recip-002",
        "recipientSlug": "cust-friend-002",
        "phone": "0987654322",
        "quantity": 1,
        "message": "Thank you for being a great friend!",
        "notificationStatus": "pending"
      }
    ],
    "giftCards": [],
    "createdAt": "2024-04-03T11:00:00Z"
  }
}
```

#### Step 2: Initiate Payment (Cash at Counter)

**POST** `/card-order/payment/initiate`

```json
Request:
{
  "cardorderSlug": "co-gift-2024-001",
  "paymentMethod": "CASH",
  "cashierSlug": "staff-001"
}

Response 200:
{
  "statusCode": 200,
  "result": {
    "orderSlug": "co-gift-2024-001",
    "paymentSlug": "pay-2024-002",
    "status": "PENDING",
    "method": "CASH",
    "amount": 100000,
    "paymentType": "COUNTER_PAYMENT"
  }
}
```

#### Step 3: Complete Cash Payment (Admin)

**POST** `/card-order/payment/complete`

```json
Request:
{
  "paymentSlug": "pay-2024-002",
  "status": "COMPLETED",
  "staffSlug": "staff-001"
}

Response 200:
{
  "statusCode": 200,
  "result": {
    "slug": "pay-2024-002",
    "status": "COMPLETED",
    "method": "CASH",
    "completedAt": "2024-04-03T11:02:00Z"
  }
}
```

#### Step 4: Webhook - Generate Codes & Send SMS (Backend)

```typescript
// Backend processes for GIFT:
case CardOrderType.GIFT:
  for each recipient:
    - Generate code (serial + code)
    - Add points to recipient's account: recipient-slug
    - Add PointTransaction for recipient
    - Queue SMS to recipient's phone
    - SMS content: "serial: GC-2024-ABC\ncode: ABC123XYZ7\nmessage: Happy birthday!"
    - SMS status: pending → sent/failed
```

#### Step 5: SMS Sent to Recipients

**SMS to 0987654321:**
```
🎁 Quà tặng từ Người Tặng:
serial: GC-2024-ABC1234567
code: ABC123XYZ7
Tin nhắn: Happy birthday! 🎉

Nhập serial + code để nhận 50,000 xu
https://app.example.com/redeem
```

**SMS to 0987654322:**
```
🎁 Quà tặng từ Người Tặng:
serial: GC-2024-DEF8901234
code: DEF456UVW8
Tin nhắn: Thank you for being a great friend!

Nhập serial + code để nhận 50,000 xu
https://app.example.com/redeem
```

#### Step 6: Check Order Status

**GET** `/card-order/co-gift-2024-001`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "slug": "co-gift-2024-001",
    "status": "COMPLETED",
    "type": "GIFT",
    "totalAmount": 100000,
    "quantity": 2,
    "cardTitle": "Top Up 50K",
    "paymentStatus": "COMPLETED",
    "customerName": "Người Tặng",
    "receipients": [
      {
        "id": "recip-001",
        "phone": "0987654321",
        "quantity": 1,
        "serialNumber": "GC-2024-ABC1234567",
        "code": "ABC123XYZ7",
        "notificationStatus": "sent",
        "sentAt": "2024-04-03T11:02:30Z"
      },
      {
        "id": "recip-002",
        "phone": "0987654322",
        "quantity": 1,
        "serialNumber": "GC-2024-DEF8901234",
        "code": "DEF456UVW8",
        "notificationStatus": "sent",
        "sentAt": "2024-04-03T11:02:35Z"
      }
    ],
    "giftCards": [
      {
        "serial": "GC-2024-ABC1234567",
        "code": "ABC123XYZ7",
        "status": "AVAILABLE",
        "cardPoints": 50000
      },
      {
        "serial": "GC-2024-DEF8901234",
        "code": "DEF456UVW8",
        "status": "AVAILABLE",
        "cardPoints": 50000
      }
    ]
  }
}
```

#### Step 7: Recipient Redeems Code

**POST** `/gift-card/use`

```json
Request (Recipient enters serial + code):
{
  "serial": "GC-2024-ABC1234567",
  "code": "ABC123XYZ7"
}

Response 200:
{
  "statusCode": 200,
  "result": {
    "status": "USED",
    "pointsAdded": 50000,
    "newBalance": 250000,
    "message": "Gift card redeemed successfully!",
    "redeemedAt": "2024-04-03T11:15:00Z"
  }
}
```

#### Step 8: Resend SMS (If Recipient Lost Code)

**POST** `/card-order/co-gift-2024-001/resend-sms/recip-001`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "recipientId": "recip-001",
    "phone": "0987654321",
    "notificationStatus": "sent",
    "resendCount": 1,
    "lastSentAt": "2024-04-03T11:20:00Z",
    "message": "SMS resent successfully"
  }
}
```

---

### 10.6.3 Use Case 3: BUY - Customer Buys Cards For Distribution

**Scenario:** Convenience store buys 5 × 20K gift cards to resell

#### Step 1: Create BUY Order

**POST** `/card-order`

```json
Request:
{
  "customerSlug": "cust-reseller-001",
  "cardSlug": "gc-20k",
  "cardOrderType": "BUY",
  "quantity": 5,
  "totalAmount": 100000,
  "receipients": [],
  "cardVersion": 1
}

Response 201:
{
  "statusCode": 201,
  "result": {
    "slug": "co-buy-2024-001",
    "code": "CO003",
    "status": "PENDING",
    "type": "BUY",
    "totalAmount": 100000,
    "quantity": 5,
    "cardSlug": "gc-20k",
    "cardTitle": "Top Up 20K",
    "cardPoint": 20000,
    "cardPrice": 20000,
    "customerSlug": "cust-reseller-001",
    "customerName": "Cửa Hàng ABC",
    "paymentStatus": "PENDING",
    "receipients": [],
    "giftCards": [],
    "createdAt": "2024-04-03T12:00:00Z"
  }
}
```

#### Step 2: Initiate Payment

**POST** `/card-order/payment/initiate`

```json
Request:
{
  "cardorderSlug": "co-buy-2024-001",
  "paymentMethod": "BANK_TRANSFER"
}

Response 200:
{
  "statusCode": 200,
  "result": {
    "orderSlug": "co-buy-2024-001",
    "paymentSlug": "pay-2024-003",
    "qrCode": "data:image/png;base64,...",
    "amount": 100000
  }
}
```

#### Step 3: Payment Completed

After customer scans QR and transfers → Payment webhook fires

#### Step 4: Get Order with Generated Codes

**GET** `/card-order/co-buy-2024-001`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "slug": "co-buy-2024-001",
    "status": "COMPLETED",
    "type": "BUY",
    "totalAmount": 100000,
    "quantity": 5,
    "cardTitle": "Top Up 20K",
    "paymentStatus": "COMPLETED",
    "giftCards": [
      {
        "slug": "gc-item-001",
        "serial": "GC-2024-AAA1111111",
        "code": "AAA111BBB1",
        "status": "AVAILABLE",
        "cardPoints": 20000
      },
      {
        "slug": "gc-item-002",
        "serial": "GC-2024-BBB2222222",
        "code": "BBB222CCC2",
        "status": "AVAILABLE",
        "cardPoints": 20000
      },
      {
        "slug": "gc-item-003",
        "serial": "GC-2024-CCC3333333",
        "code": "CCC333DDD3",
        "status": "AVAILABLE",
        "cardPoints": 20000
      },
      {
        "slug": "gc-item-004",
        "serial": "GC-2024-DDD4444444",
        "code": "DDD444EEE4",
        "status": "AVAILABLE",
        "cardPoints": 20000
      },
      {
        "slug": "gc-item-005",
        "serial": "GC-2024-EEE5555555",
        "code": "EEE555FFF5",
        "status": "AVAILABLE",
        "cardPoints": 20000
      }
    ],
    "createdAt": "2024-04-03T12:00:00Z"
  }
}
```

#### Step 5: View in Profile

**GET** `/gift-card/user?page=1&limit=20&status=AVAILABLE`

```json
Response 200:
{
  "statusCode": 200,
  "data": [
    {
      "slug": "gc-item-001",
      "cardName": "Top Up 20K",
      "serial": "GC-2024-AAA1111111",
      "code": "AAA111BBB1",
      "status": "AVAILABLE",
      "cardPoints": 20000,
      "createdAt": "2024-04-03T12:02:00Z",
      "expiredAt": "2025-04-03T23:59:59Z"
    },
    // ... 4 more cards
  ],
  "pagination": {
    "total": 5
  }
}
```

#### Step 6: Copy Code to Share

Click "Copy" button on card with serial "GC-2024-AAA1111111" and code "AAA111BBB1"

Clipboard text:
```
serial: GC-2024-AAA1111111
code: AAA111BBB1
```

Share with customer via message or print on card

#### Step 7: Customer Redeems

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-AAA1111111",
  "code": "AAA111BBB1"
}

Response 200:
{
  "statusCode": 200,
  "result": {
    "status": "USED",
    "pointsAdded": 20000,
    "newBalance": 120000,
    "message": "Gift card redeemed successfully!"
  }
}
```

---

### 10.6.4 Error Scenarios

#### Scenario 1: Invalid Serial/Code

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-INVALID",
  "code": "BADCODE"
}

Response 400:
{
  "statusCode": 400,
  "code": 158001,
  "message": "Invalid gift card",
  "timestamp": "2024-04-03T13:00:00Z"
}
```

#### Scenario 2: Already Redeemed

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-ABC1234567",
  "code": "ABC123XYZ7"
}

Response 400:
{
  "statusCode": 400,
  "code": 158002,
  "message": "Gift card has already been used",
  "timestamp": "2024-04-03T13:01:00Z",
  "data": {
    "usedAt": "2024-04-03T11:15:00Z",
    "usedBySlug": "cust-user-003"
  }
}
```

#### Scenario 3: Gift Card Expired

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-EXPIRED",
  "code": "EXP123456"
}

Response 400:
{
  "statusCode": 400,
  "code": 158003,
  "message": "Gift card has expired",
  "timestamp": "2024-04-03T13:02:00Z",
  "data": {
    "expiredAt": "2024-03-31T23:59:59Z"
  }
}
```

#### Scenario 4: Feature Flag Locked

**POST** `/card-order`

```json
Request (Trying to create GIFT order when GIFT is locked):
{
  "customerSlug": "cust-user-004",
  "cardSlug": "gc-50k",
  "cardOrderType": "GIFT",
  ...
}

Response 400:
{
  "statusCode": 400,
  "code": 158806,
  "message": "Feature is temporarily locked",
  "timestamp": "2024-04-03T13:03:00Z",
  "data": {
    "featureName": "GIFT",
    "reason": "Admin has disabled this feature"
  }
}
```

#### Scenario 5: SMS Sending Failed

```json
Order Status (after payment) with SMS failure:

{
  "slug": "co-gift-2024-002",
  "receipients": [
    {
      "id": "recip-003",
      "phone": "0987654323",
      "notificationStatus": "failed",
      "failureReason": "Invalid phone number",
      "retryCount": 3
    }
  ]
}
```

---

### 10.6.5 Admin Endpoints (Resend SMS)

**POST** `/card-order/{orderSlug}/resend-sms/{recipientId}`

```json
Request:
{
  "cardOrderSlug": "co-gift-2024-001",
  "recipientId": "recip-001"
}

Response 200:
{
  "statusCode": 200,
  "result": {
    "recipientId": "recip-001",
    "phone": "0987654321",
    "status": "sent",
    "resendCount": 1,
    "lastSentAt": "2024-04-03T13:05:00Z",
    "message": "SMS resent successfully"
  }
}

Response 400 (Max resend reached):
{
  "statusCode": 400,
  "code": 158808,
  "message": "Maximum SMS resend limit reached (3 attempts)",
  "data": {
    "recipientId": "recip-001",
    "resendCount": 3
  }
}
```

---

### 10.6.6 Summary Table: Request/Response Patterns

| Use Case | Endpoint | Method | Key Difference |
|----------|----------|--------|---|
| **SELF** | POST /card-order | POST | `receipients: []`, auto-redeem after payment |
| **GIFT** | POST /card-order | POST | `receipients: [...]`, SMS sent after payment |
| **BUY** | POST /card-order | POST | `receipients: []`, codes copied by buyer |
| **Redeem** | POST /gift-card/use | POST | Any code can be redeemed by anyone |
| **Profile** | GET /gift-card/user | GET | Shows all user's gift cards (SELF, GIFT, BUY) |
| **Order Details** | GET /card-order/{slug} | GET | Shows order + all generated codes |
| **Resend SMS** | POST /card-order/{slug}/resend-sms/{id} | POST | GIFT only, max 3 retries |
| **Payment Poll** | POST /payment/poll | POST | Check if payment completed |

---

## 10.7 Client Gift Card Management & Usage

### 10.7.1 Customer Profile: View All Gift Cards

**Page**: `/profile/gift-card`

#### Flow:
```
Profile → Gift Cards Tab
├─ Load all user's gift cards
├─ Display: Status, Card name, Points, Created date
├─ Filter options: AVAILABLE, USED, EXPIRED
├─ Search by card name
└─ Pagination: 10 items per page
```

#### API Call:

**GET** `/gift-card/user?page=1&limit=10&status=AVAILABLE&search=100K`

```json
Response 200:
{
  "statusCode": 200,
  "data": [
    {
      "slug": "gc-item-001",
      "cardSlug": "gc-100k",
      "cardName": "Top Up 100K",
      "serial": "GC-2024-ABC1234567",
      "code": "ABC123XYZ7",
      "status": "AVAILABLE",
      "cardPoints": 100000,
      "createdAt": "2024-04-03T10:31:00Z",
      "expiryDate": "2025-04-03T23:59:59Z",
      "daysRemaining": 365,
      "source": "SELF",
      "fromUser": null
    },
    {
      "slug": "gc-item-002",
      "cardSlug": "gc-50k",
      "cardName": "Top Up 50K",
      "serial": "GC-2024-DEF8901234",
      "code": "DEF456UVW8",
      "status": "AVAILABLE",
      "cardPoints": 50000,
      "createdAt": "2024-04-03T11:15:00Z",
      "expiryDate": "2025-04-03T23:59:59Z",
      "daysRemaining": 365,
      "source": "GIFT",
      "fromUser": {
        "slug": "cust-friend-001",
        "name": "Bạn Tôi",
        "message": "Happy birthday! 🎉"
      }
    },
    {
      "slug": "gc-item-003",
      "cardSlug": "gc-20k",
      "cardName": "Top Up 20K",
      "serial": "GC-2024-GHI5678901",
      "code": "GHI789JKL9",
      "status": "USED",
      "cardPoints": 20000,
      "createdAt": "2024-03-25T14:20:00Z",
      "expiryDate": "2025-03-25T23:59:59Z",
      "usedAt": "2024-04-02T16:45:00Z",
      "daysRemaining": 0,
      "source": "BUY"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 47,
    "totalPages": 5
  },
  "summary": {
    "totalAvailable": 15,
    "totalUsed": 28,
    "totalExpired": 4,
    "totalPoints": 1500000
  }
}
```

---

### 10.7.2 Gift Card Detail Modal

**Trigger**: Click "View Details" on any gift card

#### API Call:

**GET** `/gift-card/{giftCardSlug}`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "slug": "gc-item-001",
    "cardSlug": "gc-100k",
    "cardName": "Top Up 100K",
    "cardImage": "cards/gift-card-100k-1712142600000.png",
    "serial": "GC-2024-ABC1234567",
    "code": "ABC123XYZ7",
    "status": "AVAILABLE",
    "cardPoints": 100000,
    "cardDescription": "100,000 coins - Use anytime to top-up your account",
    "createdAt": "2024-04-03T10:31:00Z",
    "expiryDate": "2025-04-03T23:59:59Z",
    "daysRemaining": 365,
    "source": "SELF",
    "fromUser": null,
    "orderSlug": "co-self-2024-001",
    "orderDate": "2024-04-03T10:31:00Z",
    "totalOrderAmount": 100000,
    "orderType": "SELF",
    "paymentMethod": "BANK_TRANSFER"
  }
}
```

**UI Features:**
- Display card image, points, serial, code
- Show copy buttons for serial & code (separate + combined)
- Display source (SELF/GIFT/BUY) and metadata
- Show order details (collapsible)
- Action buttons: Redeem, Share

---

### 10.7.3 Redeem Gift Card UI

**Page**: `/redeem` or within Gift Card Detail Dialog

#### Input Form:

```
Form Fields:
├─ Serial: Text input "GC-2024-ABC1234567"
├─ Code: Text input "ABC123XYZ7"
├─ Submit: Button "Redeem Now" (disabled if invalid)
└─ Validation: Real-time error messages
```

#### API Call:

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-ABC1234567",
  "code": "ABC123XYZ7"
}

Response 200 (Success):
{
  "statusCode": 200,
  "result": {
    "status": "USED",
    "pointsAdded": 100000,
    "previousBalance": 150000,
    "newBalance": 250000,
    "message": "Gift card redeemed successfully!",
    "redeemedAt": "2024-04-03T14:30:00Z",
    "transactionId": "TXN-2024-001234"
  }
}

Response 400 (Already Used):
{
  "statusCode": 400,
  "code": 158002,
  "message": "Gift card has already been used",
  "data": {
    "usedAt": "2024-04-02T16:45:00Z"
  }
}

Response 400 (Expired):
{
  "statusCode": 400,
  "code": 158003,
  "message": "Gift card has expired",
  "data": {
    "expiredAt": "2024-03-31T23:59:59Z"
  }
}
```

**Success Screen:**
- ✓ Checkmark icon with success message
- Show points added: "+100,000 xu"
- Display new balance
- Show transaction ID & timestamp
- Action buttons: View Profile, Continue Shopping

---

### 10.7.4 Order History

**Page**: `/profile/gift-card/orders`

#### API Call:

**GET** `/card-order?customerSlug={userSlug}&page=1&limit=10&sort=-createdAt`

```json
Response 200:
{
  "statusCode": 200,
  "data": [
    {
      "slug": "co-gift-2024-001",
      "type": "GIFT",
      "status": "COMPLETED",
      "code": "CO002",
      "sequence": 2,
      "cardTitle": "Top Up 50K",
      "quantity": 2,
      "totalAmount": 100000,
      "paymentStatus": "COMPLETED",
      "paymentMethod": "CASH",
      "createdAt": "2024-04-03T11:00:00Z",
      "receipients": [
        {
          "id": "recip-001",
          "phone": "0987654321",
          "quantity": 1,
          "notificationStatus": "sent",
          "sentAt": "2024-04-03T11:02:30Z"
        },
        {
          "id": "recip-002",
          "phone": "0987654322",
          "quantity": 1,
          "notificationStatus": "sent",
          "sentAt": "2024-04-03T11:02:35Z"
        }
      ],
      "giftCards": [
        {
          "serial": "GC-2024-ABC1234567",
          "code": "ABC123XYZ7",
          "status": "AVAILABLE"
        },
        {
          "serial": "GC-2024-DEF8901234",
          "code": "DEF456UVW8",
          "status": "AVAILABLE"
        }
      ]
    },
    {
      "slug": "co-self-2024-001",
      "type": "SELF",
      "status": "COMPLETED",
      "code": "CO001",
      "sequence": 1,
      "cardTitle": "Top Up 100K",
      "quantity": 1,
      "totalAmount": 100000,
      "paymentStatus": "COMPLETED",
      "paymentMethod": "BANK_TRANSFER",
      "createdAt": "2024-04-03T10:31:00Z",
      "giftCards": [
        {
          "serial": "GC-2024-ABC1234567",
          "code": "ABC123XYZ7",
          "status": "USED",
          "usedAt": "2024-04-03T10:35:30Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

**UI:**
- Filter by type (SELF, GIFT, BUY, ALL)
- Filter by status (PENDING, COMPLETED, CANCELLED)
- List orders with summary: type emoji, card name, date, amount, status
- For GIFT: show recipient phones + SMS status
- Click "View Details" for full order info
- Ability to resend SMS for failed deliveries

---

### 10.7.5 Copy Code Functionality

```typescript
// Copy serial + code to clipboard in formatted text:
"serial: GC-2024-ABC1234567\ncode: ABC123XYZ7"

Share Options:
├─ Copy to clipboard → Show "Copied!" toast
├─ Share via WhatsApp → wa.me with pre-filled text
├─ Share via Email → mailto: with pre-filled text
├─ Print → Print formatted gift card
└─ QR Code → Generate QR code with serial+code
```

---

### 10.7.6 Cancel Order (Before Payment)

**Scenario**: Customer creates order but changes mind before paying

#### API Call:

**POST** `/card-order/{orderSlug}/cancel`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "slug": "co-pending-2024-001",
    "status": "CANCELLED",
    "previousStatus": "PENDING",
    "cancelledAt": "2024-04-03T10:35:00Z",
    "message": "Order cancelled successfully"
  }
}

Response 400 (Already Paid):
{
  "statusCode": 400,
  "code": 158807,
  "message": "Cannot cancel - order already completed",
  "data": {
    "status": "COMPLETED",
    "paidAt": "2024-04-03T10:33:00Z"
  }
}
```

**UI:**
- Show cancel button only if status = PENDING
- Warning: "You can cancel this order before payment"
- Confirmation modal: "Are you sure?"
- After cancel: show "Order cancelled" message

---

### 10.7.7 Transaction/Redemption History

**Page**: `/profile/gift-card/history`

#### API Call:

**GET** `/transaction?userSlug={userSlug}&objectType=CARD_ORDER&page=1&limit=20`

```json
Response 200:
{
  "statusCode": 200,
  "data": [
    {
      "slug": "txn-001",
      "type": "IN",
      "points": 100000,
      "description": "Nạp cho bản thân 100,000 xu",
      "objectType": "CARD_ORDER",
      "objectSlug": "co-self-2024-001",
      "previousBalance": 150000,
      "newBalance": 250000,
      "createdAt": "2024-04-03T10:35:30Z",
      "status": "COMPLETED"
    },
    {
      "slug": "txn-002",
      "type": "IN",
      "points": 50000,
      "description": "Nạp 50,000 xu từ người gửi Bạn Tôi",
      "objectType": "CARD_ORDER",
      "objectSlug": "co-gift-2024-001",
      "previousBalance": 200000,
      "newBalance": 250000,
      "createdAt": "2024-04-03T11:15:00Z",
      "status": "COMPLETED",
      "fromUser": {
        "name": "Bạn Tôi",
        "message": "Happy birthday! 🎉"
      }
    }
  ],
  "summary": {
    "totalIn": 1500000,
    "totalOut": 450000,
    "netChange": 1050000
  }
}
```

---

### 10.7.8 Client Features Summary Table

| Feature | Endpoint | Method | UI Location |
|---------|----------|--------|---|
| **View All Cards** | GET /gift-card/user | GET | Profile → Gift Cards |
| **Filter/Search** | GET /gift-card/user | GET | With status & date filters |
| **View Details** | GET /gift-card/{slug} | GET | Modal dialog |
| **Copy Code** | - | Client-side | Detail dialog, Card list |
| **Share Code** | - | Client-side | WhatsApp, Email, Print |
| **Redeem** | POST /gift-card/use | POST | /redeem page |
| **View Orders** | GET /card-order | GET | Profile → Orders |
| **Cancel Order** | POST /card-order/{slug}/cancel | POST | Order details (if PENDING) |
| **View History** | GET /transaction | GET | Profile → History |
| **Resend SMS** | POST /card-order/{slug}/resend-sms/{id} | POST | Order details (if failed) |

---

### 10.7.9 Complete Request/Response Examples for Client Management

#### 1️⃣ View All Gift Cards (Profile Page)

**GET** `/gift-card/user?page=1&limit=10&status=AVAILABLE`

```json
Request:
{
  "page": 1,
  "limit": 10,
  "status": "AVAILABLE",
  "search": null,
  "fromDate": null,
  "toDate": null
}

Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:00:00Z",
  "data": [
    {
      "slug": "gc-item-001",
      "cardSlug": "gc-100k",
      "cardName": "Top Up 100K",
      "cardImage": "cards/gift-card-100k-1712142600000.png",
      "serial": "GC-2024-ABC1234567",
      "code": "ABC123XYZ7",
      "status": "AVAILABLE",
      "cardPoints": 100000,
      "createdAt": "2024-04-03T10:31:00Z",
      "expiryDate": "2025-04-03T23:59:59Z",
      "daysRemaining": 365,
      "source": "SELF",
      "fromUser": null
    },
    {
      "slug": "gc-item-002",
      "cardSlug": "gc-50k",
      "cardName": "Top Up 50K",
      "cardImage": "cards/gift-card-50k-1712142600000.png",
      "serial": "GC-2024-DEF8901234",
      "code": "DEF456UVW8",
      "status": "AVAILABLE",
      "cardPoints": 50000,
      "createdAt": "2024-04-03T11:15:00Z",
      "expiryDate": "2025-04-03T23:59:59Z",
      "daysRemaining": 365,
      "source": "GIFT",
      "fromUser": {
        "slug": "cust-friend-001",
        "name": "Bạn Tôi",
        "phone": "0987654321",
        "message": "Happy birthday! 🎉"
      }
    },
    {
      "slug": "gc-item-003",
      "cardSlug": "gc-50k",
      "cardName": "Top Up 50K",
      "serial": "GC-2024-GHI9012345",
      "code": "GHI789JKL9",
      "status": "AVAILABLE",
      "cardPoints": 50000,
      "createdAt": "2024-04-02T15:45:00Z",
      "expiryDate": "2025-04-02T23:59:59Z",
      "daysRemaining": 364,
      "source": "BUY",
      "fromUser": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  },
  "summary": {
    "totalAvailable": 15,
    "totalUsed": 28,
    "totalExpired": 2,
    "totalPoints": 1500000
  }
}
```

---

#### 2️⃣ Filter by Status & Search

**GET** `/gift-card/user?page=1&limit=10&status=USED&search=100K&fromDate=2024-03-01&toDate=2024-04-03`

```json
Response 200:
{
  "statusCode": 200,
  "data": [
    {
      "slug": "gc-item-004",
      "cardSlug": "gc-100k",
      "cardName": "Top Up 100K",
      "serial": "GC-2024-MNO5678901",
      "code": "MNO123PQR1",
      "status": "USED",
      "cardPoints": 100000,
      "createdAt": "2024-03-15T10:20:00Z",
      "expiryDate": "2025-03-15T23:59:59Z",
      "usedAt": "2024-03-20T14:30:00Z",
      "usedByName": "Nguyễn Văn A",
      "source": "GIFT",
      "fromUser": {
        "slug": "cust-user-003",
        "name": "Người Gửi",
        "message": "Chúc mừng!"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  },
  "summary": {
    "totalUsed": 1,
    "totalPoints": 100000
  }
}
```

---

#### 3️⃣ View Gift Card Details (Modal)

**GET** `/gift-card/gc-item-001`

```json
Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:05:00Z",
  "result": {
    "slug": "gc-item-001",
    "cardSlug": "gc-100k",
    "cardName": "Top Up 100K",
    "cardImage": "cards/gift-card-100k-1712142600000.png",
    "cardDescription": "100,000 coins - Use anytime to top-up your account",
    "serial": "GC-2024-ABC1234567",
    "code": "ABC123XYZ7",
    "status": "AVAILABLE",
    "cardPoints": 100000,
    "createdAt": "2024-04-03T10:31:00Z",
    "expiryDate": "2025-04-03T23:59:59Z",
    "daysRemaining": 365,
    "expiresSoon": false,

    // Source info
    "source": "SELF",
    "fromUser": null,
    "message": null,

    // Related order
    "orderSlug": "co-self-2024-001",
    "orderDate": "2024-04-03T10:31:00Z",
    "orderType": "SELF",
    "totalOrderAmount": 100000,
    "paymentMethod": "BANK_TRANSFER",
    "paymentStatus": "COMPLETED",

    // Redemption info (if used)
    "usedAt": null,
    "usedBySlug": null,
    "usedByName": null,
    "redeemedPoints": null
  }
}
```

---

#### 4️⃣ View Details for GIFT Card (With Sender Info)

**GET** `/gift-card/gc-item-002`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "slug": "gc-item-002",
    "cardSlug": "gc-50k",
    "cardName": "Top Up 50K",
    "cardImage": "cards/gift-card-50k-1712142600000.png",
    "serial": "GC-2024-DEF8901234",
    "code": "DEF456UVW8",
    "status": "AVAILABLE",
    "cardPoints": 50000,
    "createdAt": "2024-04-03T11:15:00Z",
    "expiryDate": "2025-04-03T23:59:59Z",
    "daysRemaining": 365,

    // Source: GIFT with sender info
    "source": "GIFT",
    "fromUser": {
      "slug": "cust-friend-001",
      "name": "Bạn Tôi",
      "phone": "0987654321",
      "avatar": "avatars/friend-001.jpg"
    },
    "message": "Happy birthday! 🎉",
    "sentAt": "2024-04-03T11:15:30Z",

    // Related order
    "orderSlug": "co-gift-2024-001",
    "orderDate": "2024-04-03T11:00:00Z",
    "orderType": "GIFT"
  }
}
```

---

#### 5️⃣ View Details for USED Card

**GET** `/gift-card/gc-item-004`

```json
Response 200:
{
  "statusCode": 200,
  "result": {
    "slug": "gc-item-004",
    "cardSlug": "gc-100k",
    "cardName": "Top Up 100K",
    "serial": "GC-2024-MNO5678901",
    "code": "MNO123PQR1",
    "status": "USED",
    "cardPoints": 100000,
    "createdAt": "2024-03-15T10:20:00Z",
    "expiryDate": "2025-03-15T23:59:59Z",

    // Redemption details
    "usedAt": "2024-03-20T14:30:00Z",
    "usedBySlug": "cust-user-001",
    "usedByName": "Nguyễn Văn A",
    "redeemedPoints": 100000,
    "redeemedTransactionId": "TXN-2024-001234"
  }
}
```

---

#### 6️⃣ Redeem Gift Card (Thành công)

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-DEF8901234",
  "code": "DEF456UVW8"
}

Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:10:00Z",
  "result": {
    "status": "USED",
    "pointsAdded": 50000,
    "previousBalance": 150000,
    "newBalance": 200000,
    "message": "Gift card redeemed successfully!",
    "redeemedAt": "2024-04-03T14:10:00Z",
    "transactionId": "TXN-2024-005678",
    "cardName": "Top Up 50K",
    "serial": "GC-2024-DEF8901234"
  }
}
```

---

#### 7️⃣ Redeem - Already Used Error

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-ABC1234567",
  "code": "ABC123XYZ7"
}

Response 400:
{
  "statusCode": 400,
  "code": 158002,
  "message": "Gift card has already been used",
  "timestamp": "2024-04-03T14:11:00Z",
  "data": {
    "status": "USED",
    "usedAt": "2024-04-02T16:45:00Z",
    "usedByName": "Nguyễn Văn B"
  }
}
```

---

#### 8️⃣ Redeem - Card Expired Error

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-2024-OLD1234567",
  "code": "OLD123XYZ"
}

Response 400:
{
  "statusCode": 400,
  "code": 158003,
  "message": "Gift card has expired",
  "timestamp": "2024-04-03T14:12:00Z",
  "data": {
    "status": "EXPIRED",
    "expiredAt": "2024-03-31T23:59:59Z",
    "daysExpired": 3
  }
}
```

---

#### 9️⃣ Redeem - Invalid Card Error

**POST** `/gift-card/use`

```json
Request:
{
  "serial": "GC-INVALID",
  "code": "BADCODE"
}

Response 400:
{
  "statusCode": 400,
  "code": 158001,
  "message": "Invalid gift card - Serial or code not found",
  "timestamp": "2024-04-03T14:13:00Z",
  "data": {
    "message": "Please check your serial and code again"
  }
}
```

---

#### 🔟 View Order History

**GET** `/card-order?customerSlug=cust-user-001&page=1&limit=10&sort=-createdAt`

```json
Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:15:00Z",
  "data": [
    {
      "slug": "co-gift-2024-001",
      "code": "CO002",
      "type": "GIFT",
      "status": "COMPLETED",
      "sequence": 2,
      "cardTitle": "Top Up 50K",
      "quantity": 2,
      "totalAmount": 100000,
      "paymentStatus": "COMPLETED",
      "paymentMethod": "CASH",
      "createdAt": "2024-04-03T11:00:00Z",

      "receipients": [
        {
          "id": "recip-001",
          "phone": "0987654321",
          "quantity": 1,
          "notificationStatus": "sent",
          "sentAt": "2024-04-03T11:02:30Z"
        },
        {
          "id": "recip-002",
          "phone": "0987654322",
          "quantity": 1,
          "notificationStatus": "sent",
          "sentAt": "2024-04-03T11:02:35Z"
        }
      ],

      "giftCards": [
        {
          "serial": "GC-2024-ABC1234567",
          "code": "ABC123XYZ7",
          "status": "AVAILABLE"
        },
        {
          "serial": "GC-2024-DEF8901234",
          "code": "DEF456UVW8",
          "status": "AVAILABLE"
        }
      ]
    },
    {
      "slug": "co-self-2024-001",
      "code": "CO001",
      "type": "SELF",
      "status": "COMPLETED",
      "sequence": 1,
      "cardTitle": "Top Up 100K",
      "quantity": 1,
      "totalAmount": 100000,
      "paymentStatus": "COMPLETED",
      "paymentMethod": "BANK_TRANSFER",
      "createdAt": "2024-04-03T10:31:00Z",
      "receipients": [],
      "giftCards": [
        {
          "serial": "GC-2024-MNO5678901",
          "code": "MNO123PQR1",
          "status": "USED",
          "usedAt": "2024-04-03T10:35:30Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

---

#### 1️⃣1️⃣ Cancel Order (Before Payment)

**POST** `/card-order/co-pending-2024-001/cancel`

```json
Request:
{}

Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:20:00Z",
  "result": {
    "slug": "co-pending-2024-001",
    "status": "CANCELLED",
    "previousStatus": "PENDING",
    "cancelledAt": "2024-04-03T14:20:00Z",
    "message": "Order cancelled successfully"
  }
}

Response 400 (Cannot cancel - already paid):
{
  "statusCode": 400,
  "code": 158807,
  "message": "Cannot cancel - order already completed",
  "timestamp": "2024-04-03T14:21:00Z",
  "data": {
    "status": "COMPLETED",
    "paidAt": "2024-04-03T10:33:00Z"
  }
}
```

---

#### 1️⃣2️⃣ View Transaction/Redemption History

**GET** `/transaction?userSlug=cust-user-001&objectType=CARD_ORDER&page=1&limit=20`

```json
Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:25:00Z",
  "data": [
    {
      "slug": "txn-001",
      "type": "IN",
      "points": 100000,
      "description": "Nạp cho bản thân 100,000 xu",
      "objectType": "CARD_ORDER",
      "objectSlug": "co-self-2024-001",
      "previousBalance": 150000,
      "newBalance": 250000,
      "createdAt": "2024-04-03T10:35:30Z",
      "status": "COMPLETED",
      "cardTitle": "Top Up 100K",
      "source": "SELF"
    },
    {
      "slug": "txn-002",
      "type": "IN",
      "points": 50000,
      "description": "Nạp 50,000 xu từ người gửi Bạn Tôi",
      "objectType": "CARD_ORDER",
      "objectSlug": "co-gift-2024-001",
      "previousBalance": 200000,
      "newBalance": 250000,
      "createdAt": "2024-04-03T11:15:00Z",
      "status": "COMPLETED",
      "cardTitle": "Top Up 50K",
      "source": "GIFT",
      "fromUser": {
        "name": "Bạn Tôi",
        "message": "Happy birthday! 🎉"
      }
    },
    {
      "slug": "txn-003",
      "type": "IN",
      "points": 20000,
      "description": "Nạp 20,000 xu",
      "objectType": "CARD_ORDER",
      "objectSlug": "co-buy-2024-001",
      "previousBalance": 230000,
      "newBalance": 250000,
      "createdAt": "2024-03-20T14:30:00Z",
      "status": "COMPLETED",
      "cardTitle": "Top Up 20K",
      "source": "BUY"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  },
  "summary": {
    "totalIn": 170000,
    "totalOut": 0,
    "netChange": 170000,
    "dateRange": {
      "from": "2024-03-01",
      "to": "2024-04-03"
    }
  }
}
```

---

#### 1️⃣3️⃣ Resend SMS (For Failed Delivery)

**POST** `/card-order/co-gift-2024-001/resend-sms/recip-001`

```json
Request:
{}

Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:30:00Z",
  "result": {
    "recipientId": "recip-001",
    "phone": "0987654321",
    "cardSlug": "gc-50k",
    "serial": "GC-2024-ABC1234567",
    "code": "ABC123XYZ7",
    "notificationStatus": "sent",
    "resendCount": 1,
    "lastSentAt": "2024-04-03T14:30:00Z",
    "message": "SMS resent successfully"
  }
}

Response 400 (Max resend reached):
{
  "statusCode": 400,
  "code": 158808,
  "message": "Maximum SMS resend limit reached (3 attempts)",
  "timestamp": "2024-04-03T14:31:00Z",
  "data": {
    "recipientId": "recip-001",
    "resendCount": 3,
    "message": "Please contact support for assistance"
  }
}
```

---

#### 1️⃣4️⃣ Check User Balance (After Redeem)

**GET** `/user/balance`

```json
Response 200:
{
  "statusCode": 200,
  "timestamp": "2024-04-03T14:35:00Z",
  "result": {
    "userSlug": "cust-user-001",
    "currentBalance": 250000,
    "previousBalance": 200000,
    "lastTransaction": {
      "type": "IN",
      "points": 50000,
      "description": "Gift card redeemed",
      "timestamp": "2024-04-03T14:10:00Z"
    },
    "totalEarned": 500000,
    "totalSpent": 250000,
    "netBalance": 250000,
    "lastUpdated": "2024-04-03T14:10:00Z"
  }
}
```

---

### 10.7.10 Client Management Request/Response Summary

```
┌─────────────────────────────────────────────────────────────┐
│ CLIENT GIFT CARD MANAGEMENT: ALL ENDPOINTS                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. VIEW GIFT CARDS                                          │
│    GET /gift-card/user                                      │
│    ├─ Params: page, limit, status, search, dateRange       │
│    └─ Response: List of 15+ cards with pagination           │
│                                                             │
│ 2. FILTER BY STATUS                                         │
│    GET /gift-card/user?status=USED                          │
│    └─ Response: Filtered cards (AVAILABLE/USED/EXPIRED)     │
│                                                             │
│ 3. VIEW DETAILS                                             │
│    GET /gift-card/{slug}                                    │
│    └─ Response: Full card info + order details              │
│                                                             │
│ 4. VIEW DETAILS (GIFT)                                      │
│    GET /gift-card/{slug}                                    │
│    └─ Response: Include sender info + message               │
│                                                             │
│ 5. VIEW DETAILS (USED)                                      │
│    GET /gift-card/{slug}                                    │
│    └─ Response: Include redemption timestamp                │
│                                                             │
│ 6. REDEEM (SUCCESS)                                         │
│    POST /gift-card/use                                      │
│    ├─ Request: serial, code                                 │
│    └─ Response: Points added, new balance                   │
│                                                             │
│ 7. REDEEM (ERROR: ALREADY USED)                             │
│    POST /gift-card/use                                      │
│    └─ Response: 158002 - Already redeemed                   │
│                                                             │
│ 8. REDEEM (ERROR: EXPIRED)                                  │
│    POST /gift-card/use                                      │
│    └─ Response: 158003 - Card expired                       │
│                                                             │
│ 9. REDEEM (ERROR: INVALID)                                  │
│    POST /gift-card/use                                      │
│    └─ Response: 158001 - Invalid serial/code                │
│                                                             │
│ 10. VIEW ORDER HISTORY                                      │
│     GET /card-order?customerSlug=...                        │
│     ├─ Filter by: type (SELF/GIFT/BUY), status, date       │
│     └─ Response: List of orders with recipients & codes     │
│                                                             │
│ 11. CANCEL ORDER                                            │
│     POST /card-order/{slug}/cancel                          │
│     ├─ Condition: status must be PENDING                    │
│     └─ Response: Order cancelled or error if already paid    │
│                                                             │
│ 12. VIEW REDEMPTION HISTORY                                 │
│     GET /transaction?objectType=CARD_ORDER                  │
│     └─ Response: All IN transactions from gift cards         │
│                                                             │
│ 13. RESEND SMS                                              │
│     POST /card-order/{slug}/resend-sms/{id}                 │
│     ├─ Max 3 resends per recipient                          │
│     └─ Response: SMS sent or max reached                     │
│                                                             │
│ 14. CHECK BALANCE                                           │
│     GET /user/balance                                       │
│     └─ Response: Current balance + last transaction         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---


- **Types**: `src/types/gift-card.type.ts`
  - IGiftCard, IGiftCardCartItem, ICardOrder
- **Constants**: `src/constants/gift-card.ts`
  - Enums: GiftCardType, GiftCardStatus, GiftCardUsageStatus
- **Schemas**: `src/schemas/gift-card.schema.ts`
  - Zod validation schemas

### APIs & Hooks
- **API Functions**: `src/api/gift-card.ts`, `src/api/card-order.ts`
  - All endpoint wrappers
- **React Query Hooks**: `src/hooks/use-gift-card.ts`
  - useGetGiftCards, useCreateCardOrder, useInitiateCardOrderPayment
- **Polling Hook**: `src/hooks/use-gift-card-polling.ts`
  - useGiftCardPolling for payment status

### State Management
- **Store**: `src/stores/gift-card.store.ts`
  - Zustand store with localStorage persistence

### UI Components
- **List & Selection**:
  - `gift-card-item.tsx`
  - `gift-card-selected-drawer.tsx`
  - `gift-card-pagination.tsx`
  - `GiftCardExistsWarningDialog`
- **Checkout**:
  - `src/app/client/gift-card/checkout/page.tsx`
  - `gift-card-details-table.tsx`
  - `GiftCardTypeSelector`
  - `GiftCardRecipientsForm`
  - `ConfirmGiftCardCheckoutDialog`
- **Payment**:
  - `src/app/client/gift-card/checkout/[slug]/page.tsx`
  - `OrderInfo`
  - `PaymentMethodSection`
  - `PaymentQRCodeSection`
  - `GiftCardCountdown`
- **Redeem**:
  - `UseGiftCardDialog` (in sidebar/menu)

### Pages
- **Customer Pages**:
  - `/client/gift-card` - Browse & select
  - `/client/gift-card/checkout` - Configure & confirm
  - `/gift-card/checkout/[slug]` - Payment
  - `/gift-card/order-success/[slug]` - Receipt
- **Staff Pages**:
  - `/app/system/gift-card/checkout` - Staff checkout

---

## 12. Summary Table

| Aspect | Details |
|--------|---------|
| **Gift Card Type** | IS a product, NOT a discount |
| **Pricing** | Price (what customer pays) × Quantity |
| **Points** | Fixed amount, granted when redeemed |
| **Types** | SELF (self), GIFT (others), BUY (product), NONE (default) |
| **Status** | ACTIVE/INACTIVE (availability), AVAILABLE/USED/EXPIRED (redemption) |
| **Combination** | Cannot combine multiple gift cards in same cart |
| **Separate Order** | Yes, independent from food orders |
| **Payment Methods** | BANK_TRANSFER (QR), CASH (counter) |
| **Polling** | Every 15 seconds for bank transfer payment |
| **Error Codes** | 158001-158008 (gift card range) |
| **Validation** | Schema (Zod) + runtime checks + API validation |
| **State** | Zustand store with localStorage persistence |
| **Redeem** | Enter serial + code → points added to account |
| **Feature Flags** | Can lock GIFT type separately |
| **Recipients** | GIFT type requires receiver details |
| **Quantity** | 1-10 units per cart |

---

## 13. Conclusion

```
┌──────────────────────────────────────────────┐
│ GIFT CARD FEATURE SUMMARY                    │
├──────────────────────────────────────────────┤
│                                              │
│ WHAT IT IS:                                  │
│ ✓ Product to purchase (not discount)         │
│ ✓ Grants points/coins when redeemed         │
│ ✓ Separate from regular food orders         │
│ ✓ Independent payment lifecycle              │
│                                              │
│ HOW IT WORKS:                                │
│ 1. Browse & select gift card                 │
│ 2. Choose type (SELF or GIFT)               │
│ 3. Add recipients if GIFT type              │
│ 4. Confirm order & pay                      │
│ 5. Get serial + codes                       │
│ 6. Recipients redeem code anytime           │
│ 7. Points added to account                  │
│                                              │
│ KEY FEATURES:                                │
│ • One gift card per cart (no mixing)         │
│ • Two types: Personal top-up or Gift        │
│ • Two payment methods: Bank or Cash          │
│ • Polling every 15s for bank payment        │
│ • SMS notification for recipients           │
│                                              │
│ VALIDATION:                                  │
│ • Schema validation (Zod)                    │
│ • Runtime checks (quantity, receivers)       │
│ • API validation (code format, balance)      │
│                                              │
│ ERROR HANDLING:                              │
│ • Invalid code → Clear inputs                │
│ • Expired gift card → Show error             │
│ • Already used → Prevent redemption          │
│ • Feature locked → Disable option            │
│                                              │
└──────────────────────────────────────────────┘
```
