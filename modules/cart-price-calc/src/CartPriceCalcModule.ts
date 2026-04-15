/**
 * Cart Price Calc Native Module — JS bridge.
 * Phase 0: Stub — module load được, trả về empty. Integration Phase 4.
 */
import { requireNativeModule } from 'expo'
import type { NativeModule } from 'expo'

export interface CartPriceCalcModuleSpec extends NativeModule {
  calculateDisplayItems(
    orderItemsJson: string,
    voucherJson: string | null
  ): string
  calculateDisplayItemsAsync?(
    orderItemsJson: string,
    voucherJson: string | null
  ): Promise<string>
  calculateRawSubTotal(orderItemsJson: string): number
  formatCurrency(value: number, currency: string): string
  computeProductDetailTotal(
    price: number,
    quantity: number,
    toppingExtra: number,
    promotionPercent: number
  ): number
}

let nativeModule: CartPriceCalcModuleSpec | null = null

try {
  nativeModule = requireNativeModule<CartPriceCalcModuleSpec>('CartPriceCalc')
} catch {
  // Native module unavailable (Expo Go, web)
}

export default nativeModule
