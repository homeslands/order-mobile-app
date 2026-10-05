// Trong test, `t` mặc định trả về chính khoá. Tra thẳng từ file dịch thật để
// test vừa kiểm bố cục, vừa phát hiện nếu có khoá bị xoá hoặc gõ sai.
jest.mock('react-i18next', () => {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
  const dict: unknown = require('@/i18n/vi/voucher.json').voucher
  return {
    useTranslation: () => ({
      t: (key: string, opts?: Record<string, unknown>) => {
        const raw = key
          .split('.')
          .reduce<unknown>(
            (o, k) =>
              o && typeof o === 'object'
                ? (o as Record<string, unknown>)[k]
                : undefined,
            dict,
          )
        if (typeof raw !== 'string') return key
        return raw.replace(/{{(\w+)}}/g, (_m, n: string) =>
          String(opts?.[n] ?? ''),
        )
      },
    }),
  }
  /* eslint-enable */
})

import { render, screen } from '@testing-library/react-native'

import { VoucherCard } from '@/components/cart/voucher-card'
import type { IVoucher } from '@/types'

/**
 * Bố cục vé có một vùng giữa CHỈ hiện khi voucher kèm điều kiện. Những test
 * này canh đúng chỗ đó: voucher trơn thì gọn như mẫu thiết kế, voucher có
 * điều kiện thì phải nói ra, đặc biệt là lý do không dùng được — thiếu nó
 * người dùng bấm mã không ăn mà không hiểu vì sao.
 */
const base = {
  slug: 'v1',
  title: 'Giảm 50% Người Dùng Mới',
  voucherPaymentMethods: [],
  remainingUsage: 0,
} as unknown as IVoucher

function setup(voucher: IVoucher, props: Record<string, unknown> = {}) {
  return render(
    <VoucherCard
      voucher={voucher}
      isSelected={false}
      primaryColor="#f59e0b"
      isDark={false}
      onSelect={jest.fn()}
      discountLabel="50% Giảm"
      expiryText="Hiệu lực đến 14/10/2026"
      {...props}
    />,
  )
}

describe('VoucherCard', () => {
  it('phần trên luôn có giá trị giảm, tên và hạn dùng', () => {
    setup(base)

    expect(screen.getByText('50% Giảm')).toBeTruthy()
    expect(screen.getByText('Giảm 50% Người Dùng Mới')).toBeTruthy()
    expect(screen.getByText('Hiệu lực đến 14/10/2026')).toBeTruthy()
  })

  it('voucher trơn: không dựng vùng điều kiện', () => {
    setup(base)

    expect(screen.queryByText(/Giá trị đơn hàng tối thiểu/)).toBeNull()
    expect(screen.queryByText(/Số lượng còn lại/)).toBeNull()
  })

  it('có đơn tối thiểu thì hiện ra', () => {
    setup(base, { minOrderText: '50.000đ' })

    expect(screen.getByText(/50\.000đ/)).toBeTruthy()
  })

  it('lý do không dùng được luôn phải hiện', () => {
    setup(base, { errorMessage: 'Chưa đạt giá trị đơn tối thiểu' })

    expect(screen.getByText('Chưa đạt giá trị đơn tối thiểu')).toBeTruthy()
  })

  it('tag phương thức thanh toán hiện khi voucher giới hạn', () => {
    setup({
      ...base,
      voucherPaymentMethods: [{ slug: 'pm1', paymentMethod: 'cash' }],
    } as unknown as IVoucher)

    expect(screen.getByText('Tiền mặt')).toBeTruthy()
  })

  it('lượt còn lại hiện khi remainingUsage > 0', () => {
    setup({ ...base, remainingUsage: 8 } as unknown as IVoucher, {
      usagePercent: 80,
    })

    expect(screen.getByText(/80/)).toBeTruthy()
  })

  it('đổi chữ ở chân thẻ theo trạng thái chọn', () => {
    const { rerender } = setup(base)
    expect(screen.getByText('Chọn')).toBeTruthy()

    rerender(
      <VoucherCard
        voucher={base}
        isSelected
        primaryColor="#f59e0b"
        isDark={false}
        onSelect={jest.fn()}
        discountLabel="50% Giảm"
        expiryText="Hiệu lực đến 14/10/2026"
      />,
    )
    expect(screen.getByText('Đã chọn')).toBeTruthy()
  })
})
