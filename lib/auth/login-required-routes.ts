// Screens that cannot be used as a guest. Payment / order / update-order are
// guest-capable (app/payment/[order].tsx) so they are intentionally absent.
export const LOGIN_REQUIRED_ROUTES: readonly string[] = [
  '/profile/history',
  '/profile/coin-hub',
  '/profile/gift-card-hub',
  '/profile/gift-card-orders',
  '/profile/gift-cards',
  '/profile/loyalty-point',
  '/profile/loyalty-point-hub',
  '/profile/edit',
  '/profile/info',
  '/profile/general-info',
  '/profile/change-password',
  '/profile/verify-email',
  '/profile/verify-phone-number',
  '/notification',
  '/gift-card/checkout',
]

export function isLoginRequiredRoute(pathname: string): boolean {
  return LOGIN_REQUIRED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  )
}
