// Danh sách mã không dùng được — dùng chung ở giỏ hàng, thanh toán và sửa đơn.
// Khách phải thấy NGAY vì sao mã không dùng được: lý do in dưới mỗi thẻ, rõ
// (không bị làm mờ), và link "Điều kiện" cũng không mờ để mở chi tiết. Chỉ
// phần thân thẻ mờ để báo "không chọn được". (Danh sách không nhận onSelect:
// mã không dùng được thì không chọn được.)
import {
  fireEvent,
  render,
  screen,
  type RenderResult,
} from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { InvalidList } from '@/app/update-order/components/voucher-sheet-in-update-order/invalid-list'

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (k: string, o?: { count?: number }) =>
      o?.count != null ? `${k}:${o.count}` : k,
  }),
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

const make = (slug: string, errorMessage = 'Chưa đủ giá trị đơn') =>
  ({
    voucher: {
      slug,
      title: `Mã ${slug}`,
      remainingUsage: 0,
      maxUsage: 0,
      voucherPaymentMethods: [],
    },
    isValid: false,
    errorMessage,
    expiryText: '',
    discountLabel: 'Giảm 30.000₫',
  }) as unknown as ProcessedVoucher

const item = make('v1')

// Type instance lấy qua RenderResult: 'react-test-renderer' không có type
// declaration, import thẳng thì tsc báo TS7016.
type Instance = ReturnType<RenderResult['getByText']>

/** Có tổ tiên nào (kể cả chính nó) mang opacity < 1 không. */
function isDimmed(el: Instance) {
  for (let n: Instance | null = el; n; n = n.parent) {
    const style = StyleSheet.flatten(
      (n.props as { style?: unknown }).style as never,
    ) as { opacity?: number } | undefined
    if (typeof style?.opacity === 'number' && style.opacity < 1) return true
  }
  return false
}

function setup(vouchers: ProcessedVoucher[] = [item]) {
  const onViewCondition = jest.fn()
  render(
    <InvalidList
      vouchers={vouchers}
      onViewCondition={onViewCondition}
      isDark={false}
      primaryColor="#f59e0b"
    />,
  )
  return { onViewCondition }
}

it('IL1 bấm "Điều kiện" trên mã không dùng được thì mở sheet điều kiện', () => {
  const { onViewCondition } = setup()
  fireEvent.press(screen.getByText('condition'))
  expect(onViewCondition).toHaveBeenCalledWith(item.voucher)
})

it('IL2 in lý do ngay dưới thẻ, không bị làm mờ', () => {
  setup()
  const reason = screen.getByText('Chưa đủ giá trị đơn')
  expect(isDimmed(reason)).toBe(false)
})

it('IL3 link "Điều kiện" không bị làm mờ, chỉ thân thẻ mờ', () => {
  setup()
  expect(isDimmed(screen.getByText('condition'))).toBe(false)
  expect(isDimmed(screen.getByText('Mã v1'))).toBe(true)
})

it('IL4 lý do rỗng thì không in dòng trống', () => {
  setup([make('v1', ''), make('v2')])
  expect(screen.getAllByTestId('voucher-unavailable-reason')).toHaveLength(1)
})

it('IL5 hơn 5 mã thì có "Xem thêm (N)", bấm vào hiện hết', () => {
  setup(Array.from({ length: 7 }, (_, i) => make(`v${i}`)))
  expect(screen.queryByText('Mã v5')).toBeNull()
  fireEvent.press(screen.getByText('showMoreUnavailable:2'))
  expect(screen.getByText('Mã v5')).toBeTruthy()
  expect(screen.getByText('Mã v6')).toBeTruthy()
  expect(screen.queryByText('showMoreUnavailable:2')).toBeNull()
})

it('IL6 từ 5 mã trở xuống thì không có nút xem thêm', () => {
  setup(Array.from({ length: 5 }, (_, i) => make(`v${i}`)))
  expect(screen.queryByText(/showMoreUnavailable/)).toBeNull()
})
