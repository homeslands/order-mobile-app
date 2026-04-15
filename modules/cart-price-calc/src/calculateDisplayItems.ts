/**
 * calculateDisplayItems — Gọi Native module nếu có, fallback sang JS.
 * Caller (cart-content-full) cung cấp fallback từ @/utils.
 */
import CartPriceCalc from './CartPriceCalcModule'
import type { CartTotalsOutput } from './CartPriceCalc.types'

export interface CalculateDisplayItemsInput {
  /** Order items — cần id, slug/productSlug, quantity, originalPrice, promotionValue, promotionDiscount */
  orderItems: Array<Record<string, unknown>>
  voucher: {
    type: string
    value?: number
    applicabilityRule: string
    minOrderValue?: number
    voucherProducts?: Array<{ product?: { slug?: string } }>
  } | null
}

export interface CalculateDisplayItemsResult {
  displayItems: Array<Record<string, unknown>>
  totals: CartTotalsOutput
}

type DisplayItemsNativeStats = {
  syncCalls: number
  asyncCalls: number
  asyncPathUsed: number
  asyncFallbackToSync: number
  nativeParseError: number
}

const displayItemsNativeStats: DisplayItemsNativeStats = {
  syncCalls: 0,
  asyncCalls: 0,
  asyncPathUsed: 0,
  asyncFallbackToSync: 0,
  nativeParseError: 0,
}

export function getDisplayItemsNativeStats(): DisplayItemsNativeStats {
  return { ...displayItemsNativeStats }
}

export function resetDisplayItemsNativeStats(): void {
  displayItemsNativeStats.syncCalls = 0
  displayItemsNativeStats.asyncCalls = 0
  displayItemsNativeStats.asyncPathUsed = 0
  displayItemsNativeStats.asyncFallbackToSync = 0
  displayItemsNativeStats.nativeParseError = 0
}

function serializeVoucher(input: CalculateDisplayItemsInput['voucher']): string | null {
  if (!input) return null
  return JSON.stringify({
    type: input.type,
    value: input.value ?? 0,
    applicabilityRule: input.applicabilityRule,
    minOrderValue: input.minOrderValue ?? 0,
    voucherProducts: (input.voucherProducts ?? [])
      .filter((vp) => vp.product?.slug)
      .map((vp) => ({ product: { slug: vp.product!.slug } })),
  })
}

export function calculateDisplayItemsNative(
  input: CalculateDisplayItemsInput,
): CalculateDisplayItemsResult | null {
  if (!CartPriceCalc || !input.orderItems.length) return null

  try {
    displayItemsNativeStats.syncCalls += 1
    const orderItemsJson = JSON.stringify(input.orderItems)
    const voucherJson = serializeVoucher(input.voucher)

    const resultJson = CartPriceCalc.calculateDisplayItems(
      orderItemsJson,
      voucherJson,
    )
    const parsed = JSON.parse(resultJson) as {
      displayItems: Array<Record<string, unknown>>
      totals: CartTotalsOutput
    }
    return parsed
  } catch {
    displayItemsNativeStats.nativeParseError += 1
    return null
  }
}

export async function calculateDisplayItemsNativeAsync(
  input: CalculateDisplayItemsInput,
): Promise<CalculateDisplayItemsResult | null> {
  if (!CartPriceCalc || !input.orderItems.length) return null

  try {
    displayItemsNativeStats.asyncCalls += 1
    const orderItemsJson = JSON.stringify(input.orderItems)
    const voucherJson = serializeVoucher(input.voucher)
    const hasAsync = !!CartPriceCalc.calculateDisplayItemsAsync
    if (hasAsync) {
      displayItemsNativeStats.asyncPathUsed += 1
    } else {
      displayItemsNativeStats.asyncFallbackToSync += 1
    }
    const resultJson = CartPriceCalc.calculateDisplayItemsAsync
      ? await CartPriceCalc.calculateDisplayItemsAsync(orderItemsJson, voucherJson)
      : CartPriceCalc.calculateDisplayItems(orderItemsJson, voucherJson)

    const parsed = JSON.parse(resultJson) as {
      displayItems: Array<Record<string, unknown>>
      totals: CartTotalsOutput
    }
    return parsed
  } catch {
    displayItemsNativeStats.nativeParseError += 1
    return null
  }
}
