// /**
//  * Format currency value to Vietnamese Dong (VND) format
//  * @param value - The numeric value to format
//  * @returns Formatted currency string (e.g., "100.000 ₫")
//  */
// export const formatCurrency = (value: number): string => {
//   const safeValue = value < 0 ? 0 : value
//   const formatted = new Intl.NumberFormat('vi-VN', {
//     style: 'currency',
//     currency: 'VND',
//   }).format(safeValue)
//   return formatted
// }

// export const formatCurrencyWithSymbol = (value: number, withSymbol = true) => {
//   const formatted = new Intl.NumberFormat('vi-VN').format(value)
//   return withSymbol ? `${formatted} ₫` : formatted
// }

/** Cache 1 instance — tránh 25+ new Intl.NumberFormat mỗi frame khi scroll cart */
const numberFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Format currency to short — cache formatter cho value < 1000 */
const shortCurrencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

/** Cache cart-price-calc — tránh repeated require mỗi lần formatCurrency */
let _formatCurrencyNative: ((v: number, c: string) => string) | null = null
function getFormatCurrencyNative(): ((v: number, c: string) => string) | null {
  if (_formatCurrencyNative != null) return _formatCurrencyNative
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Optional native; dynamic require cho fallback web/Expo Go
    const mod = require('cart-price-calc') as {
      formatCurrencyNative: (v: number, c: string) => string
    }
    _formatCurrencyNative = mod.formatCurrencyNative
    return _formatCurrencyNative
  } catch {
    return null
  }
}

/**
 * Format currency value to Vietnamese format
 * Native-first (P6): offload sang cart-price-calc khi có, fallback JS cached.
 * @param value - Number to format
 * @param currency - Currency symbol (default: 'đ')
 * @returns Formatted string (e.g., "100.000 đ")
 */
export function formatCurrency(value: number, currency = 'đ'): string {
  const native = getFormatCurrencyNative()
  if (native) {
    try {
      return native(value, currency)
    } catch {
      // fallback
    }
  }
  const safeValue = value < 0 ? 0 : value
  return `${numberFormatter.format(safeValue)} ${currency}`
}

/**
 * Format currency value with optional symbol — native-first via formatCurrency.
 * @param value - Number to format
 * @param withSymbol - Whether to include currency symbol (default: true)
 * @returns Formatted string (e.g., "100.000 ₫" or "100.000")
 */
export const formatCurrencyWithSymbol = (
  value: number,
  withSymbol = true,
): string => formatCurrency(value, withSymbol ? '₫' : '')

/**
 * Format currency to short format (e.g., "100K")
 * @param value - Number to format
 * @param currency - Currency code (default: 'VND')
 * @returns Formatted string
 */
export function formatShortCurrency(value: number, currency = 'VND'): string {
  const safeValue = value < 0 ? 0 : value
  if (safeValue >= 1000000) {
    return `${(safeValue / 1000000).toFixed(1).replace(/\.0$/, '')}M`
  }
  if (safeValue >= 1000) {
    return `${(safeValue / 1000).toFixed(1).replace(/\.0$/, '')}K`
  }
  return currency === 'VND'
    ? shortCurrencyFormatter.format(safeValue)
    : new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(safeValue)
}

/**
 * Format points value (number with thousand separators) — native-first via formatCurrency.
 * @param value - Number to format
 * @returns Formatted string (e.g., "100.000")
 */
export function formatPoints(value: number) {
  return formatCurrency(value, '').trimEnd()
}

/** Viết hoa chữ cái đầu của chuỗi (1 hoặc nhiều từ chỉ hoa chữ đầu tiên). */
export function capitalizeFirst(text: string): string {
  if (!text) return text
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}
