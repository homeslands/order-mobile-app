/**
 * Thứ còn thiếu trước khi đặt đơn, theo loại đơn → nhãn nút + sheet cần mở.
 * Mang đi không có gì bắt buộc: giờ lấy mặc định "ngay" (usePickupTime tự ghi 0).
 */
import { PHONE_NUMBER_REGEX } from '@/constants/regex'

export type CartMissingField = 'table' | 'delivery-address' | 'delivery-phone'

export interface CartCheckoutStep {
  missing: CartMissingField | null
  labelKey: string
  sheet: 'table' | 'delivery' | null
}

interface CartCheckoutInput {
  type?: string
  tableName?: string
  deliveryAddress?: string
  deliveryPhone?: string
}

export function getCartCheckoutStep({
  type,
  tableName,
  deliveryAddress,
  deliveryPhone,
}: CartCheckoutInput): CartCheckoutStep {
  if (type === 'at-table' && !tableName) {
    return { missing: 'table', labelKey: 'menu.selectTable', sheet: 'table' }
  }
  if (type === 'delivery') {
    if (!deliveryAddress) {
      return {
        missing: 'delivery-address',
        labelKey: 'cart.enterDeliveryAddress',
        sheet: 'delivery',
      }
    }
    if (!deliveryPhone || !PHONE_NUMBER_REGEX.test(deliveryPhone)) {
      return {
        missing: 'delivery-phone',
        labelKey: 'cart.enterPhoneNumber',
        sheet: 'delivery',
      }
    }
  }
  return { missing: null, labelKey: 'cart.placeOrder', sheet: null }
}
