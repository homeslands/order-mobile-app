/**
 * Hàm thuần kiểm tra thanh tab có nên dùng dáng "ô tròn tách rời" iOS 26
 * (role="search") hay không. Tách khỏi Platform để test được với các chuỗi
 * phiên bản cụ thể mà không cần mock react-native.
 *
 * Nhánh an toàn LUÔN là `false` (tab thường): nếu rơi nhầm sang
 * role="search" trên máy chạy iOS thấp hơn 26, người dùng sẽ thấy icon giỏ
 * hàng kèm chữ "Tìm kiếm" do hệ thống tự gán, thay vì "Giỏ hàng" — xem chú
 * thích chi tiết tại nơi gọi trong app/(tabs)/_layout.tsx.
 */
export function supportsDetachedSearchTab(
  os: string,
  version: string | number,
): boolean {
  if (os !== 'ios') return false
  const major = parseInt(String(version), 10)
  return Number.isFinite(major) && major >= 26
}
