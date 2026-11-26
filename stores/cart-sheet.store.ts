import { create } from 'zustand'

/**
 * Sheet tuỳ chọn đơn ở giỏ hàng đang mở. Thẻ "tuỳ chọn đơn" trong danh sách
 * và nút Đặt hàng ở thanh dưới (thiếu bàn / địa chỉ) cùng mở qua đây; thanh
 * dưới giữ và hiển thị các sheet. Một sheet một lúc.
 */
export type CartSheet = 'orderType' | 'table' | 'voucher' | 'delivery'

type CartSheetStore = {
  sheet: CartSheet | null
  open: (sheet: CartSheet) => void
  close: () => void
}

export const useCartSheetStore = create<CartSheetStore>((set) => ({
  sheet: null,
  open: (sheet) => set({ sheet }),
  close: () => set({ sheet: null }),
}))
