/**
 * Cart Price Calc — Native module offload calculateCartItemDisplay + calculateCartTotals.
 * Giảm block JS thread khi mở Cart.
 */
export { default } from './src/CartPriceCalcModule'
export {
  calculateDisplayItemsNative,
  calculateDisplayItemsNativeAsync,
  getDisplayItemsNativeStats,
  resetDisplayItemsNativeStats,
} from './src/calculateDisplayItems'
export {
  calculateOrderItemDisplayNative,
  type OrderDisplayResult,
} from './src/calculateOrderDisplayItems'
export { calculateRawSubTotalNative } from './src/calculateRawSubTotal'
export { formatCurrencyNative } from './src/formatCurrency'
export { computeProductDetailTotalNative } from './src/computeProductDetailTotal'
export type {
  CalculateDisplayItemsInput,
  CalculateDisplayItemsResult,
} from './src/calculateDisplayItems'
export * from './src/CartPriceCalc.types'
