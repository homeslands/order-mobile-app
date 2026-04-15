export const ROUTE = {
  // ===== Auth =====
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  FORGOT_PASSWORD: '/auth/forgot-password',

  // ===== Client =====
  CLIENT_HOME: '/',
  CLIENT_BOOKING: '/booking',
  CLIENT_NEWS: '/news',
  CLIENT_NEWS_DETAIL: '/news/[slug]',
  CLIENT_MENU: '/menu',
  CLIENT_MENU_ITEM: '/menu-item',
  CLIENT_MENU_ITEM_DETAIL: '/menu/[slug]',
  /** Product detail — trong tab Menu, push trong menu stack */
  CLIENT_PRODUCT_DETAIL: '/(tabs)/menu/product/[id]',
  CLIENT_CART: '/cart',
  CLIENT_CHECKOUT_ORDER: '/checkout-order',
  CLIENT_ORDER_DETAIL: '/order/[id]',
  CLIENT_PAYMENT: '/payment/[order]',
  CLIENT_UPDATE_ORDER: '/update-order/[slug]',
  CLIENT_ORDER_HISTORY: '/history',

  CLIENT_PROFILE: '/profile',
  CLIENT_PROFILE_INFO: '/profile/info',
  CLIENT_PROFILE_EDIT: '/profile/edit',
  CLIENT_PROFILE_VERIFY_EMAIL: '/profile/verify-email',
  CLIENT_PROFILE_VERIFY_PHONE_NUMBER: '/profile/verify-phone-number',
  CLIENT_PROFILE_CHANGE_PASSWORD: '/profile/change-password',
  CLIENT_PROFILE_HISTORY: '/profile/history',
  CLIENT_PROFILE_LOYALTY_POINT: '/profile/loyalty-point',
  CLIENT_PROFILE_COIN: '/profile/coin',
  CLIENT_PROFILE_GIFT_CARD: '/profile/gift-card',

  CLIENT_GIFT_CARD: '/gift-card',
  CLIENT_GIFT_CARD_CHECKOUT: '/gift-card/checkout',
  CLIENT_GIFT_CARD_CHECKOUT_WITH_SLUG: '/gift-card/checkout/[slug]',

  // ===== System / Staff =====
  SYSTEM_OVERVIEW: '/system/overview',
  SYSTEM_MENU: '/system/menu',
  SYSTEM_PAYMENT: '/system/payment/[order]',
  SYSTEM_ORDER_MANAGEMENT: '/system/order-management',
  SYSTEM_TABLE: '/system/table',
  SYSTEM_PRODUCT: '/system/product',

  // ===== General =====
  ABOUT: '/about',
  CONTACT: '/contact',
  NEWS_DETAIL: '/news/[slug]',
  HELP: '/help',
  POLICY: '/policy',
  SECURITY: '/security',
} as const
