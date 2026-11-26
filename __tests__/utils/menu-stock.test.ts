// Tồn kho món và trạng thái nút "Thêm vào giỏ": Menu từng cho thêm nhanh món
// hết hàng, còn trang chi tiết thì ghi "Hết hàng" cả lúc đang tải / lỗi mạng.
import {
  getMenuListEmptyState,
  getProductAddButtonState,
  hasMenuItemStock,
  isMenuLoadError,
} from '@/utils/menu-stock'

describe('hasMenuItemStock', () => {
  it('món không giới hạn số lượng thì luôn còn hàng', () => {
    expect(
      hasMenuItemStock({ isLocked: false, currentStock: 0, isLimit: false }),
    ).toBe(true)
  })

  it('món bị khoá thì hết hàng dù còn số lượng', () => {
    expect(
      hasMenuItemStock({ isLocked: true, currentStock: 5, isLimit: false }),
    ).toBe(false)
  })

  it('món giới hạn số lượng về 0 thì hết hàng', () => {
    expect(
      hasMenuItemStock({ isLocked: false, currentStock: 0, isLimit: true }),
    ).toBe(false)
  })

  it('món giới hạn còn số lượng thì còn hàng', () => {
    expect(
      hasMenuItemStock({ isLocked: false, currentStock: 2, isLimit: true }),
    ).toBe(true)
  })

  it('thiếu trường thì coi như không khoá, không giới hạn', () => {
    expect(hasMenuItemStock({})).toBe(true)
    expect(hasMenuItemStock({ isLimit: true })).toBe(false)
  })
})

describe('getProductAddButtonState', () => {
  const base = {
    hasData: true,
    isError: false,
    hasStock: true,
    hasSelectedVariant: true,
  }

  it('đang tải (chưa có dữ liệu) thì là loading, không phải hết hàng', () => {
    expect(
      getProductAddButtonState({ ...base, hasData: false, hasStock: false }),
    ).toBe('loading')
  })

  it('lỗi và chưa có dữ liệu thì là error', () => {
    expect(
      getProductAddButtonState({
        ...base,
        hasData: false,
        isError: true,
        hasStock: false,
      }),
    ).toBe('error')
  })

  it('làm mới lỗi nhưng đã có dữ liệu cũ thì vẫn dùng dữ liệu', () => {
    expect(getProductAddButtonState({ ...base, isError: true })).toBe('ready')
  })

  it('có dữ liệu mà hết hàng thì là outOfStock', () => {
    expect(getProductAddButtonState({ ...base, hasStock: false })).toBe(
      'outOfStock',
    )
  })

  it('có dữ liệu nhưng chưa chọn size thì chờ, không ghi hết hàng', () => {
    expect(
      getProductAddButtonState({ ...base, hasSelectedVariant: false }),
    ).toBe('loading')
  })

  it('đủ điều kiện thì ready', () => {
    expect(getProductAddButtonState(base)).toBe('ready')
  })
})

describe('getMenuListEmptyState', () => {
  it('đang tải thì hiện khung tải', () => {
    expect(
      getMenuListEmptyState({
        isLoading: true,
        isError: false,
        isRetrying: false,
      }),
    ).toBe('loading')
  })

  it('lỗi thì hiện trạng thái lỗi, không giả làm "chưa có món"', () => {
    expect(
      getMenuListEmptyState({
        isLoading: false,
        isError: true,
        isRetrying: false,
      }),
    ).toBe('error')
  })

  it('đang thử lại sau lỗi thì hiện khung tải', () => {
    expect(
      getMenuListEmptyState({
        isLoading: false,
        isError: true,
        isRetrying: true,
      }),
    ).toBe('loading')
  })

  it('tải xong không lỗi mà không có món thì là empty', () => {
    expect(
      getMenuListEmptyState({
        isLoading: false,
        isError: false,
        isRetrying: false,
      }),
    ).toBe('empty')
  })
})

describe('isMenuLoadError', () => {
  const withCode = (statusCode: number) => ({
    response: { data: { statusCode } },
  })

  it('không có lỗi thì không phải lỗi tải', () => {
    expect(isMenuLoadError(null)).toBe(false)
    expect(isMenuLoadError(undefined)).toBe(false)
  })

  it('117002 (danh mục không có món hôm nay) là trạng thái bình thường', () => {
    expect(isMenuLoadError(withCode(117002))).toBe(false)
  })

  it('lỗi mạng và lỗi máy chủ là lỗi tải', () => {
    expect(isMenuLoadError(new Error('Network Error'))).toBe(true)
    expect(isMenuLoadError(withCode(500))).toBe(true)
  })
})
