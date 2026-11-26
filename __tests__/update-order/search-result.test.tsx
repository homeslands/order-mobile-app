// Mã gõ tay / quét QR ra mà không dùng được: trước đây thẻ vẫn sáng và chọn
// được, nút footer thành "Áp dụng", bấm xong máy chủ từ chối với toast chung
// "Voucher không hợp lệ" — khách không biết vì sao. Giờ nó cư xử như danh
// sách "Không khả dụng": thân thẻ mờ, không chọn được, lý do in ngay dưới thẻ
// và link "Điều kiện" không mờ.
import {
  fireEvent,
  render,
  screen,
  type RenderResult,
} from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { SearchResult } from '@/app/update-order/components/voucher-sheet-in-update-order/search-result'

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({ t: (k: string) => k }),
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

const voucher = {
  slug: 'v1',
  title: 'Giảm 30k',
  remainingUsage: 0,
  maxUsage: 0,
  voucherPaymentMethods: [],
}

const processed = (isValid: boolean) =>
  ({
    voucher,
    isValid,
    errorMessage: isValid ? '' : 'Chưa đủ giá trị đơn',
    expiryText: '',
    discountLabel: 'Giảm 30.000₫',
  }) as unknown as ProcessedVoucher

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

function setup(isValid: boolean) {
  const onSelect = jest.fn()
  const onViewCondition = jest.fn()
  render(
    <SearchResult
      isFetching={false}
      searchCode="ABC"
      fetchedVoucher={processed(isValid).voucher}
      processedFetched={processed(isValid)}
      selectedVoucher={null}
      onSelect={onSelect}
      onViewCondition={onViewCondition}
      isDark={false}
      primaryColor="#f59e0b"
    />,
  )
  return { onSelect, onViewCondition }
}

it('SR1 mã tìm ra không dùng được thì chạm thẻ không chọn', () => {
  const { onSelect } = setup(false)
  fireEvent.press(screen.getByText('Giảm 30k'))
  expect(onSelect).not.toHaveBeenCalled()
})

it('SR2 mã tìm ra không dùng được vẫn mở được Điều kiện', () => {
  const { onViewCondition } = setup(false)
  fireEvent.press(screen.getByText('condition'))
  expect(onViewCondition).toHaveBeenCalledWith(voucher)
})

it('SR3 mã tìm ra dùng được thì chạm thẻ là chọn', () => {
  const { onSelect } = setup(true)
  fireEvent.press(screen.getByText('Giảm 30k'))
  expect(onSelect).toHaveBeenCalledWith('v1')
})

it('SR4 mã tìm ra không dùng được thì in lý do dưới thẻ, không mờ', () => {
  setup(false)
  expect(isDimmed(screen.getByText('Chưa đủ giá trị đơn'))).toBe(false)
})

it('SR5 chỉ thân thẻ mờ, link "Điều kiện" không mờ', () => {
  setup(false)
  expect(isDimmed(screen.getByText('Giảm 30k'))).toBe(true)
  expect(isDimmed(screen.getByText('condition'))).toBe(false)
})

it('SR6 mã dùng được thì không mờ, không có dòng lý do', () => {
  setup(true)
  expect(isDimmed(screen.getByText('Giảm 30k'))).toBe(false)
  expect(screen.queryByTestId('voucher-unavailable-reason')).toBeNull()
})
