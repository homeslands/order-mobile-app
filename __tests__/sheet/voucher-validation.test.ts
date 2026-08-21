// `isValid` tính từ 7 điều kiện, còn `errorChecks` là một danh sách viết tay
// riêng. Hai thứ diễn đạt cùng một luật bằng hai cách khác nhau nên đã trôi ra
// xa nhau: có 4 đường làm voucher không hợp lệ mà không sinh ra thông điệp nào,
// khách chỉ thấy một câu chung chung.
//
// Bất biến cần giữ: KHÔNG hợp lệ thì LUÔN có lý do.
import dayjs from 'dayjs'

// voucher-validation import qua barrel `@/utils`, mà barrel kéo theo stores ->
// expo-notifications và làm sập cả suite. Mock barrel nhưng trỏ thẳng vào bản
// thật của hai hàm nó dùng, để logic áp dụng sản phẩm vẫn được chạy thật.
jest.mock('@/utils', () => ({
  /* eslint-disable @typescript-eslint/no-require-imports */
  formatCurrency: require('@/utils/formatCurrency').formatCurrency,
  isVoucherApplicableToCartItems:
    require('@/utils/voucher').isVoucherApplicableToCartItems,
  /* eslint-enable @typescript-eslint/no-require-imports */
}))

import { processVoucherList } from '@/components/sheet/voucher-validation'
import { APPLICABILITY_RULE, VOUCHER_TYPE } from '@/constants'
import type { IVoucher } from '@/types'

const t = (key: string) => key

/** Voucher hợp lệ hoàn toàn — mỗi test chỉ bẻ gãy đúng một điều kiện. */
function makeVoucher(overrides: Partial<IVoucher> = {}): IVoucher {
  return {
    slug: 'v1',
    title: 'Giảm 30.000₫',
    isActive: true,
    endDate: dayjs().add(30, 'day').toISOString(),
    remainingUsage: 10,
    maxUsage: 10,
    type: VOUCHER_TYPE.FIXED_VALUE,
    value: 30000,
    minOrderValue: 0,
    isVerificationIdentity: false,
    applicabilityRule: APPLICABILITY_RULE.AT_LEAST_ONE_REQUIRED,
    voucherProducts: [{ slug: 'vp1', createdAt: '', product: { slug: 'p1' } }],
    ...overrides,
  } as IVoucher
}

function run(v: IVoucher, optOverrides: Record<string, unknown> = {}) {
  return processVoucherList([v], {
    cartProductSlugs: ['p1'],
    subTotalAfterPromotion: 100000,
    userSlug: 'u1',
    isCustomerOwner: true,
    t,
    ...optOverrides,
  })[0]
}

describe('processVoucherList — voucher hợp lệ', () => {
  it('không bẻ gãy gì thì hợp lệ và không có lý do lỗi', () => {
    const r = run(makeVoucher())
    expect(r.isValid).toBe(true)
    expect(r.errorMessage).toBe('')
  })
})

describe('processVoucherList — bốn lỗ hổng không có thông điệp', () => {
  it('voucher bị tắt', () => {
    const r = run(makeVoucher({ isActive: false }))
    expect(r.isValid).toBe(false)
    expect(r.errorMessage).toBe('voucherStopped')
  })

  it('remainingUsage là undefined, không phải 0', () => {
    const r = run(makeVoucher({ remainingUsage: undefined as never }))
    expect(r.isValid).toBe(false)
    expect(r.errorMessage).toBe('outOfStock')
  })

  it('voucher không gắn sản phẩm nào', () => {
    const r = run(makeVoucher({ voucherProducts: [] }))
    expect(r.isValid).toBe(false)
    expect(r.errorMessage).toBe('notApplicableToCart')
  })

  it('endDate trước 7h sáng nay nhưng chưa tính là hết hạn', () => {
    jest.useFakeTimers()
    try {
      // 5h sáng: endDate 6h sáng nằm trước mốc 7h (isValidDate = false) nhưng
      // 6h30 vẫn sau 5h nên isExpired = false. Đúng khe hở giữa hai luật.
      const fiveAm = dayjs().hour(5).minute(0).second(0).millisecond(0)
      jest.setSystemTime(fiveAm.toDate())
      const sixAm = dayjs().hour(6).minute(0).second(0).millisecond(0)

      const r = run(makeVoucher({ endDate: sixAm.toISOString() }))
      expect(r.isValid).toBe(false)
      expect(r.errorMessage).toBe('expired')
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('processVoucherList — các lý do vốn đã có', () => {
  it('hết hạn', () => {
    const r = run(
      makeVoucher({ endDate: dayjs().subtract(2, 'day').toISOString() }),
    )
    expect(r.errorMessage).toBe('expired')
  })

  it('hết lượt', () => {
    const r = run(makeVoucher({ remainingUsage: 0 }))
    expect(r.errorMessage).toBe('outOfStock')
  })

  it('chưa đạt giá trị tối thiểu', () => {
    const r = run(makeVoucher({ minOrderValue: 200000 }))
    expect(r.errorMessage).toBe('minOrderNotMet')
  })

  it('cần đăng nhập', () => {
    const r = run(makeVoucher({ isVerificationIdentity: true }), {
      isCustomerOwner: false,
      userSlug: undefined,
    })
    expect(r.errorMessage).toBe('needVerifyIdentity')
  })

  it('giỏ có món ngoài danh sách khi quy tắc là tất-cả-bắt-buộc', () => {
    const r = run(
      makeVoucher({ applicabilityRule: APPLICABILITY_RULE.ALL_REQUIRED }),
      { cartProductSlugs: ['p1', 'p2'] },
    )
    expect(r.errorMessage).toBe('requireOnlyApplicableProducts')
  })

  it('giỏ không có món nào áp được', () => {
    const r = run(makeVoucher(), { cartProductSlugs: ['pX'] })
    expect(r.errorMessage).toBe('requireSomeApplicableProducts')
  })
})

describe('processVoucherList — bất biến', () => {
  const breakers: [string, Partial<IVoucher>, Record<string, unknown>][] = [
    ['tắt', { isActive: false }, {}],
    ['hết hạn', { endDate: dayjs().subtract(1, 'day').toISOString() }, {}],
    ['hết lượt', { remainingUsage: 0 }, {}],
    ['lượt undefined', { remainingUsage: undefined as never }, {}],
    ['chưa đạt tối thiểu', { minOrderValue: 999999 }, {}],
    ['không gắn sản phẩm', { voucherProducts: [] }, {}],
    ['giỏ không khớp', {}, { cartProductSlugs: ['pX'] }],
    ['giỏ rỗng', {}, { cartProductSlugs: [] }],
    [
      'cần đăng nhập',
      { isVerificationIdentity: true },
      { isCustomerOwner: false, userSlug: undefined },
    ],
  ]

  it.each(breakers)(
    'không hợp lệ vì %s thì luôn có lý do',
    (_label, vOverrides, optOverrides) => {
      const r = run(makeVoucher(vOverrides), optOverrides)
      expect(r.isValid).toBe(false)
      expect(r.errorMessage).not.toBe('')
    },
  )
})
