# Gift Card Purchase — Client Flow (API reference + use cases)

Phạm vi: **client (CUSTOMER)** — không bao gồm staff/admin.

Tất cả request qua `http` client (axios). Các endpoint dưới đây là tương đối — prefix base được gắn ở layer `@/utils/http`.

---

## 1. Endpoints sử dụng trong flow mua

### 1.1 `GET /card` — List gift card catalog

**Hook**: `useGetGiftCards(params)` ([use-gift-card.ts:37](../app/order-ui/src/hooks/use-gift-card.ts))
**Function**: `getGiftCards(params)` ([gift-card.ts:19](../app/order-ui/src/api/gift-card.ts))

#### Request

| Param      | Type              | Required | Ghi chú                                    |
| ---------- | ----------------- | -------- | ------------------------------------------ |
| `page`     | `number`          | optional | Default 1                                  |
| `size`     | `number`          | optional | Default 10                                 |
| `sort`     | `string`          | optional |                                            |
| `isActive` | `boolean \| null` | optional | Nên truyền `true` để chỉ hiện thẻ đang bán |

Type: `IGetGiftCardsRequest` ([gift-card.type.ts:53](../app/order-ui/src/types/gift-card.type.ts))

#### Response: `IApiResponse<IPaginationResponse<IGiftCard>>`

```ts
IGiftCard {
  slug: string
  image: string
  title: string
  description: string
  points: number        // số điểm thẻ tặng người nhận
  price: number         // giá tiền VND
  isActive: boolean
  version: number       // để FE sync khi BE đổi giá
}
```

---

### 1.2 `GET /card/:slug` — Chi tiết thẻ (sync price/version)

**Hook**: `useSyncGiftCard(slug, options)` ([use-gift-card.ts:206](../app/order-ui/src/hooks/use-gift-card.ts))
**Function**: `getGiftCard(slug)` ([gift-card.ts:38](../app/order-ui/src/api/gift-card.ts))

Dùng sau khi user mở cart/sheet — so khớp `price`/`version` trong `giftCardItem` (store) với BE qua `synchronizeWithServer`. Nếu khác → cập nhật store + toast báo đổi giá.

#### Response: `IApiResponse<IGiftCard>`

---

### 1.3 `GET /feature-flag?group=GIFT_CARD` — Flag SELF / GIFT / BUY

**Hook**: `useGetFeatureFlagsByGroup('GIFT_CARD')` ([use-gift-card.ts:306](../app/order-ui/src/hooks/use-gift-card.ts))
**Function**: `getFeatureFlagsByGroup(group)` ([gift-card.ts:145](../app/order-ui/src/api/gift-card.ts))

#### Request

| Param   | Value         |
| ------- | ------------- |
| `group` | `"GIFT_CARD"` |

#### Response: `IApiResponse<IGiftCardFlagFeature[]>`

```ts
IGiftCardFlagFeature {
  slug: string
  groupName: string
  groupSlug: string
  name: GiftCardType  // SELF | GIFT | BUY | NONE
  isLocked: boolean   // true → ẩn option trên UI
  order: number
}
```

Dùng để ẩn các option loại thẻ bị disable từ backoffice.

---

### 1.4 `POST /card-order` — Tạo order thẻ quà tặng

**Hook**: `useCreateCardOrder()` ([use-gift-card.ts:195](../app/order-ui/src/hooks/use-gift-card.ts))
**Function**: `createCardOrder(data)` ([gift-card.ts:85](../app/order-ui/src/api/gift-card.ts))

Gọi từ [client-gift-card-sheet.tsx:224](../app/order-ui/src/components/app/gift-card/components/client-gift-card-sheet.tsx) khi user bấm Xác nhận trong sheet.

#### Request body: `ICardOrderRequest` ([card-order.type.ts:9](../app/order-ui/src/types/card-order.type.ts))

| Field           | Type                        | Required     | Ghi chú                                                        |
| --------------- | --------------------------- | ------------ | -------------------------------------------------------------- |
| `customerSlug`  | `string`                    | **required** | `userInfo.slug` của buyer (phải login)                         |
| `cashierSlug`   | `string`                    | optional     | **Chỉ staff dùng** — client luôn bỏ trống                      |
| `cardOrderType` | `"SELF" \| "GIFT" \| "BUY"` | **required** | Lấy từ form `data.giftType`                                    |
| `cardSlug`      | `string`                    | **required** | `giftCardItem.slug`                                            |
| `quantity`      | `number`                    | **required** | 1–100, lấy từ store                                            |
| `totalAmount`   | `number`                    | **required** | `price * quantity` (FE tính, BE verify lại)                    |
| `receipients`   | `IRecipient[]`              | optional     | Bắt buộc khi `cardOrderType === "GIFT"`; bỏ trống với SELF/BUY |
| `cardVersion`   | `number`                    | **required** | `giftCardItem.version ?? 0` — BE reject nếu version lệch       |

#### `IRecipient` ([card-order.type.ts:32](../app/order-ui/src/types/card-order.type.ts))

| Field           | Type     | Required           | Ghi chú                                                                                                                                                                          |
| --------------- | -------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recipientSlug` | `string` | **required**       | Schema: `min(10)` — slug user đã register                                                                                                                                        |
| `quantity`      | `number` | **required**       | 1–100; tổng qty của tất cả recipient ≤ `giftCardItem.quantity`                                                                                                                   |
| `message`       | `string` | optional           | Lời nhắn kèm thẻ                                                                                                                                                                 |
| `name`          | `string` | optional (FE form) | **Không gửi BE** — strip ra bằng rest-spread trong submit ([client-gift-card-sheet.tsx:219](../app/order-ui/src/components/app/gift-card/components/client-gift-card-sheet.tsx)) |
| `phone`         | `string` | optional (FE form) | Dùng hiển thị UI khi search recipient, không gửi BE                                                                                                                              |

#### Response: `IApiResponse<ICardOrderResponse>`

Sau success: navigate `/gift-card/checkout/:slug` (slug = `response.result.slug`).

---

### 1.5 `GET /card-order/:slug` — Lấy chi tiết order

**Hook**: `useGetCardOrder(slug, enable?)` ([use-gift-card.ts:258](../app/order-ui/src/hooks/use-gift-card.ts))
**Function**: `getCardOrder(slug)` ([gift-card.ts:92](../app/order-ui/src/api/gift-card.ts))

Gọi khi vào trang checkout. Polling cũng dùng endpoint này qua `useGiftCardPolling`.

#### Response: `IApiResponse<ICardOrderResponse>` ([card-order.type.ts:39](../app/order-ui/src/types/card-order.type.ts))

Fields quan trọng:

| Field                                              | Type                          | Dùng làm gì                                                          |
| -------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `slug`                                             | `string`                      | URL checkout                                                         |
| `code`                                             | `string`                      | Mã đơn hiển thị                                                      |
| `status`                                           | `string`                      | `PENDING \| COMPLETED \| CANCELLED \| FAILED \| EXPIRED`             |
| `paymentStatus`                                    | `string`                      | `pending \| completed \| cancelled`                                  |
| `paymentMethod`                                    | `string`                      | `bank-transfer \| cash`                                              |
| `totalAmount`                                      | `number`                      | Số tiền hiển thị cho user thanh toán                                 |
| `orderDate`                                        | `string` ISO                  | Tính countdown 15 phút                                               |
| `cardTitle`, `cardPrice`, `cardPoint`, `cardImage` | —                             | Info thẻ đã mua                                                      |
| `customerName`, `customerPhone`                    | `string`                      | Hiển thị info buyer                                                  |
| `receipients`                                      | `IReceiverGiftCardResponse[]` | Danh sách người nhận (GIFT)                                          |
| `giftCards`                                        | `IGiftCardDetail[]`           | Các thẻ sinh ra sau khi paid                                         |
| `payment`                                          | `IPaymentMenthod`             | Object payment: `qrCode`, `amount`, `transactionId`, `statusCode`... |

---

### 1.6 `POST /card-order/payment/initiate` — Kích hoạt thanh toán (client)

**Hook**: `useInitiateCardOrderPayment()` ([use-gift-card.ts:275](../app/order-ui/src/hooks/use-gift-card.ts))
**Function**: `initiateCardOrderPayment(slug, paymentMethod)` ([gift-card.ts:103](../app/order-ui/src/api/gift-card.ts))

> Hook tự route sang `/card-order/payment/initiate/admin` nếu user là staff. **Client CUSTOMER** luôn dùng endpoint này.

#### Request body

| Field           | Type     | Required     | Giá trị                                                               |
| --------------- | -------- | ------------ | --------------------------------------------------------------------- |
| `cardorderSlug` | `string` | **required** | slug của order                                                        |
| `paymentMethod` | `string` | **required** | **Chỉ** `"bank-transfer"` cho client (CASH không hỗ trợ cho CUSTOMER) |

Constraint: `CardOrderPaymentMethod` enum ([payment.ts:8](../app/order-ui/src/constants/payment.ts)) = `{ BANK_TRANSFER, CASH }`. Client-side chỉ `BANK_TRANSFER` hiển thị (CASH ẩn với role CUSTOMER trong `PaymentMethodSection`).

#### Response: `IApiResponse<ICardOrderResponse>`

Response bây giờ có `payment.qrCode` — FE render `<img src={qrCode} />`. User quét bằng app ngân hàng.

---

### 1.7 `POST /card-order/:slug/cancel` — Huỷ order

**Hook**: `useCancelCardOrder()` ([use-gift-card.ts:267](../app/order-ui/src/hooks/use-gift-card.ts))
**Function**: `cancelCardOrder(slug)` ([gift-card.ts:99](../app/order-ui/src/api/gift-card.ts))

#### Request: không body.

#### Response: `void`

Gọi từ `CancelCardOrderDialog`. Chỉ hiển thị khi `status === "PENDING"`. Sau success: polling ngắt, cart store restore thẻ cũ để user có thể tạo lại, navigate về catalog.

---

## 2. Polling trong lúc chờ thanh toán

**Hook**: `useGiftCardPolling` ([use-gift-card-polling.ts](../app/order-ui/src/hooks/use-gift-card-polling.ts))

- Gọi `getCardOrder(slug)` mỗi **15s** sau khi user bấm "Initiate Payment" (BANK_TRANSFER).
- Check `paymentStatus === "completed"` → fire `onPaymentSuccess` → navigate `/gift-card/confirmation`.
- Check `status === "EXPIRED"` hoặc countdown 15 phút hết → `setIsExpired(true)` → hiện `ExpiredState`.
- Stop polling khi: success, expired, cancelled, unmount.

Không có hook retry on network error — nếu request polling fail, khoảng tiếp theo vẫn thử lại.

---

## 3. Use cases (client)

### UC1 — Happy path: mua cho bản thân (SELF)

1. Login → mở `/gift-card` → chọn thẻ → `DraggableGiftCardButton` mở `ClientGiftCardSheet`.
2. Trong sheet: chọn `giftType = SELF`, tăng quantity (1–100).
3. Bấm **Thanh toán** → `POST /card-order` với:
   ```json
   {
     "customerSlug": "<user.slug>",
     "cardOrderType": "SELF",
     "cardSlug": "<card.slug>",
     "quantity": 3,
     "totalAmount": 300000,
     "receipients": [],
     "cardVersion": 1
   }
   ```
4. `onSuccess` → navigate `/gift-card/checkout/:slug`.
5. Checkout page → `GET /card-order/:slug` → hiển thị countdown + info.
6. Chọn BANK_TRANSFER → bấm Initiate → `POST /card-order/payment/initiate` body `{ cardorderSlug, paymentMethod: "bank-transfer" }`.
7. Hiện QR, polling chạy. User quét app ngân hàng → BE chuyển `paymentStatus = "completed"`.
8. Poll detect → navigate `/client/gift-card/confirmation`.
9. Thẻ xuất hiện trong `GET /gift-card?customerSlug=<user.slug>`.

### UC2 — Tặng cho nhiều người (GIFT)

1. Sheet → `giftType = GIFT` → tìm recipient qua phone (`recipient-search-input`) → thêm vào list.
2. Mỗi row: tên (read-only từ user search), `quantity`, `message`.
3. Schema refinement:
   - Số recipient ≥ 1.
   - `sum(recipients[].quantity) ≤ giftCardItem.quantity`.
4. Submit → `receipients` được strip bỏ `name`/`userInfo` trước khi gửi ([client-gift-card-sheet.tsx:219](../app/order-ui/src/components/app/gift-card/components/client-gift-card-sheet.tsx)):
   ```json
   {
     "customerSlug": "<buyer.slug>",
     "cardOrderType": "GIFT",
     "cardSlug": "<card.slug>",
     "quantity": 5,
     "totalAmount": 500000,
     "receipients": [
       {
         "recipientSlug": "user-abc123xy",
         "quantity": 2,
         "message": "Happy birthday"
       },
       { "recipientSlug": "user-def456zw", "quantity": 3, "message": "" }
     ],
     "cardVersion": 1
   }
   ```
5. Các bước sau giống UC1.

### UC3 — Chưa login mở sheet

- `userInfo?.slug` null → UI show toast "Please login" ([client-gift-card-sheet.tsx:197](../app/order-ui/src/components/app/gift-card/components/client-gift-card-sheet.tsx)) + disable submit.
- **Không gửi** `/card-order` khi `customerSlug` rỗng.

### UC4 — Thẻ đã đổi giá (version mismatch)

1. Store có `version=1`, BE hiện `version=2`.
2. `useSyncGiftCard` gọi `/card/:slug` → `synchronizeWithServer(newItem)` → store update giá mới + toast.
3. Nếu user vẫn submit với `cardVersion=1` → BE reject với code lỗi. FE `onError`:
   - Refetch lại `/card/:slug` qua `refetchGiftCard()` ([client-gift-card-sheet.tsx:248](../app/order-ui/src/components/app/gift-card/components/client-gift-card-sheet.tsx)).
   - Global MutationCache onError toast theo `statusCode` BE trả.

### UC5 — Số điện thoại recipient không tồn tại

- `recipient-search-input` không trả user nào → user không add được vào form.
- Schema `recipientSlug.min(10)` đảm bảo không truyền slug rỗng.

### UC6 — Quá tổng quantity

- Form schema refinement fail → hiện lỗi "Total receiver quantities cannot exceed the gift card quantity" ở field `receivers`.
- Không submit.

### UC7 — Huỷ order PENDING

1. Ở trang checkout, status = PENDING → `CancelCardOrderDialog` button hiện.
2. User confirm → `POST /card-order/:slug/cancel`.
3. Success → store `setGiftCardItem` phục hồi thẻ cũ, polling stop, navigate về catalog.

### UC8 — Order hết hạn (15 phút)

- Countdown `GiftCardCountdown` chạy trên UI.
- Hết 15 phút: `setIsExpired(true)` → render `ExpiredState` thay cho form.
- BE cũng set `status="EXPIRED"` → polling detect → UI confirm state.
- User phải tạo order mới (không reuse slug cũ).

### UC9 — Reload giữa lúc chờ QR

- Store Zustand persist `giftCardItem` (localStorage). Trang checkout không cần store — data từ URL slug + `GET /card-order/:slug`.
- Polling khởi động lại sau khi component mount.

### UC10 — Mở lại URL checkout sau khi COMPLETED

- `GET /card-order/:slug` trả `status="COMPLETED"`.
- Hiện tại UI không có guard redirect — nên fix: nếu `COMPLETED` → redirect `/gift-card/confirmation` hoặc catalog.

### UC11 — Đổi method sau khi đã sinh QR

- Không có action hoàn lại trong UI. Nếu user gọi initiate lần 2 với method khác → BE trả response mới (cần verify). FE hiện chỉ set QR lần đầu.

### UC12 — CASH từ phía client

- **Không dùng được**. `PaymentMethodSection` ẩn CASH với `role === CUSTOMER` ([payment-method-section.tsx](../app/order-ui/src/components/app/gift-card/checkout/components/payment-method-section.tsx)). Gửi body `paymentMethod="cash"` từ client sẽ bị ẩn trong UI.

---

## 4. Giới hạn / không hỗ trợ (client)

| Tính năng                    | Hỗ trợ?                                                         |
| ---------------------------- | --------------------------------------------------------------- |
| Voucher áp vào gift card     | ❌ không — `ICardOrderRequest` không có field voucher           |
| Promotion áp vào gift card   | ❌ không                                                        |
| Trừ điểm tích luỹ            | ❌ không                                                        |
| Thanh toán bằng Xu (POINT)   | ❌ không — `CardOrderPaymentMethod` chỉ có BANK_TRANSFER + CASH |
| Thẻ tín dụng (CREDIT_CARD)   | ❌ không                                                        |
| Cash                         | ❌ (chỉ staff)                                                  |
| Guest checkout (không login) | ❌ không — cần `customerSlug`                                   |
| Sửa order sau khi tạo        | ❌ không — chỉ cancel + tạo lại                                 |

---

## 5. Error handling

### Toast mapping

- Global `MutationCache.onError` đọc `axiosError.response?.data.statusCode` → `showErrorToast(code)` → map trong `errorCodes` ([toast.ts](../app/order-ui/src/utils/toast.ts)).
- BE trả code cụ thể thì hiện toast cụ thể; không có code → fallback `toast.requestFailed`.

### Các code đáng quan tâm cho gift card

BE cần trả các code rõ ràng; hiện chưa thấy gift-card specific trong `errorCodes`. Gợi ý ánh xạ:

- Card inactive
- Card version mismatch
- Recipient not found / not eligible
- Insufficient card stock
- Cashier slug required (admin path)

---

## 6. Reference file paths

| Chủ đề        | File                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API functions | [src/api/gift-card.ts](../app/order-ui/src/api/gift-card.ts)                                                                                                       |
| Hooks         | [src/hooks/use-gift-card.ts](../app/order-ui/src/hooks/use-gift-card.ts), [src/hooks/use-gift-card-polling.ts](../app/order-ui/src/hooks/use-gift-card-polling.ts) |
| Types         | [src/types/gift-card.type.ts](../app/order-ui/src/types/gift-card.type.ts), [src/types/card-order.type.ts](../app/order-ui/src/types/card-order.type.ts)           |
| Store         | [src/stores/gift-card.store.ts](../app/order-ui/src/stores/gift-card.store.ts)                                                                                     |
| Schema        | [src/schemas/gift-card.schema.ts](../app/order-ui/src/schemas/gift-card.schema.ts)                                                                                 |
| Client sheet  | [src/components/app/gift-card/components/client-gift-card-sheet.tsx](../app/order-ui/src/components/app/gift-card/components/client-gift-card-sheet.tsx)           |
| Checkout page | [src/components/app/gift-card/checkout/slug/page.tsx](../app/order-ui/src/components/app/gift-card/checkout/slug/page.tsx)                                         |
| Constants     | [src/constants/gift-card.ts](../app/order-ui/src/constants/gift-card.ts), [src/constants/payment.ts](../app/order-ui/src/constants/payment.ts)                     |
