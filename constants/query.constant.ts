/**
 * staleTime cho feature flags khoá loại đơn (ORDER group).
 *
 * Phải dùng CHUNG cho cả chỗ prefetch (cart-content) lẫn chỗ đọc
 * (cart-footer.openConfirmSheet) — trước đây cả hai để 5s nên prefetch lúc mount
 * giỏ đã stale trước khi user kịp bấm "Đặt hàng" → nút phải chờ network mới mở
 * được sheet. 60s để prefetch thật sự có tác dụng.
 *
 * Đánh đổi: BE khoá một loại đơn thì app có thể còn cho chọn tối đa 60s — BE
 * vẫn chặn ở bước tạo đơn nên đây chỉ là sai lệch hiển thị tạm thời.
 */
export const ORDER_FEATURE_FLAGS_STALE_MS = 60_000

export const QUERYKEY = {
  profile: ['profile'],
  branches: ['branches'],
  catalog: ['catalog'],
  chefAreaPrinters: ['chefAreaPrinters'],
  productVariants: ['productVariants'],
  products: ['products'],
  specificProduct: ['specificProduct'],
  giftCards: ['giftCards'],
  cardOrder: ['cardOrder'],
  vouchers: ['vouchers'],
  specificVoucher: ['specificVoucher'],
  voucherGroups: ['voucherGroups'],
  vouchersForOrder: ['vouchersForOrder'],
  publicVouchersForOrder: ['publicVouchersForOrder'],
  promotions: ['promotions'],
  banners: ['banners'],
  tables: ['tables'],
  roles: ['roles'],
  chefAreas: ['chefAreas'],
  chefOrders: ['chefOrders'],
  chefAreaProducts: ['chefAreaProducts'],
  notifications: ['notifications'],
  revenue: ['revenue'],
  userGiftCards: ['userGiftCards'],
  giftCardDetail: ['giftCardDetail'],
  loyaltyPoints: ['loyaltyPoints'],
  systemFeatureFlagsByGroup: ['systemFeatureFlagsByGroup'],
  systemFeatureFlagGroups: ['systemFeatureFlagGroups'],
  address: ['address'],
  addressSuggestions: ['addressSuggestions'],
  addressByPlaceId: ['addressByPlaceId'],
  addressDirection: ['addressDirection'],
  distanceAndDuration: ['distanceAndDuration'],
  userGroups: ['userGroups'],
  userGroup: ['userGroup'],
  userGroupMembers: ['userGroupMembers'],
  userGroupMember: ['userGroupMember'],
  printerEvents: ['printerEvents'],
  giftCardFeatureFlags: ['giftCardFeatureFlags'],
  pointTransactions: ['pointTransactions'],
}
