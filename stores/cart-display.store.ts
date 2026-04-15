/**
 * Cart Display Store — Tách display state ra khỏi order-flow.
 *
 * Mục đích: Giảm cascade re-render khi orderItems thay đổi.
 * - CartFooter chỉ subscribe rawSubTotal + cartTotals → không re-render vì là child của CartContentFull
 * - displayItems dùng cho CartList khi cần
 */
import type { IDisplayCartItem } from '@/types'
import { create } from 'zustand'

export type CartTotals = {
  subTotalBeforeDiscount: number
  promotionDiscount: number
  voucherDiscount: number
  finalTotal: number
}

type CartDisplayStore = {
  rawSubTotal: number
  cartTotals: CartTotals | null
  displayItems: IDisplayCartItem[] | null

  setRawSubTotal: (value: number) => void
  setCartDisplay: (items: IDisplayCartItem[], totals: CartTotals) => void
  clearDisplay: () => void
  /** Batched: set rawSubTotal AND clear display cache in ONE set().
   *  Use when cart items mutate — avoids 2 consecutive re-render cycles. */
  resetAfterCartChange: (rawSubTotal: number) => void
}

export const useCartDisplayStore = create<CartDisplayStore>((set) => ({
  rawSubTotal: 0,
  cartTotals: null,
  displayItems: null,

  setRawSubTotal: (value) =>
    set((state) => (state.rawSubTotal === value ? state : { rawSubTotal: value })),

  setCartDisplay: (items, totals) =>
    set((state) => {
      if (state.displayItems === items && state.cartTotals === totals) {
        return state
      }
      return { displayItems: items, cartTotals: totals }
    }),

  clearDisplay: () =>
    set((state) =>
      state.displayItems == null && state.cartTotals == null
        ? state
        : { displayItems: null, cartTotals: null },
    ),

  resetAfterCartChange: (rawSubTotal) =>
    set((state) => {
      const sameSubTotal = state.rawSubTotal === rawSubTotal
      const alreadyCleared =
        state.displayItems == null && state.cartTotals == null
      if (sameSubTotal && alreadyCleared) return state
      return {
        rawSubTotal,
        displayItems: null,
        cartTotals: null,
      }
    }),
}))
