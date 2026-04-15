# VOUCHER LIST SHEET - LOGIC REVIEW CHECKLIST

## MỤC ĐÍCH
Component này cho phép người dùng xem danh sách voucher, tìm kiếm voucher bằng mã, chọn và áp dụng voucher vào đơn hàng.

---

## 1. KHỞI TẠO VÀ STATE MANAGEMENT

### ✅ Checklist:
- [ ] Component có đầy đủ các state cần thiết:
  - `sheetOpen`: điều khiển mở/đóng sheet
  - `localVoucherList`: danh sách voucher hiển thị (tích lũy từ nhiều trang)
  - `selectedVoucher`: mã voucher đang nhập trong input search
  - `tempSelectedVoucher`: voucher tạm thời được chọn (checkbox)
  - `currentPage`, `hasMore`, `isLoadingMore`: quản lý pagination
  - `isRemovingVoucherRef`: ref để tránh infinite loop khi remove voucher

- [ ] Component check `isHydrated` trước khi render, return null nếu chưa hydrated

---

## 2. XÁC ĐỊNH LOẠI USER VÀ TÍNH TOÁN DỮ LIỆU

### ✅ Checklist:
- [ ] Xác định `isCustomerOwner` đúng logic:
  - User phải tồn tại (`!!userInfo`)
  - Role phải là CUSTOMER
  - Phone number không phải 'default-customer'

- [ ] Tính `minOrderValue` đúng:
  - Tính tổng giá trị đơn hàng sau khi trừ promotion discount
  - Công thức: `(originalPrice - promotionDiscount) * quantity` cho mỗi item
  - Không tính gift items

- [ ] Lọc `nonGiftOrderItems` đúng:
  - Loại bỏ các item có flag `isGift = true`

- [ ] Tạo `voucherForOrderRequestParam` đúng:
  - Có `hasPaging: true`
  - Có `page` và `size` từ pagination
  - Có `user` slug nếu user đã đăng nhập
  - Có `paymentMethod` từ cartItems
  - Có `minOrderValue` đã tính
  - Có `orderItems` với đầy đủ thông tin: quantity, variant.slug, promotion.slug, order.slug

---

## 3. FETCH DỮ LIỆU VOUCHER

### ✅ Checklist:
- [ ] Fetch voucher list đúng theo loại user:
  - Nếu `isCustomerOwner = true`: dùng `useVouchersForOrder` (voucher private)
  - Nếu `isCustomerOwner = false`: dùng `usePublicVouchersForOrder` (voucher public)
  - Chỉ fetch khi `sheetOpen = true` (enabled condition)

- [ ] Fetch specific voucher khi user nhập mã:
  - Nếu user đã đăng nhập: dùng `useSpecificVoucher`
  - Nếu user chưa đăng nhập: dùng `useSpecificPublicVoucher`
  - Chỉ fetch khi `sheetOpen = true` và `selectedVoucher` có giá trị (trim length > 0)

- [ ] Không gọi API khi không cần thiết (enabled condition đúng)

---

## 4. TÍCH LŨY VOUCHER TỪ NHIỀU TRANG

### ✅ Checklist:
- [ ] Xác định đúng data source:
  - Nếu user là customer: dùng `voucherList?.result`
  - Nếu không: dùng `publicVoucherList?.result`

- [ ] Xử lý stale data đúng:
  - Nếu `currentData.page !== currentPage`:
    - Nếu `localVoucherList.length > 0`: bỏ qua (đang ở giữa pagination)
    - Nếu `localVoucherList.length === 0`: cho phép update (tránh cache ngăn hiển thị)

- [ ] Cập nhật `hasMore` và `isLoadingMore` từ API response

- [ ] Xử lý tích lũy đúng:
  - Nếu `currentPage === 1` hoặc `localVoucherList.length === 0`: **REPLACE** toàn bộ list
  - Nếu `currentPage > 1` và list đã có data: **APPEND** và loại bỏ duplicate theo slug

- [ ] Thêm specific voucher vào đầu list:
  - Nếu user đã đăng nhập và có `specificVoucher?.result`: thêm vào đầu (nếu chưa có)
  - Nếu user chưa đăng nhập và có `specificPublicVoucher?.result`: thêm vào đầu (nếu chưa có)
  - Không duplicate (check bằng slug)

---

## 5. RESET KHI MỞ SHEET

### ✅ Checklist:
- [ ] Khi `sheetOpen` chuyển từ `false` → `true`:
  - Reset `currentPage = 1`
  - Reset `hasMore = true`
  - Reset `isLoadingMore = false`
  - Reset `localVoucherList = []` (để lấy danh sách mới nhất)
  - **KHÔNG** invalidate hoặc refetch thủ công (React Query tự động refetch khi enabled thay đổi)

- [ ] Khi filters thay đổi (minOrderValue, nonGiftOrderItems, paymentMethod, isCustomerOwner):
  - Reset `currentPage = 1`
  - Reset `hasMore = true`
  - Reset `isLoadingMore = false`
  - **KHÔNG** clear list (để effect tích lũy tự xử lý khi data mới đến)

---

## 6. VALIDATION VOUCHER TỰ ĐỘNG

### ✅ Checklist:
- [ ] Khi `cartItems.orderItems` thay đổi, tự động check voucher hiện tại:
  - Nếu không có voucher hoặc không có orderItems: bỏ qua
  - Nếu `isRemovingVoucherRef.current = true`: bỏ qua (tránh infinite loop)

- [ ] Check applicability rule:
  - `ALL_REQUIRED`: Tất cả sản phẩm trong giỏ phải có trong voucher products
    - Nếu có sản phẩm không hợp lệ → `shouldRemove = true`
  - `AT_LEAST_ONE_REQUIRED`: Ít nhất 1 sản phẩm trong giỏ phải có trong voucher products
    - Nếu không có sản phẩm nào hợp lệ → `shouldRemove = true`

- [ ] Check `minOrderValue`:
  - Tính `subtotalBeforeVoucher` = tổng (originalPrice - promotionDiscount) * quantity
  - Nếu `voucher.type !== SAME_PRICE_PRODUCT`:
    - Nếu `subtotalBeforeVoucher < voucher.minOrderValue` → `shouldRemove = true`

- [ ] Check `maxItems`:
  - Tính `cartItemQuantity` = tổng quantity (không tính gift items)
  - Nếu `voucher.maxItems > 0` và `cartItemQuantity > voucher.maxItems` → `shouldRemove = true`

- [ ] Nếu `shouldRemove = true`:
  - Set `isRemovingVoucherRef.current = true`
  - Gọi `handleToggleVoucher(voucher)` để remove

---

## 7. XỬ LÝ CHỌN VOUCHER

### ✅ Checklist:
- [ ] Khi user click checkbox:
  - Nếu checked: set `tempSelectedVoucher = voucher.slug`
  - Nếu unchecked: set `tempSelectedVoucher = ''`
  - Checkbox bị disable nếu voucher không hợp lệ hoặc `remainingUsage === 0`

- [ ] Khi user click "Hoàn tất" (`handleCompleteSelection`):
  - Nếu `tempSelectedVoucher` rỗng:
    - Nếu có voucher đang áp dụng: remove voucher và show toast
    - Đóng sheet
    - Return
  
  - Nếu `tempSelectedVoucher` có giá trị:
    - Tìm voucher trong `localVoucherList` theo slug
    - Nếu không tìm thấy: show error toast và return
    - Nếu voucher được chọn giống voucher hiện tại: chỉ đóng sheet và return
    - Nếu voucher mới:
      - Tạo `validateVoucherParam` với đầy đủ thông tin
      - Nếu user đã đăng nhập: gọi `validateVoucher`
      - Nếu user chưa đăng nhập: gọi `validatePublicVoucher`
      - Khi validate thành công: add voucher, đóng sheet, show success toast

---

## 8. VALIDATION VÀ HIỂN THỊ VOUCHER

### ✅ Checklist:
- [ ] Function `isVoucherValid` check đầy đủ các điều kiện:
  - `isActive = true`
  - Chưa hết hạn: `endDate + 30 phút >= now` (grace period 30 phút)
  - Còn lượt sử dụng: `remainingUsage > 0`
  - Đạt minOrderValue: 
    - Nếu `type === SAME_PRICE_PRODUCT`: luôn true
    - Nếu không: `minOrderValue <= (subTotalBeforeDiscount - promotionDiscount)`
  - Sản phẩm hợp lệ:
    - Voucher phải có `voucherProducts` và không rỗng
    - Cart phải có `orderItems` và không rỗng
    - Check bằng `isVoucherApplicableToCartItems` với đúng `applicabilityRule`
  - Ngày hợp lệ: `endDate >= 7h sáng hôm nay`
  - Xác thực danh tính:
    - Nếu `isVerificationIdentity = true`: user phải đã đăng nhập
    - Nếu `isVerificationIdentity = false`: không cần check

- [ ] Function `getVoucherErrorMessage` trả về message đúng thứ tự ưu tiên:
  1. Cần xác thực danh tính nhưng user chưa đăng nhập
  2. Đã hết hạn (sau 30 phút grace period)
  3. Hết lượt sử dụng (remainingUsage = 0)
  4. Chưa đạt minOrderValue (trừ SAME_PRICE_PRODUCT)
  5. Không đáp ứng ALL_REQUIRED (tất cả sản phẩm phải trong voucher)
  6. Không đáp ứng AT_LEAST_ONE_REQUIRED (ít nhất 1 sản phẩm phải trong voucher)

---

## 9. LOAD MORE PAGINATION

### ✅ Checklist:
- [ ] Function `handleLoadMore`:
  - Check điều kiện: `!isLoadingMore && hasMore && sheetOpen`
  - Nếu đúng: set `isLoadingMore = true` và tăng `currentPage`
  - React Query tự động fetch trang mới khi `currentPage` thay đổi
  - Effect tích lũy sẽ append data mới vào list

- [ ] Hiển thị nút "Load More":
  - Chỉ hiển thị khi `hasMore = true` và `localVoucherList.length > 0`
  - Disable khi `isLoadingMore = true`
  - Show text "Đang tải..." khi loading

---

## 10. XỬ LÝ SPECIFIC VOUCHER (TÌM KIẾM)

### ✅ Checklist:
- [ ] Khi user nhập mã vào input:
  - Update `selectedVoucher` state
  - Trigger fetch specific voucher (nếu enabled)

- [ ] Khi có `specificVoucher` hoặc `specificPublicVoucher`:
  - Nếu voucher là private và user đã đăng nhập: refetch specific voucher
  - Nếu voucher là public và user chưa đăng nhập: refetch specific public voucher
  - Thêm voucher vào đầu `localVoucherList` (nếu chưa có)

- [ ] Khi có voucher trong cart:
  - Set `selectedVoucher = voucher.code`
  - Set `tempSelectedVoucher = voucher.slug`
  - Nếu voucher là private: refetch specific voucher

---

## 11. RENDER UI

### ✅ Checklist:
- [ ] Sắp xếp voucher đúng:
  - Voucher hợp lệ (`isVoucherValid = true`) hiển thị trước
  - Voucher không hợp lệ hiển thị sau (có label "Voucher không khả dụng")

- [ ] Mỗi voucher card hiển thị:
  - Title, minOrderValue
  - Error message (nếu có)
  - Remaining usage percentage và progress bar
  - Checkbox (disabled nếu không hợp lệ hoặc hết lượt)
  - Badge thời gian hết hạn
  - Tooltip/Popover điều kiện (desktop/mobile)

- [ ] Voucher card có styling đúng:
  - Highlight nếu đang được chọn
  - Opacity giảm nếu hết lượt hoặc không hợp lệ
  - Overlay mờ cho voucher không hợp lệ

---

## 12. EDGE CASES VÀ BUGS TIỀM ẨN

### ⚠️ Cần kiểm tra:

- [ ] **Race condition**: Khi user nhập mã nhanh, có thể có nhiều API calls. Cần debounce?
- [ ] **Stale data**: Logic xử lý stale data có đúng không? Có thể bỏ sót data mới?
- [ ] **Duplicate vouchers**: Logic loại bỏ duplicate có đúng không? Có thể có duplicate?
- [ ] **Infinite loop**: `isRemovingVoucherRef` có đủ để tránh infinite loop không?
- [ ] **Memory leak**: `localVoucherList` có thể tích lũy quá nhiều không? Có cần limit?
- [ ] **Validation timing**: Validation tự động có chạy đúng lúc không? Có thể miss validation?
- [ ] **User login/logout**: Khi user login/logout, voucher list có update đúng không?
- [ ] **Cart changes**: Khi cart thay đổi (thêm/xóa item, thay đổi payment method), voucher list có refetch đúng không?
- [ ] **Specific voucher not found**: Khi nhập mã không tồn tại, có xử lý đúng không?
- [ ] **Network error**: Khi API fail, có xử lý error đúng không?

---

## 13. PERFORMANCE

### ✅ Checklist:
- [ ] Sử dụng `useMemo` cho các tính toán nặng:
  - `minOrderValue`
  - `nonGiftOrderItems`
  - `voucherForOrderRequestParam`

- [ ] Sử dụng `useCallback` cho các function được pass vào dependency:
  - `handleToggleVoucher`
  - `handleLoadMore`
  - `isVoucherSelected`

- [ ] React Query caching:
  - Sử dụng `placeholderData: keepPreviousData` để tránh flash loading
  - Query key đúng để cache và invalidate đúng

---

## 14. LOGIC CONFLICTS VÀ INCONSISTENCIES

### ⚠️ Cần review:

1. **Effect 258-262**: Refetch khi `specificVoucher?.result?.isPrivate` - Logic này có cần thiết không? Có thể gây infinite loop?

2. **Effect 265-277**: Refetch khi user login/logout - Logic này có đúng không? Có thể conflict với effect khác?

3. **Effect 280-297**: Thêm specific voucher vào list - Logic này có conflict với effect tích lũy (300-363) không?

4. **Effect 399-411**: Sync voucher từ cart - Logic này có conflict với các effect khác không?

5. **Validation logic**: 
   - `isVoucherValid` check `hasValidProducts` yêu cầu voucher phải có `voucherProducts`
   - Nhưng trong auto-validation (196-254), chỉ check khi có `voucherProducts`
   - Có inconsistency không?

6. **Date validation**:
   - `isVoucherValid` check `endDate >= 7h sáng hôm nay`
   - Nhưng `getVoucherErrorMessage` check `endDate + 30 phút < now`
   - Có inconsistency không?

---

## 15. TESTING SCENARIOS

### ✅ Cần test các trường hợp:

1. **Mở sheet lần đầu**: List có load đúng không?
2. **Nhập mã voucher**: Voucher có được thêm vào list không?
3. **Chọn voucher**: Checkbox có update đúng không?
4. **Click "Hoàn tất"**: Voucher có được áp dụng đúng không?
5. **Load more**: Trang tiếp theo có load đúng không?
6. **Thay đổi cart**: Voucher có bị remove tự động không?
7. **User login/logout**: Voucher list có update đúng không?
8. **Network error**: Error có được xử lý đúng không?
9. **Voucher hết hạn**: Voucher có bị disable đúng không?
10. **Voucher hết lượt**: Voucher có bị disable đúng không?
11. **Voucher cần xác thực**: Voucher có yêu cầu login đúng không?
12. **Voucher không đạt minOrderValue**: Voucher có bị disable đúng không?
13. **Voucher không match products**: Voucher có bị disable đúng không?
14. **Duplicate vouchers**: Voucher có bị duplicate không?
15. **Stale data**: Data có được update đúng không?

---

## KẾT LUẬN

Sau khi review checklist này, cần đảm bảo:
- ✅ Tất cả logic đều có mục đích rõ ràng
- ✅ Không có logic conflict hoặc duplicate
- ✅ Edge cases đều được xử lý
- ✅ Performance được tối ưu
- ✅ Code dễ maintain và debug

