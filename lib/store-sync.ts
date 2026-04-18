/**
 * Mediator pattern — phá vỡ circular dependency giữa cart, payment-method, update-order, order-flow.
 * Stores gọi requestClearStoresExcept() thay vì import trực tiếp nhau.
 */
export type StoreName = 'cart' | 'payment' | 'update-order' | 'order-flow'

type ClearCallbacks = {
  [K in StoreName]?: () => void
}

let callbacks: ClearCallbacks = {}

/**
 * Đăng ký callback clear cho từng store. Gọi tại bootstrap (lib/store-sync-setup.ts).
 */
export function initStoreSync(handlers: ClearCallbacks): void {
  callbacks = { ...handlers }
}

/**
 * Yêu cầu clear các store khác (trừ store hiện tại).
 * VD: cart gọi requestClearStoresExcept('cart') → clear payment + update-order.
 */
export function requestClearStoresExcept(exclude: StoreName): void {
  const toClear = (
    ['cart', 'payment', 'update-order', 'order-flow'] as const
  ).filter((name) => name !== exclude)
  for (const name of toClear) {
    callbacks[name]?.()
  }
}
