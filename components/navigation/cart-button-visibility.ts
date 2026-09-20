/**
 * Luật ẩn nút giỏ hàng nổi theo route.
 *
 * Tách khỏi component để test được — thanh tab gốc là view của hệ điều hành
 * nên phần còn lại của layout không dựng được trong Jest.
 *
 * Dùng khớp theo đoạn đường dẫn, không dùng `includes`: `/profile/gift-card-orders`
 * có chứa chuỗi "cart" trong "gift-card-orders" và từng làm ẩn nhầm nút.
 *
 * `/profile` (trang Tài khoản chính, một trong bốn tab) vẫn hiện nút; chỉ các
 * route con của nó (`/profile/<đoạn con>`) mới ẩn — khác với các prefix dưới
 * đây vốn ẩn cả ở chính route gốc.
 */
const HIDDEN_PREFIXES = [
  '/cart',
  '/product',
  '/payment',
  '/update-order',
  '/auth',
  '/notification',
  '/system',
] as const

export function shouldHideCartButton(
  pathname: string | null | undefined,
): boolean {
  if (!pathname) return false
  if (pathname.startsWith('/profile/')) return true
  return HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}
