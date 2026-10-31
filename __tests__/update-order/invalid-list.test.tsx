// Danh sách mã không dùng được ở màn thanh toán và sửa đơn. Thẻ đã bỏ dòng
// lý do, nên link "Điều kiện" là đường DUY NHẤT để khách biết vì sao mã không
// dùng được — nó phải bấm được. (Danh sách không nhận onSelect: mã không
// dùng được thì không chọn được.)
import { fireEvent, render, screen } from '@testing-library/react-native'

import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import { InvalidList } from '@/app/update-order/components/voucher-sheet-in-update-order/invalid-list'

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

const item = {
  voucher: {
    slug: 'v1',
    title: 'Giảm 30k',
    remainingUsage: 0,
    maxUsage: 0,
    voucherPaymentMethods: [],
  },
  isValid: false,
  errorMessage: 'Chưa đủ giá trị đơn',
  expiryText: '',
  discountLabel: 'Giảm 30.000₫',
} as unknown as ProcessedVoucher

function setup() {
  const onViewCondition = jest.fn()
  render(
    <InvalidList
      vouchers={[item]}
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
