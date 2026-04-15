/**
 * formatCurrency — Native offload cho Intl.NumberFormat.
 * P6: Expo Module nếu JS cache (P3) chưa đủ.
 */
import CartPriceCalc from './CartPriceCalcModule'

/** Cache JS fallback — dùng khi native không có (web, Expo Go) */
const numberFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export function formatCurrencyNative(
  value: number,
  currency = 'đ',
): string {
  const safeValue = value < 0 ? 0 : value
  if (!CartPriceCalc) {
    return `${numberFormatter.format(safeValue)} ${currency}`
  }
  try {
    return CartPriceCalc.formatCurrency(safeValue, currency)
  } catch {
    return `${numberFormatter.format(safeValue)} ${currency}`
  }
}
