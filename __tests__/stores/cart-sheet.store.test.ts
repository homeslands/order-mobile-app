// Sheet tuỳ chọn đơn ở giỏ (loại đơn / bàn / voucher / giao hàng) mở được từ
// thẻ trong danh sách lẫn từ nút Đặt hàng (thiếu bàn / địa chỉ) — một nơi giữ
// sheet nào đang mở, chỉ một sheet một lúc.
import { useCartSheetStore } from '@/stores/cart-sheet.store'

afterEach(() => useCartSheetStore.getState().close())

it('CS1 mở một sheet, đóng về null', () => {
  useCartSheetStore.getState().open('table')
  expect(useCartSheetStore.getState().sheet).toBe('table')
  useCartSheetStore.getState().close()
  expect(useCartSheetStore.getState().sheet).toBeNull()
})

it('CS2 mở sheet khác thì thay sheet cũ (một sheet một lúc)', () => {
  useCartSheetStore.getState().open('orderType')
  useCartSheetStore.getState().open('delivery')
  expect(useCartSheetStore.getState().sheet).toBe('delivery')
})
