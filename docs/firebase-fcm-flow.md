# Firebase FCM Flow — Backend

## 1. Đăng ký / Hủy FCM Token

### Đăng ký token (FE gọi sau khi login)

**Endpoint:** `POST /notification/firebase/register-device-token`  
**Controller:** `notification.controller.ts:63-82` → `registerDeviceToken()`  
**Service:** `notification.service.ts:184-215` → `registerDeviceToken()`

**Logic:**
1. Kiểm tra token đã tồn tại trong `firebase_device_token_tbl` chưa
2. Nếu tồn tại → update `userId`, `platform`, `userAgent` (xử lý đổi tài khoản trên cùng thiết bị)
3. Nếu chưa → tạo mới record

**DTO request:**
```
token     (string, required)  — FCM token từ Firebase client SDK
platform  (enum: ios | android | web, required)
userAgent (string, optional)
```

> **Lưu ý:** `auth.service.ts` login() KHÔNG tự gọi register token. FE phải chủ động gọi endpoint này sau khi login thành công.

---

### Hủy token (FE gọi khi logout)

**Endpoint:** `DELETE /notification/firebase/unregister-device-token/:token`  
**Service:** `notification.service.ts:222-224` → `unregisterDeviceToken()`

```typescript
await this.firebaseDeviceTokenRepository.delete({ token });
```

Xóa theo **giá trị token**, không theo userId → logout một thiết bị không ảnh hưởng thiết bị khác. `auth.service.ts` không có logout() method, việc hủy token hoàn toàn do FE tự quản lý.

---

### Schema bảng `firebase_device_token_tbl`

| Column | Type | Ghi chú |
|--------|------|---------|
| `id_column` | UUID PK | |
| `token_column` | VARCHAR UNIQUE | FCM token |
| `platform_column` | VARCHAR | ios / android / web |
| `user_agent_column` | VARCHAR | optional |
| `user_id_column` | VARCHAR INDEX | user slug/id |
| `user_column` | UUID FK | → `user_tbl`, CASCADE DELETE |

---

## 2. Gửi Notification qua Firebase

### Khởi tạo Firebase Admin SDK

**File:** `notification/firebase/firebase.service.ts:26-47` → `onModuleInit()`

```typescript
admin.initializeApp({
  credential: admin.credential.cert({
    projectId:   FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey:  FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});
```

**Env vars cần có:** `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

---

### Flow từ trigger đến gửi FCM

```
1. EVENT TRIGGER
   ├─ Đơn hàng thanh toán xong  → notificationUtils.sendNotificationAfterOrderIsPaid()
   ├─ Đăng ký tài khoản mới     → emit CampaignAction.USER_CREATED
   ├─ Sinh nhật user             → emit CampaignAction.USER_BIRTHDAY_TRIGGERED
   └─ Thay đổi trạng thái đơn   → các notification util tương ứng

2. (Campaign path) CAMPAIGN LISTENER
   campaign.listener.ts → campaignService.triggerForUser()
   └─ Gọi notificationProducer.createNotification() hoặc bulkCreateNotification()

3. NOTIFICATION PRODUCER  —  notification.producer.ts:15-26
   └─ notificationQueue.add('create-notification', data)  ← BullMQ queue

4. NOTIFICATION CONSUMER (async)  —  notification.consumer.ts:16-22
   └─ notificationService.create(job.data)

5. NOTIFICATION SERVICE — create()  —  notification.service.ts:71-176
   ├─ Lưu notification vào notification_tbl (transaction)
   ├─ Query token theo receiverId:
   │  SELECT id, token, platform FROM firebase_device_token_tbl WHERE userId = ?
   ├─ Nếu không có token → log warning, return
   ├─ Build payload:
   │  data.payload = JSON.stringify({
   │    slug, type, message, senderId, receiverId,
   │    createdAt, sentAt, route, ...metadata
   │  })
   └─ Gọi firebaseService.sendToAllPlatforms(tokens, payload)

6. FIREBASE SERVICE — sendToAllPlatforms()  —  firebase.service.ts:55-147
   ├─ Build message riêng cho từng token với config theo platform (xem bên dưới)
   ├─ admin.messaging().sendEach(messages)
   ├─ Lấy danh sách token lỗi từ response
   ├─ Xóa token lỗi khỏi DB (token hết hạn / app bị uninstall)
   └─ Return { success, successCount, failureCount, failedTokens }

7. FIREBASE CLOUD MESSAGING (Google)
   ├─ iOS   → APNs
   ├─ Android → FCM
   └─ Web   → Web Push API
```

---

### Config theo platform

**Web** (`firebase.service.ts:78-88`)
```typescript
webpush: {
  notification: {
    icon: '/logo192.png',
    badge: '/badge.png',
    requireInteraction: false,
  },
  fcmOptions: { link: notification.link || '/' },
}
```

**Android** (`firebase.service.ts:90-99`)
```typescript
android: {
  priority: 'high',
  notification: {
    channelId: JSON.parse(data.payload).message,  // message code làm channel ID
  },
}
```

**iOS** (`firebase.service.ts:101-117`)
```typescript
apns: {
  payload: {
    aps: {
      // Đơn sẵn sàng lấy → ding.mp3, còn lại → default
      sound: message === ORDER_NEEDS_READY_TO_GET ? 'ding.mp3' : 'default',
      badge: 1,
      contentAvailable: true,
    },
  },
  fcmOptions: { imageUrl: data.imageUrl },
}
```

---

### Gửi đến token hay topic?

**Gửi đến individual tokens** (không dùng topics).  
Query token theo `receiverId` → `sendEach()` đến từng token.  
User nhiều thiết bị = tất cả thiết bị cùng nhận.

---

## 3. Các loại Notification

Định nghĩa tại `notification/notification.constants.ts`:

| Code | Mô tả | Gửi đến | iOS Sound |
|------|-------|---------|-----------|
| `ORDER_NEEDS_PROCESSED` | Đơn mới cần xử lý | Chef/Staff | default |
| `ORDER_NEEDS_DELIVERED` | Đơn cần giao | Staff | default |
| `ORDER_NEEDS_CANCELLED` | Đơn bị hủy | Staff | default |
| `ORDER_NEEDS_READY_TO_GET` | Đơn sẵn sàng lấy | Customer | **ding.mp3** |
| `ORDER_PAID` | Đơn đã thanh toán | Customer | default |
| `CARD_ORDER_PAID` | Đơn thẻ quà tặng đã TT | Customer | default |
| `VOUCHER_BIRTHDAY_RECEIVED` | Nhận voucher sinh nhật | Customer | default |
| `VOUCHER_NEW_USER_RECEIVED` | Nhận voucher tân thủ | Customer | default |
| `ORDER_BILL_FAILED_PRINTING` | In hóa đơn thất bại | Staff | default |
| `ORDER_CHEF_ORDER_FAILED_PRINTING` | In phiếu bếp thất bại | Staff | default |
| `ORDER_LABEL_TICKET_FAILED_PRINTING` | In nhãn thất bại | Staff | default |

---

## 4. Files quan trọng (BE)

| File | Vai trò |
|------|---------|
| `notification/firebase/firebase.service.ts` | Init SDK, `sendToAllPlatforms()`, `sendToDevice()` |
| `notification/firebase/firebase-device-token.entity.ts` | Entity bảng token |
| `notification/notification.service.ts` | `create()`, `registerDeviceToken()`, `unregisterDeviceToken()` |
| `notification/notification.controller.ts` | REST endpoints |
| `notification/notification.producer.ts` | Đẩy job vào BullMQ |
| `notification/notification.consumer.ts` | Xử lý job từ BullMQ |
| `notification/notification.constants.ts` | Enum type & message code |
| `notification/language/notification-language.service.ts` | Nội dung thông báo VI/EN |
| `campaign/campaign.listener.ts` | Lắng nghe event, trigger campaign notification |
