import { shouldHideCartButton } from '@/components/navigation/cart-button-visibility'

describe('shouldHideCartButton', () => {
  it('ẩn ở chính màn giỏ hàng', () => {
    expect(shouldHideCartButton('/cart', true)).toBe(true)
  })

  it('ẩn ở chi tiết món', () => {
    expect(shouldHideCartButton('/product/abc-123', true)).toBe(true)
  })

  it('ẩn ở các luồng thanh toán và sửa đơn', () => {
    expect(shouldHideCartButton('/payment/order-1', true)).toBe(true)
    expect(shouldHideCartButton('/update-order/order-1', true)).toBe(true)
  })

  it('ẩn ở luồng đăng nhập', () => {
    expect(shouldHideCartButton('/auth/login', true)).toBe(true)
  })

  it('đã đăng nhập: ẩn ở các route con của Tài khoản', () => {
    expect(shouldHideCartButton('/profile/gift-card-orders', true)).toBe(true)
    expect(shouldHideCartButton('/profile/edit', true)).toBe(true)
  })

  it('đã đăng nhập: hiện ở trang Tài khoản chính', () => {
    expect(shouldHideCartButton('/profile', true)).toBe(false)
  })

  it('chưa đăng nhập: ẩn ở trang Tài khoản chính (đang hiện form đăng nhập)', () => {
    expect(shouldHideCartButton('/profile', false)).toBe(true)
  })

  it('chưa đăng nhập: ẩn ở route con của Tài khoản', () => {
    expect(shouldHideCartButton('/profile/edit', false)).toBe(true)
  })

  it('hiện ở bốn tab chính khi đã đăng nhập', () => {
    expect(shouldHideCartButton('/home', true)).toBe(false)
    expect(shouldHideCartButton('/menu', true)).toBe(false)
    expect(shouldHideCartButton('/gift-card', true)).toBe(false)
    expect(shouldHideCartButton('/profile', true)).toBe(false)
  })

  it('không ẩn nhầm do khớp chuỗi con', () => {
    expect(shouldHideCartButton('/cartography', true)).toBe(false)
  })

  it('chuẩn hoá dấu / ở cuối: /profile/ xử như /profile', () => {
    expect(shouldHideCartButton('/profile/', true)).toBe(false)
    expect(shouldHideCartButton('/profile/', false)).toBe(true)
  })

  it('chịu được pathname rỗng', () => {
    expect(shouldHideCartButton(null, true)).toBe(false)
    expect(shouldHideCartButton(undefined, true)).toBe(false)
    expect(shouldHideCartButton('', true)).toBe(false)
  })
})
