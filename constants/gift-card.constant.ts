export enum GiftCardStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum GiftCardType {
  SELF = 'SELF',
  GIFT = 'GIFT',
  BUY = 'BUY',
  NONE = 'NONE',
}

export enum ReceiverField {
  PHONE = 'phone',
  NOTE = 'note',
  QUANTITY = 'quantity',
}

export enum GiftCardFlagGroup {
  GIFT_CARD = 'GIFT_CARD',
}

export enum GiftCardUsageStatus {
  AVAILABLE = 'available',
  USED = 'used',
  EXPIRED = 'expired',
  ALL = 'all',
}

/**
 * Trần tổng giá trị một đơn mua thẻ quà (VND).
 * TẠM HARDCODE — BE chưa có endpoint để lấy giá trị này. Khi BE bổ sung,
 * thay bằng giá trị fetch được (giữ nguyên chỗ dùng, chỉ đổi nguồn).
 */
export const GIFT_CARD_MAX_ORDER_AMOUNT = 5_000_000
