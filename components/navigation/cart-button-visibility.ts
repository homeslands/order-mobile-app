/**
 * Luật ẩn nút giỏ hàng nổi theo route.
 *
 * Tách khỏi component để test được — thanh tab gốc là view của hệ điều hành
 * nên phần còn lại của layout không dựng được trong Jest.
 *
 * Dùng khớp theo đoạn đường dẫn, không dùng `includes`: `/cartography`
 * có chứa chuỗi "cart" nhưng không phải route giỏ hàng, từng làm ẩn nhầm nút.
 *
 * `/profile` (trang Tài khoản chính, một trong bốn tab) chỉ hiện nút khi đã
 * đăng nhập — chưa đăng nhập thì `/profile` đang hiện form đăng nhập, không
 * phải trang Tài khoản, nên vẫn ẩn (khôi phục đúng hành vi gốc trước khi
 * migrate sang thanh tab gốc, xem `isProfileLoginForm`/`isProfileSubRoute` ở
 * lịch sử git). Route con của `/profile` (`/profile/<đoạn con>`) luôn ẩn,
 * không phụ thuộc trạng thái đăng nhập.
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
  isAuthenticated: boolean,
): boolean {
  if (!pathname) return false

  // Chuẩn hoá dấu `/` ở cuối để `/profile/` xử như `/profile`.
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname

  const isProfilePath =
    normalized === '/profile' || normalized.startsWith('/profile/')
  if (isProfilePath) {
    return !isAuthenticated || normalized !== '/profile'
  }

  return HIDDEN_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}
