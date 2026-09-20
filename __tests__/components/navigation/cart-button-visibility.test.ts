import { shouldHideCartButton } from '@/components/navigation/cart-button-visibility'

describe('shouldHideCartButton', () => {
  it('ẩn ở chính màn giỏ hàng', () => {
    expect(shouldHideCartButton('/cart')).toBe(true)
  })

  it('ẩn ở chi tiết món', () => {
    expect(shouldHideCartButton('/product/abc-123')).toBe(true)
  })

  it('ẩn ở các luồng thanh toán và sửa đơn', () => {
    expect(shouldHideCartButton('/payment/order-1')).toBe(true)
    expect(shouldHideCartButton('/update-order/order-1')).toBe(true)
  })

  it('ẩn ở luồng đăng nhập', () => {
    expect(shouldHideCartButton('/auth/login')).toBe(true)
  })

  it('ẩn ở các route con của Tài khoản', () => {
    expect(shouldHideCartButton('/profile/gift-card-orders')).toBe(true)
  })

  it('hiện ở trang Tài khoản chính', () => {
    expect(shouldHideCartButton('/profile')).toBe(false)
  })

  it('hiện ở bốn tab chính', () => {
    expect(shouldHideCartButton('/home')).toBe(false)
    expect(shouldHideCartButton('/menu')).toBe(false)
    expect(shouldHideCartButton('/gift-card')).toBe(false)
    expect(shouldHideCartButton('/profile')).toBe(false)
  })

  it('không ẩn nhầm do khớp chuỗi con', () => {
    expect(shouldHideCartButton('/cartography')).toBe(false)
  })

  it('chịu được pathname rỗng', () => {
    expect(shouldHideCartButton(null)).toBe(false)
    expect(shouldHideCartButton(undefined)).toBe(false)
  })
})
