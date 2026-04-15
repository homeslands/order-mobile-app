const integerFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const currencyFormatterCache = new Map<string, Intl.NumberFormat>()

const clampNegative = (value: number) => (value < 0 ? 0 : value)

const getCurrencyFormatter = (currency: string) => {
  if (!currencyFormatterCache.has(currency)) {
    currencyFormatterCache.set(
      currency,
      new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    )
  }
  return currencyFormatterCache.get(currency)!
}

/**
 * Format currency value to Vietnamese format
 * @param value - Number to format
 * @param currency - Currency symbol (default: 'đ')
 * @returns Formatted string (e.g., "100.000 đ")
 */
export function formatCurrency(value: number, currency = 'đ'): string {
  const safeValue = clampNegative(value)
  const formatted = integerFormatter.format(safeValue)
  return `${formatted} ${currency}`
}

/**
 * Format currency value with optional symbol
 * @param value - Number to format
 * @param withSymbol - Whether to include currency symbol (default: true)
 * @returns Formatted string (e.g., "100.000 ₫" or "100.000")
 */
export const formatCurrencyWithSymbol = (value: number, withSymbol = true): string => {
  const safeValue = clampNegative(value)
  const formatted = integerFormatter.format(safeValue)
  return withSymbol ? `${formatted} ₫` : formatted
}

/**
 * Format currency to short format (e.g., "100K")
 * @param value - Number to format
 * @param currency - Currency code (default: 'VND')
 * @returns Formatted string
 */
export function formatShortCurrency(value: number, currency = 'VND'): string {
  const safeValue = clampNegative(value)
  if (safeValue >= 1000000) {
    return `${(safeValue / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(1).replace(/\.0$/, '')}K`
  }
  return getCurrencyFormatter(currency).format(safeValue)
}

/**
 * Format points value (number with thousand separators)
 * @param value - Number to format
 * @returns Formatted string (e.g., "100.000")
 */
export function formatPoints(value: number): string {
  const safeValue = clampNegative(value)
  return integerFormatter.format(safeValue)
}
