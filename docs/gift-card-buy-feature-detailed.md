# Gift Card BUY Feature: Detailed Logic & Use Cases

**Created**: 2026-04-03
**Status**: Complete Analysis

---

## 1. Quick Overview

**BUY Type = Purchase gift cards as products for later sharing**

```
Customer:
├─ Buys gift cards (like any product)
├─ Receives serial + code pairs
└─ Can copy & share codes with anyone

Different from:
├─ SELF: Buy → Auto-redeem → Points added to YOUR account
└─ GIFT: Buy → Send SMS → Codes go to specific recipients
```

---

## 2. What is BUY Type?

### 2.1 Definition

**BUY Type**: Customer purchases gift card codes as a **product** without specifying recipients. The customer receives the generated codes and is **responsible** for distributing them.

```
Purpose:
├─ Bulk purchase of gift cards for later distribution
├─ No immediate recipient specification needed
├─ Codes remain in customer's gift card history
└─ Sharable with anyone (print, email, message, etc.)
```

### 2.2 Comparison Matrix

| Aspect | SELF | GIFT | BUY |
|--------|------|------|-----|
| **Who buys?** | Customer | Customer | Customer |
| **Recipients specified?** | NO | YES (upfront) | NO |
| **Codes generated?** | YES | YES | YES |
| **SMS sent?** | NO | YES (auto) | NO |
| **Auto-redeem?** | YES (to buyer) | NO | NO |
| **Points added?** | YES (buyer) | YES (recipient) | NO |
| **When redeem?** | Instant | Recipient redeems later | Anyone can redeem |
| **Use case** | Personal top-up | Gift to friends | Bulk gift cards |

---

## 3. BUY Feature Complete Flow

### 3.1 Step-by-Step Checkout Flow

```
Step 1: Browse Gift Cards
├─ Customer views available gift cards
└─ Sees three options: SELF, GIFT, BUY

Step 2: Select BUY Type
├─ Customer clicks "Mua thẻ quà tặng" (Purchase gift card)
├─ Selects quantity (1-10 cards)
└─ NO receiver selection form appears

Step 3: Order Review
├─ Shows: Card name, price, quantity
├─ Total = Price × Quantity
└─ NO discount/voucher applicable

Step 4: Payment
├─ Choose payment method:
│  ├─ Bank Transfer (QR code + polling)
│  └─ Cash (counter payment)
└─ Wait for completion

Step 5: Payment Completed (Webhook)
├─ Backend calls: cardOrderService._generateAndRedeem()
├─ For BUY type: await gcService.bulkGen({
│    quantity: order.quantity,
│    cardSlug: order.cardSlug,
│    cardOrderSlug: order.slug
│  })
└─ Generate N (quantity) gift cards

Step 6: Codes Ready
├─ Each generated code has:
│  ├─ Serial: GC-YYYY-XXXXXX (15 chars)
│  ├─ Code: ABC123XYZ (9 chars)
│  └─ Status: AVAILABLE
└─ Stored in giftCard table with cardOrderSlug reference

Step 7: Customer Views Receipt
├─ GET /card-order/{orderSlug}
├─ Response includes: giftCards[] array
└─ Shows all generated serial+code pairs

Step 8: View in Profile
├─ Go to: Profile → Gift Cards
├─ See all gift cards from BUY purchases
├─ Status badge: AVAILABLE (waiting to redeem)
└─ Button: Copy serial+code
```

### 3.2 Backend Implementation: Payment Completion Handler

**File**: `src/gift-card-modules/card-order/card-order.service.ts:926-933`

```typescript
case CardOrderType.BUY:
  // Just create gift cards
  await this.gcService.bulkGen({
    quantity: databaseEntity.quantity,
    cardSlug: databaseEntity.cardSlug,
    cardOrderSlug: databaseEntity.slug,
  });
  break;
```

**Key Point**: Only generates codes, does NOT add points to buyer's account.

### 3.3 Code Generation Details

**File**: `src/gift-card-modules/gift-card/gift-card.service.ts`

```typescript
async bulkGen(payload: {
  quantity: number;
  cardSlug: string;
  cardOrderSlug: string;
}): Promise<GiftCard[]> {
  const generatedCards: GiftCard[] = [];

  for (let i = 0; i < payload.quantity; i++) {
    // Generate unique serial
    const serial = `GC-${new Date().getFullYear()}-${this.generateRandomCode()}`;
    // Verify uniqueness (loop until unique)
    while (await this.giftCardRepository.findOne({ where: { serial } })) {
      serial = `GC-${new Date().getFullYear()}-${this.generateRandomCode()}`;
    }

    // Generate code with checksum
    const code = this.generateCodeWithChecksum(); // e.g., "ABC123XYZ7"

    // Create and save
    const giftCard = this.giftCardRepository.create({
      serial,
      code,
      cardSlug: payload.cardSlug,
      cardOrderSlug: payload.cardOrderSlug,
      status: GiftCardStatus.AVAILABLE,
      expiredAt: calculateExpiryDate()
    });

    generatedCards.push(await this.giftCardRepository.save(giftCard));
  }

  return generatedCards;
}
```

---

## 4. UI/UX: How Customer Uses BUY

### 4.1 Checkout Screen: BUY Type Selection

```typescript
// File: client-gift-card-sheet.tsx:143-155

if (watchedGiftType === GiftCardType.SELF || watchedGiftType === GiftCardType.BUY) {
  // Clear any existing validation errors for receivers
  form.clearErrors('receivers')
  // Reset receivers array to empty when BUY is selected
  form.setValue('receivers', [])
  // Quantity: can be 1-10
  updateQuantity(1)
  setHasSelectedRecipients(false)
}
```

**Form Fields for BUY:**
- Type: BUY (hidden)
- Card: Selected gift card
- Quantity: 1-10 (no receiver-specific quantities)
- Receivers: [] (empty array)

### 4.2 Receipt/Order Details Screen

**File**: `gift-card-order-details-sheet.tsx:279-282`

```typescript
{
  cardOrder?.type === GiftCardType.BUY &&
  cardOrder.status === CardOrderStatus.COMPLETED &&
  <div className="flex justify-end">
    <NavLink to={`${ROUTE.CLIENT_PROFILE}/gift-card`}>
      <Button>View Details</Button>
    </NavLink>
  </div>
}
```

When order completes → Shows "View Details" button → Links to gift card profile.

### 4.3 Gift Card Profile: Copy & Share

**File**: `customer-gift-card-tabs-content.tsx:92-101`

```typescript
const handleCopyCode = useCallback(
  async (e: React.MouseEvent, code: string, serial: string) => {
    e.stopPropagation()
    // Format: "serial: {serial}\ncode: {code}"
    const formatted = `serial: ${serial}\ncode: ${code}`
    await navigator.clipboard.writeText(formatted)
    setCopiedCode(code)
    // Show "Copied!" feedback for 2 seconds
    setTimeout(() => setCopiedCode(null), 2000)
  },
  [],
)
```

**UX Flow:**
1. Go to Profile → Gift Cards
2. See list of all gift cards (from BUY orders)
3. Each item shows:
   - Card name
   - Status: AVAILABLE / USED / EXPIRED
   - Created date/time
   - Points value
4. Click "Copy" button → Copies to clipboard:
   ```
   serial: GC-2026-ABC1234567
   code: ABC123XYZ7
   ```
5. Share text with recipient

---

## 5. Real-World Use Cases

### 5.1 **Case 1: Corporate Gift Cards**

```
Scenario:
├─ Company wants to give 50 gift cards to employees
├─ Buys 50 × 100K card (BUY type)
├─ Receives 50 serial+code pairs
└─ Prints and distributes to staff

Timeline:
T0: Order created, payment initiated
T1: Cashier confirms cash payment or approves bank transfer
T2: Payment completed → 50 codes generated
T3: Admin downloads codes, prints certificates
T4: Give to 50 employees
T5: Each employee redeems code → Points added
```

### 5.2 **Case 2: Event Sponsorship**

```
Scenario:
├─ Event organizer buys 100 × 50K cards
├─ Plans to give away at booth
├─ Doesn't know recipients in advance
└─ Prints QR codes or cards with serial+code

Process:
1. Buy 100 cards (BUY type)
2. Generate 100 codes
3. Print on cards or QR codes
4. Hand out at event
5. Recipients scan/enter serial+code to redeem
```

### 5.3 **Case 3: Retail Reseller**

```
Scenario:
├─ Convenience store owner buys 500 × 20K cards
├─ Sells to customers as gift products
├─ Customers redeem in their own accounts
└─ Store keeps margin on sales

Setup:
1. Bulk order: 500 cards (BUY type)
2. Costs: 500 × 20K = 10M
3. Retail price: 25K per card
4. Profit: (25K - 20K) × 500 = 2.5M
5. Print on cards and sell

Customer flow:
1. Buy card from store
2. Get serial+code
3. Redeem online or in app
4. Add points to account
```

### 5.4 **Case 4: Personal Gift Stock**

```
Scenario:
├─ User wants to always have gift cards ready
├─ Buys 10 × 100K cards upfront
├─ Gives to friends throughout year
└─ No need to buy individually each time

Benefit:
├─ Bulk discount (if applicable)
├─ Ready to give anytime
├─ Track all codes in one place
└─ Easy to copy and send via message
```

---

## 6. API Endpoints

### 6.1 Create BUY Order

**POST** `/card-order`

```json
{
  "cardSlug": "gc-100k",
  "cardOrderType": "BUY",
  "quantity": 5,
  "totalAmount": 500000,
  "customerSlug": "cust-123",
  "receipients": []
}
```

**Response:**
```json
{
  "statusCode": 201,
  "result": {
    "slug": "co-buy-2026-001",
    "type": "BUY",
    "status": "PENDING",
    "quantity": 5,
    "cardTitle": "Top Up 100K",
    "totalAmount": 500000
  }
}
```

### 6.2 Initiate Payment

**POST** `/card-order/payment/initiate`

```json
{
  "cardOrderSlug": "co-buy-2026-001",
  "paymentMethod": "BANK_TRANSFER"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "result": {
    "orderSlug": "co-buy-2026-001",
    "paymentSlug": "pay-2026-001",
    "qrCode": "data:image/png;base64,..."
  }
}
```

### 6.3 Get Order Details (After Payment)

**GET** `/card-order/{orderSlug}`

```json
{
  "statusCode": 200,
  "result": {
    "slug": "co-buy-2026-001",
    "type": "BUY",
    "status": "COMPLETED",
    "quantity": 5,
    "cardTitle": "Top Up 100K",
    "totalAmount": 500000,
    "giftCards": [
      {
        "slug": "gc-2026-001",
        "serial": "GC-2026-ABC1234567",
        "code": "ABC123XYZ7",
        "status": "AVAILABLE",
        "cardPoints": 100000
      },
      {
        "slug": "gc-2026-002",
        "serial": "GC-2026-DEF8901234",
        "code": "DEF456UVW8",
        "status": "AVAILABLE",
        "cardPoints": 100000
      },
      // ... 3 more cards
    ]
  }
}
```

### 6.4 Get User Gift Cards (Profile)

**GET** `/gift-card/user?page=1&limit=10&status=AVAILABLE`

**Response:**
```json
{
  "statusCode": 200,
  "result": [
    {
      "slug": "gc-2026-001",
      "cardName": "Top Up 100K",
      "serial": "GC-2026-ABC1234567",
      "code": "ABC123XYZ7",
      "status": "AVAILABLE",
      "cardPoints": 100000,
      "createdAt": "2026-04-03T10:30:00Z",
      "expiredAt": "2027-04-03T23:59:59Z",
      "usedAt": null
    },
    // ... more gift cards
  ]
}
```

### 6.5 Redeem Gift Card

**POST** `/gift-card/redeem`

```json
{
  "serial": "GC-2026-ABC1234567",
  "code": "ABC123XYZ7"
}
```

**Response:**
```json
{
  "statusCode": 200,
  "result": {
    "status": "USED",
    "pointsAdded": 100000,
    "newBalance": 850000,
    "message": "Successfully added 100,000 xu to your account"
  }
}
```

---

## 7. Data Models

### 7.1 CardOrder Entity (BUY Type)

```typescript
@Entity('card_order')
export class CardOrder {
  @Column({ type: 'varchar', length: 50 })
  slug: string;

  @Column({ type: 'varchar', length: 20 })
  type: CardOrderType; // "BUY"

  @Column({ type: 'varchar', length: 20 })
  status: CardOrderStatus; // "PENDING" → "COMPLETED"

  @Column({ type: 'int' })
  quantity: number; // How many cards to generate

  @Column({ type: 'varchar', length: 50 })
  cardSlug: string; // Which card template

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  totalAmount: number; // Price × Quantity

  @Column({ type: 'varchar', length: 50 })
  customerSlug: string; // Who's buying

  @Column({ type: 'varchar', length: 100 })
  customerName: string;

  @Column({ type: 'varchar', length: 15 })
  customerPhone: string;

  // BUY type specific: NO receipients
  @OneToMany(() => Recipient, r => r.cardOrder)
  receipients: Recipient[]; // Empty array for BUY

  // Generated gift cards
  @OneToMany(() => GiftCard, gc => gc.cardOrder)
  giftCards: GiftCard[]; // Contains serial+code pairs

  @OneToOne(() => Payment, p => p.cardOrder)
  payment: Payment;

  @Column({ type: 'datetime' })
  createdAt: Date;
}
```

### 7.2 GiftCard Entity (Generated for BUY)

```typescript
@Entity('gift_card')
export class GiftCard {
  @Column({ type: 'varchar', length: 50 })
  slug: string; // Unique ID

  @Column({ type: 'varchar', length: 20 })
  serial: string; // GC-2026-ABC1234567

  @Column({ type: 'varchar', length: 20 })
  code: string; // ABC123XYZ7

  @Column({ type: 'varchar', length: 20 })
  status: GiftCardStatus; // "AVAILABLE" → "USED"

  @Column({ type: 'int' })
  cardPoints: number; // e.g., 100000

  @Column({ type: 'varchar', length: 50 })
  cardSlug: string; // Reference to gift card template

  @Column({ type: 'varchar', length: 50 })
  cardOrderSlug: string; // BUY order slug

  @Column({ type: 'varchar', length: 50, nullable: true })
  usedBySlug: string; // Who redeemed it

  @Column({ type: 'datetime', nullable: true })
  usedAt: Date; // When redeemed

  @Column({ type: 'datetime' })
  expiredAt: Date; // Expiry date

  @Column({ type: 'datetime' })
  createdAt: Date;
}
```

---

## 8. Validation Rules

### 8.1 Frontend Validation

```typescript
const buyTypeValidation = z.object({
  cardSlug: z.string().min(1, "Card required"),
  quantity: z.number()
    .min(1, "Quantity at least 1")
    .max(10, "Max 10 cards per order"),
  giftType: z.literal('BUY'),
  receivers: z.array(z.any()).length(0, "BUY type has no receivers"),
})
```

### 8.2 Backend Validation

```typescript
// In cardOrderService.create()

// 1. Check card exists
const card = await cardRepository.findOne({ slug })
if (!card) throw new CardOrderException(INVALID_CARD)

// 2. Check quantity
if (quantity < 1 || quantity > 10) {
  throw new CardOrderException(INVALID_QUANTITY)
}

// 3. For BUY type: verify NO recipients
if (createCardOrderDto.cardOrderType === CardOrderType.BUY) {
  if (createCardOrderDto.receipients?.length > 0) {
    throw new CardOrderException(BUY_TYPE_NO_RECIPIENTS)
  }
}

// 4. Check feature flag
const flag = await featureFlagRepository.findOne({
  where: { name: 'BUY' }
})
if (flag?.isLocked) {
  throw new CardOrderException(FEATURE_LOCKED)
}
```

---

## 9. Edge Cases & Error Handling

### 9.1 Potential Issues

```
Issue 1: BUY order cancelled before payment
├─ Status: PENDING → CANCELLED
├─ No codes generated
└─ Customer sees cancelled order

Issue 2: Code already redeemed
├─ User tries to redeem same code twice
├─ Error: "Gift card already used"
├─ Status: USED
└─ Cannot redeem again

Issue 3: Code expired
├─ Expiry date passed
├─ Cannot redeem even if AVAILABLE
└─ Error: "Gift card expired"

Issue 4: Bulk generation failure
├─ System error during bulkGen()
├─ Order status: COMPLETED (payment done)
├─ But NO codes generated
└─ Admin must retry code generation
```

### 9.2 Error Codes

```
158001: Invalid gift card
158004: Gift card not active
158006: Feature locked (BUY disabled)
158008: Max receivers exceeded (N/A for BUY)
158802: Order not found
158803: Error updating order
158806: Feature is temporarily locked
```

---

## 10. Differences: BUY vs SELF vs GIFT

### 10.1 Recipient & SMS

```
SELF (Auto-redeem personal):
├─ No receivers specified
├─ No SMS sent
├─ Codes generated
├─ Auto-redeem to buyer's account
└─ Points added immediately

GIFT (Send via SMS):
├─ Receivers specified upfront
├─ SMS sent with serial+code
├─ Codes generated per recipient
├─ Points added when recipient redeems
└─ Resend SMS option available

BUY (Manual distribution):
├─ No receivers specified
├─ No SMS sent
├─ Codes generated for buyer
├─ Buyer copies & shares manually
└─ Anyone can redeem with code
```

### 10.2 Payment Completion Handler

```
SELF:
  - Generate codes (commented out in current code)
  - Auto-redeem (commented out)
  - Add points to buyer: YES

GIFT:
  - Generate codes for each recipient
  - Auto-redeem (commented out)
  - Add points to recipients: YES

BUY:
  - Generate codes (bulkGen)
  - Auto-redeem: NO
  - Add points: NO (wait for redemption)
```

---

## 11. Key Code Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `card-order.service.ts` | 926-933 | BUY payment completion handler |
| `card-order.service.ts` | 597-710 | Order creation (no recipients for BUY) |
| `client-gift-card-sheet.tsx` | 143-155 | Checkout form (empty receivers for BUY) |
| `gift-card-order-details-sheet.tsx` | 279-282 | Show "View Details" for completed BUY |
| `customer-gift-card-tabs-content.tsx` | 92-101 | Copy serial+code in profile |
| `gift-card.service.ts` | - | bulkGen() method |
| `card-order.entity.ts` | - | CardOrder with giftCards relation |
| `gift-card.entity.ts` | - | GiftCard with serial, code, status |

---

## 12. Summary: BUY Feature

```
┌─────────────────────────────────────────────────────┐
│ GIFT CARD BUY FEATURE                               │
├─────────────────────────────────────────────────────┤
│                                                     │
│ WHAT: Buy gift cards without specifying recipients │
│                                                     │
│ WHY: Bulk purchase, corporate gifts, resale        │
│                                                     │
│ HOW:                                                │
│  1. Select BUY type (no receivers)                  │
│  2. Choose quantity (1-10)                          │
│  3. Pay (Bank/Cash)                                 │
│  4. Receive codes (serial+code pairs)               │
│  5. Copy & share with anyone                        │
│  6. Recipients redeem to add points                 │
│                                                     │
│ UNIQUE: Customer controls distribution timing      │
│                                                     │
│ STATUS: AVAILABLE → USED (when redeemed)            │
│                                                     │
│ POINTS: Added when redeemed (not at purchase)       │
│                                                     │
│ RECEIVERS: Not specified upfront                    │
│                                                     │
│ SMS: Not sent (manual distribution)                 │
│                                                     │
│ CODES: Stored in customer's gift card profile       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 13. Complete BUY Order Lifecycle

```
T0: Customer initiates order
├─ Selects gift card
├─ Sets quantity: 5
├─ Type: BUY
└─ Total: 500,000

T1: Order created
├─ Status: PENDING
├─ No recipients
└─ Waiting for payment

T2: Payment initiated
├─ Customer chooses method
├─ Bank: Shows QR code + polling
└─ Cash: Counter payment

T3: Payment completed
├─ Status: COMPLETED (if PAID)
├─ Webhook triggers: _generateAndRedeem()
├─ bulkGen() generates 5 codes
└─ Each code: serial + code + status AVAILABLE

T4: Codes ready
├─ Stored in giftCard table
├─ cardOrderSlug = "co-buy-2026-001"
└─ All 5 codes linked to order

T5: Customer views receipt
├─ GET /card-order/co-buy-2026-001
├─ Response includes giftCards[]
└─ Shows all 5 serial+code pairs

T6: Customer views in profile
├─ Profile → Gift Cards
├─ Filters by status
├─ Sees all BUY orders
└─ Each card shows serial, code, status, expiry

T7: Customer shares
├─ Click "Copy" on any code
├─ Format: "serial: GC-2026-ABC1234567\ncode: ABC123XYZ7"
├─ Share via WhatsApp, email, print, etc.
└─ Multiple people can get copies

T8-Tn: Recipients redeem
├─ Enter serial + code
├─ System validates both
├─ Status: AVAILABLE → USED
├─ Points added to redeemer's account
└─ Transaction recorded

Tx: Card expires
├─ If not redeemed by expireAt date
├─ Status: AVAILABLE → EXPIRED
└─ Cannot redeem anymore
```

---

## Document Summary

- **BUY Type Purpose**: Buy gift cards for bulk distribution without pre-specifying recipients
- **Key Difference**: Manual code distribution (copy & share) vs. auto SMS (GIFT)
- **Use Cases**: Corporate gifts, event giveaways, reseller inventory, personal gift stock
- **Payment Flow**: Same as SELF/GIFT (Bank/Cash)
- **Code Generation**: 5 BUY codes = 5 serial+code pairs for any recipients
- **API**: Standard CRUD + bulk code generation
- **Validation**: Quantity 1-10, no receivers allowed, feature flag check
- **UX**: Checkout (easy) → Payment → Copy codes in profile → Share

---

**Status**: Complete
**Last Updated**: 2026-04-03

