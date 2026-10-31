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

import * as fs from 'fs'
import * as path from 'path'

import { fireEvent, render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { VoucherCard } from '@/components/cart/voucher-card'
import { colors } from '@/constants'
import { hexToRgba } from '@/lib/utils'
import { Line } from 'react-native-svg'
import type { IVoucher } from '@/types'

/**
 * Thẻ vé chỉ giữ thứ khách cần để chọn mã: tên, mức giảm, mô tả, hạn dùng và
 * báo "Sắp hết lượt" khi khan hiếm. Điều kiện chi tiết và lý do không dùng
 * được nằm ở sheet Điều kiện, mở từ link ở chân thẻ.
 */
const base = {
  slug: 'v1',
  title: '50% Giảm',
  description: 'Giảm 50% Người Dùng Mới',
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
      expiryText="Hiệu lực đến 14/10/2026 23:59"
      {...props}
    />,
  )
}

describe('VoucherCard', () => {
  it('hiện tên, mức giảm, mô tả, hạn dùng', () => {
    setup(base, { discountLabel: 'Giảm 30.000₫' })

    expect(screen.getByText('50% Giảm')).toBeTruthy()
    expect(screen.getByText('Giảm 30.000₫')).toBeTruthy()
    expect(screen.getByText('Giảm 50% Người Dùng Mới')).toBeTruthy()
    expect(screen.getByText('Hiệu lực đến 14/10/2026 23:59')).toBeTruthy()
  })

  // Tên voucher do admin tự đặt, nhiều khi không nói được giảm bao nhiêu
  // ("Ưu đãi tháng 10") — mức giảm là thứ khách cần để chọn mã.
  it('tên không nói mức giảm thì dòng mức giảm vẫn nói', () => {
    setup({ ...base, title: 'Ưu đãi tháng 10' } as unknown as IVoucher, {
      discountLabel: 'Giảm 20%',
    })

    expect(screen.getByText('Giảm 20%')).toBeTruthy()
  })

  // Tỉ lệ lượt còn lại tính trên cả chương trình — không giúp khách chọn mã,
  // mà chiếm một dòng của thẻ.
  it('không hiện thanh % lượt còn lại, kể cả khi còn lượt', () => {
    setup({ ...base, remainingUsage: 8 } as unknown as IVoucher)

    expect(screen.queryByText(/Số lượng còn lại/)).toBeNull()
  })

  it('voucher không có mô tả vẫn dựng được', () => {
    setup({ ...base, description: undefined } as unknown as IVoucher)

    expect(screen.getByText('50% Giảm')).toBeTruthy()
    expect(screen.queryByText('Giảm 50% Người Dùng Mới')).toBeNull()
  })

  it('chân thẻ chỉ còn link điều kiện, không có chữ chọn', () => {
    setup(base)

    expect(screen.getByText('Điều kiện')).toBeTruthy()
    expect(screen.queryByText('Chọn')).toBeNull()
    expect(screen.queryByText('Đã chọn')).toBeNull()
  })

  it('chạm vào thẻ là chọn — không cần nút riêng', () => {
    const onSelect = jest.fn()
    setup(base, { onSelect })

    fireEvent.press(screen.getByText('50% Giảm'))

    expect(onSelect).toHaveBeenCalledWith('v1')
  })

  // Thẻ vé dùng bảng màu của app — không tự đặt tông kem/nâu theo ảnh thiết
  // kế. Chữ chính màu foreground, mức giảm màu primary, đường đục lỗ màu border.
  it('chữ theo token của app: tên foreground, mức giảm primary', () => {
    setup(base, { discountLabel: 'Giảm 20%' })

    const color = (text: string) =>
      (
        StyleSheet.flatten(screen.getByText(text).props.style) as {
          color?: string
        }
      ).color
    expect(color('50% Giảm')).toBe(colors.foreground.light)
    expect(color('Giảm 20%')).toBe('#f59e0b')
  })

  it('không còn màu tự đặt: không hex, không rgba, không bảng màu ticket', () => {
    const src = fs
      .readFileSync(
        path.resolve(__dirname, '../../../components/cart/voucher-card.tsx'),
        'utf-8',
      )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/)
    expect(src).not.toMatch(/colors\.ticket/)
  })

  // Đường đục lỗ phải đủ đậm để thấy rõ trên nền nhuốm primary.
  it('đường đục lỗ màu primary đậm (alpha 0.6)', () => {
    setup(base)

    const line = screen.UNSAFE_getByType(Line)
    expect(line.props.stroke).toBe(hexToRgba('#f59e0b', 0.6))
  })

  // Không có thanh %; chỉ báo khan hiếm khi nó có ý nghĩa — còn dưới 20%.
  describe('nhãn Sắp hết lượt', () => {
    const withUsage = (remainingUsage: number, maxUsage: number) =>
      ({ ...base, remainingUsage, maxUsage }) as unknown as IVoucher

    it('LS1 còn dưới 20% thì hiện', () => {
      setup(withUsage(1, 10))
      expect(screen.getByText('Sắp hết lượt')).toBeTruthy()
    })

    it('LS2 còn từ 20% trở lên thì không hiện', () => {
      setup(withUsage(2, 10))
      expect(screen.queryByText('Sắp hết lượt')).toBeNull()
    })

    it('LS3 hết lượt hoặc không có tổng lượt thì không hiện', () => {
      setup(withUsage(0, 10))
      expect(screen.queryByText('Sắp hết lượt')).toBeNull()
      setup(withUsage(3, 0))
      expect(screen.queryByText('Sắp hết lượt')).toBeNull()
    })
  })
})
