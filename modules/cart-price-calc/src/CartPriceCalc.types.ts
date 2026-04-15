/**
 * Types cho Cart Price Calc Native Module.
 * Phase 1: Data Contract — dùng cho JS ↔ Native.
 */

export interface OrderItemInput {
  id: string
  slug: string | null
  quantity: number
  originalPrice: number
  promotionValue?: number
  promotionDiscount?: number
}

export interface VoucherProductInput {
  product?: { slug?: string }
}

export interface VoucherInput {
  type: 'percent_order' | 'fixed_value' | 'same_price_product'
  value: number
  applicabilityRule: 'all_required' | 'at_least_one_required'
  minOrderValue: number
  voucherProducts: VoucherProductInput[]
}

export interface DisplayItemOutput {
  id: string
  slug: string | null
  quantity: number
  originalPrice: number
  finalPrice: number
  priceAfterPromotion: number
  promotionDiscount: number
  voucherDiscount: number
  [key: string]: unknown
}

export interface CartTotalsOutput {
  subTotalBeforeDiscount: number
  promotionDiscount: number
  voucherDiscount: number
  finalTotal: number
}

export interface CartPriceCalcResult {
  displayItems: DisplayItemOutput[]
  totals: CartTotalsOutput
}
