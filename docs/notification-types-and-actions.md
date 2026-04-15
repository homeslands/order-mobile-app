# Các kiểu thông báo ứng với các Action trong hệ thống

---

## 1. Tổng hợp nhanh

| # | Message Code | Action trigger | Người nhận | Tiêu đề (VI) |
|---|-------------|----------------|------------|---------------|
| 1 | `order-needs-processed` | Đơn hàng được thanh toán | Tất cả **Chef** trong branch | Đơn hàng cần xử lý |
| 2 | `order-needs-delivered` | Chef xử lý xong món | Tất cả **Staff** trong branch | Đơn hàng cần giao |
| 3 | `order-needs-ready-to-get` | Staff gọi khách lấy đơn | **Khách hàng** (owner đơn hàng) | Đơn hàng sẵn sàng |
| 4 | `order-bill-failed-printing` | In hóa đơn thất bại (sau 3 lần retry) | Tất cả **Staff + Chef + Manager** trong branch | In hóa đơn lỗi |
| 5 | `order-chef-order-failed-printing` | In chef order thất bại (sau 3 lần retry) | Tất cả **Staff + Chef + Manager** trong branch | In đơn hàng nhà bếp lỗi |
| 6 | `order-label-ticket-failed-printing` | In nhãn dán thất bại (sau 3 lần retry) | Tất cả **Staff + Chef + Manager** trong branch | In nhãn dán lỗi |
| 7 | `order-needs-cancelled` | _(Đã khai báo nhưng chưa được sử dụng)_ | — | — |

---

## 2. Chi tiết từng loại thông báo

### 2.1. `ORDER_NEEDS_PROCESSED` — Đơn hàng cần xử lý

| Thuộc tính | Chi tiết |
|------------|----------|
| **Khi nào** | Đơn hàng được thanh toán thành công (status: `PENDING` → `PAID`) |
| **Người nhận** | Tất cả user có role `Chef` trong cùng branch |
| **Tiêu đề (VI)** | "Đơn hàng cần xử lý" |
| **Nội dung (VI)** | "Đơn hàng #{{referenceNumber}} cần xử lý. Vui lòng xử lý sớm!" |
| **Tiêu đề (EN)** | "Order needs processed" |
| **Nội dung (EN)** | "Order #{{referenceNumber}} needs to be processed. Please process it quickly!" |
| **Link điều hướng** | Trang chef order |

**Flow trigger:**

```
[Payment completed]
     │
     ▼
[Event: PaymentAction.PAYMENT_PAID]
     │
     ▼
[OrderListener → Job: UPDATE_STATUS_ORDER_AFTER_PAID]
     │
     ▼
[JobService.updateOrderStatusAfterPaymentPaid()]
     │  - Update order.status → PAID
     │  - Tạo referenceNumber
     │  - Tạo invoice
     │  - Tạo chef orders
     │
     ▼
[notificationUtils.sendNotificationAfterOrderIsPaid(order)]
     │
     ▼
[Tìm tất cả Chef trong branch → Gửi thông báo cho từng người]
```

---

### 2.2. `ORDER_NEEDS_DELIVERED` — Đơn hàng cần giao

| Thuộc tính | Chi tiết |
|------------|----------|
| **Khi nào** | Chef cập nhật trạng thái chef order item (đã xử lý xong món) |
| **Người nhận** | Tất cả user có role `Staff` trong cùng branch |
| **Tiêu đề (VI)** | "Đơn hàng cần giao" |
| **Nội dung (VI)** | "Đơn hàng #{{referenceNumber}} cần giao. Vui lòng giao hàng sớm!" |
| **Tiêu đề (EN)** | "Order needs delivered" |
| **Nội dung (EN)** | "Order #{{referenceNumber}} needs to be delivered. Please deliver it quickly!" |
| **Link điều hướng** | Trang order management |

**Flow trigger:**

```
[Chef cập nhật trạng thái món ăn (trong ACCEPTED state)]
     │
     ▼
[ChefOrderItemService.update()]
     │
     ▼
[notificationUtils.sendNotificationAfterOrderIsProcessed(order)]
     │
     ▼
[Tìm tất cả Staff trong branch → Gửi thông báo cho từng người]
```

---

### 2.3. `ORDER_NEEDS_READY_TO_GET` — Đơn hàng sẵn sàng lấy

| Thuộc tính | Chi tiết |
|------------|----------|
| **Khi nào** | Staff bấm nút gọi khách lấy đơn (`callCustomerToGetOrder`) |
| **Người nhận** | **Khách hàng** (owner của đơn hàng) — phải là customer hợp lệ |
| **Tiêu đề (VI)** | "Đơn hàng sẵn sàng" |
| **Nội dung (VI)** | "Đơn hàng #{{referenceNumber}} đã sẵn sàng. Vui lòng tới quầy để nhận!" |
| **Tiêu đề (EN)** | "Order needs ready to get" |
| **Nội dung (EN)** | "Order #{{referenceNumber}} is ready to get. Please get it quickly!" |
| **Link điều hướng** | `/history?order={order.slug}` |

**Flow trigger:**

```
[Staff bấm "Gọi khách lấy đơn"]
     │
     ▼
[OrderService.callCustomerToGetOrder(staffId, orderSlug)]
     │
     ▼
[Validate: customer phải là defined customer (không phải default)]
     │
     ▼
[notificationUtils.sendNotificationForCustomerToGetOrder(staffId, order)]
     │
     ▼
[Gửi thông báo cho customer (owner của đơn hàng)]
```

**Đặc biệt:**
- Có thông tin `senderId` (staff gọi khách)
- Nội dung theo ngôn ngữ của khách hàng
- Chỉ gửi nếu customer là user thực (không phải `default-customer`)

---

### 2.4. `ORDER_BILL_FAILED_PRINTING` — In hóa đơn thất bại

| Thuộc tính | Chi tiết |
|------------|----------|
| **Khi nào** | In hóa đơn (INVOICE) thất bại **sau 3 lần retry** hoặc lock hết hạn |
| **Người nhận** | Tất cả user có role `Staff`, `Chef`, hoặc `Manager` trong cùng branch |
| **Tiêu đề (VI)** | "In hóa đơn lỗi" |
| **Nội dung (VI)** | "Hóa đơn #{{referenceNumber}} in lỗi. Vui lòng in lại thủ công!" |
| **Tiêu đề (EN)** | "Order bill failed printing" |
| **Nội dung (EN)** | "Order #{{referenceNumber}} bill failed to print. Please print manually!" |
| **Link điều hướng** | `/system/order-management?order={order.slug}` |

**Flow trigger:**

```
[Invoice được tạo]
     │
     ▼
[InvoiceListener.handleInvoiceCreated()]
     │
     ▼
[Tạo printer job (type: INVOICE) trong database]
     │
     ▼
[PrinterWorker.handlePrintJob() — poll mỗi 2 giây]
     │
     ▼
[Thử in — thất bại]
     │
     ▼
[Retry lần 1 → thất bại → Retry lần 2 → thất bại → Retry lần 3 → thất bại]
     │
     ▼
[printerEventUtils.sendPrinterEventForAllBranchStaffsWhenFailedBillPrinting()]
     │
     ▼
[Tạo PrinterEvent entity + Gửi FCM cho Staff/Chef/Manager]
```

---

### 2.5. `ORDER_CHEF_ORDER_FAILED_PRINTING` — In chef order thất bại

| Thuộc tính | Chi tiết |
|------------|----------|
| **Khi nào** | In chef order thất bại **sau 3 lần retry** hoặc lock hết hạn |
| **Người nhận** | Tất cả user có role `Staff`, `Chef`, hoặc `Manager` trong cùng branch |
| **Tiêu đề (VI)** | "In đơn hàng nhà bếp lỗi" |
| **Nội dung (VI)** | "Đơn hàng #{{referenceNumber}} in lỗi. Vui lòng in lại thủ công!" |
| **Tiêu đề (EN)** | "Order chef order failed printing" |
| **Nội dung (EN)** | "Order #{{referenceNumber}} chef order failed to print. Please print manually!" |
| **Link điều hướng** | `/system/chef-order` |

**Flow trigger:**

```
[Đơn thanh toán → Chef orders được tạo]
     │
     ▼
[Tạo printer job (type: CHEF_ORDER)]
     │
     ▼
[PrinterWorker xử lý → 3 lần retry thất bại]
     │
     ▼
[printerEventUtils.sendPrinterEventForAllBranchStaffsWhenFailedChefOrderPrinting()]
     │
     ▼
[Tạo PrinterEvent entity + Gửi FCM]
```

---

### 2.6. `ORDER_LABEL_TICKET_FAILED_PRINTING` — In nhãn dán thất bại

| Thuộc tính | Chi tiết |
|------------|----------|
| **Khi nào** | In label ticket thất bại **sau 3 lần retry** hoặc lock hết hạn |
| **Người nhận** | Tất cả user có role `Staff`, `Chef`, hoặc `Manager` trong cùng branch |
| **Tiêu đề (VI)** | "In nhãn dán lỗi" |
| **Nội dung (VI)** | "Nhãn dán cho đơn hàng #{{referenceNumber}} in lỗi. Vui lòng in lại thủ công!" |
| **Tiêu đề (EN)** | "Order label ticket failed printing" |
| **Nội dung (EN)** | "Order #{{referenceNumber}} label ticket failed to print. Please print manually!" |
| **Link điều hướng** | `/system/chef-order` |

**Flow trigger:**

```
[Chef orders tạo → label ticket cho từng item]
     │
     ▼
[Tạo printer job (type: LABEL_TICKET)]
     │
     ▼
[PrinterWorker xử lý → 3 lần retry thất bại]
     │
     ▼
[printerEventUtils.sendPrinterEventForAllBranchStaffsWhenFailedLabelTicketPrinting()]
     │
     ▼
[Tạo PrinterEvent entity + Gửi FCM]
```

---

### 2.7. `ORDER_NEEDS_CANCELLED` — Đơn hàng bị hủy

| Thuộc tính | Chi tiết |
|------------|----------|
| **Trạng thái** | **Đã khai báo trong constants nhưng CHƯA ĐƯỢC SỬ DỤNG** |
| **Nơi khai báo** | `notification.constants.ts` (cả backend và frontend) |
| **Trigger** | Không có code nào gọi gửi thông báo với message code này |

---

## 3. Phân loại theo người nhận

### Chef nhận

| Message Code | Từ action |
|-------------|-----------|
| `order-needs-processed` | Đơn hàng thanh toán thành công |
| `order-bill-failed-printing` | In hóa đơn thất bại |
| `order-chef-order-failed-printing` | In chef order thất bại |
| `order-label-ticket-failed-printing` | In nhãn dán thất bại |

### Staff nhận

| Message Code | Từ action |
|-------------|-----------|
| `order-needs-delivered` | Chef xử lý xong món |
| `order-bill-failed-printing` | In hóa đơn thất bại |
| `order-chef-order-failed-printing` | In chef order thất bại |
| `order-label-ticket-failed-printing` | In nhãn dán thất bại |

### Manager nhận

| Message Code | Từ action |
|-------------|-----------|
| `order-bill-failed-printing` | In hóa đơn thất bại |
| `order-chef-order-failed-printing` | In chef order thất bại |
| `order-label-ticket-failed-printing` | In nhãn dán thất bại |

### Customer (Khách hàng) nhận

| Message Code | Từ action |
|-------------|-----------|
| `order-needs-ready-to-get` | Staff gọi khách lấy đơn |

---

## 4. Phân loại theo hệ thống xử lý

| Hệ thống | Message Codes | Entity lưu trữ |
|-----------|--------------|-----------------|
| **Notification** (đơn hàng) | `order-needs-processed`, `order-needs-delivered`, `order-needs-ready-to-get`, `order-needs-cancelled` | `Notification` entity |
| **PrinterEvent** (lỗi in) | `order-bill-failed-printing`, `order-chef-order-failed-printing`, `order-label-ticket-failed-printing` | `PrinterEvent` entity |

**Khác biệt:**
- **Notification**: Dùng BullMQ queue (Producer → Consumer), lưu vào bảng `notification`
- **PrinterEvent**: Gọi trực tiếp từ PrinterWorker, lưu vào bảng `printer_event`, có track retry count (SUCCESS/FAILED)

---

## 5. Metadata đính kèm mỗi thông báo

Mỗi thông báo (cả Notification và PrinterEvent) đều chứa metadata:

```ts
{
  order: string,            // order.slug
  orderType: string,        // order.type (dine-in, take-away, etc.)
  tableName: string,        // Tên bàn (nếu có)
  table: string,            // table.slug
  branchName: string,       // Tên chi nhánh
  branch: string,           // branch.slug
  referenceNumber: string,  // Mã đơn hàng hiển thị (#123)
  createdAt: string,        // Thời gian tạo
}
```

---

## 6. Sơ đồ flow theo vòng đời đơn hàng

```
[Khách đặt + thanh toán]
     │
     ▼
━━━ ORDER_NEEDS_PROCESSED ━━━━━━━━━━━━━━━━━━━━━
     → Gửi cho: Tất cả Chef trong branch
     → "Đơn hàng #123 cần xử lý"
     │
     ▼
[Chef xử lý xong món]
     │
     ▼
━━━ ORDER_NEEDS_DELIVERED ━━━━━━━━━━━━━━━━━━━━━
     → Gửi cho: Tất cả Staff trong branch
     → "Đơn hàng #123 cần giao"
     │
     ▼
[Staff gọi khách lấy đơn]
     │
     ▼
━━━ ORDER_NEEDS_READY_TO_GET ━━━━━━━━━━━━━━━━━━
     → Gửi cho: Khách hàng (owner)
     → "Đơn hàng #123 đã sẵn sàng. Vui lòng tới quầy!"


═══ Song song: Printing flow ═══════════════════

[In hóa đơn thất bại (3 retry)]
     → ORDER_BILL_FAILED_PRINTING
     → Gửi cho: Staff + Chef + Manager

[In chef order thất bại (3 retry)]
     → ORDER_CHEF_ORDER_FAILED_PRINTING
     → Gửi cho: Staff + Chef + Manager

[In nhãn dán thất bại (3 retry)]
     → ORDER_LABEL_TICKET_FAILED_PRINTING
     → Gửi cho: Staff + Chef + Manager
```

---

## 7. Xử lý đặc biệt trên Frontend

| Message Code | Xử lý đặc biệt |
|-------------|-----------------|
| `order-needs-processed` | **Không phát âm thanh** (tránh spam khi nhiều đơn cùng lúc) |
| `order-bill-failed-printing` | Phát sound volume **0.8** (cao hơn bình thường), refetch printer events, hiện dialog lỗi in |
| `order-chef-order-failed-printing` | Phát sound volume **0.8**, refetch printer events, hiện dialog lỗi in |
| `order-label-ticket-failed-printing` | Phát sound volume **0.8**, refetch printer events, hiện dialog lỗi in |
| Các loại khác | Phát sound volume **0.5**, hiện toast notification 6 giây |
