// Mất mạng / hết thời gian chờ: các màn Xu, Lịch sử đơn, Thông báo từng hiện
// "Xu = 0", "Bạn chưa có đơn hàng nào", "Không có thông báo" — khách tưởng
// mất tiền, mất đơn. Giờ hiện trạng thái lỗi có nút Thử lại, số dư chưa tải
// được hiện "—" thay vì 0.
import { fireEvent, render, screen } from '@testing-library/react-native'

import {
  QueryErrorState,
  formatLoadedValue,
  shouldShowQueryError,
} from '@/components/ui/query-error-state'

jest.mock('react-i18next', () => ({
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

it('QE1 hiện thông báo lỗi và nút thử lại gọi onRetry', () => {
  const onRetry = jest.fn()
  render(<QueryErrorState onRetry={onRetry} />)
  expect(screen.getByText('common.loadError.title')).toBeTruthy()
  fireEvent.press(screen.getByText('common.loadError.retry'))
  expect(onRetry).toHaveBeenCalledTimes(1)
})

it('QE2 chỉ hiện lỗi khi lỗi và chưa có dữ liệu nào để xem', () => {
  expect(shouldShowQueryError({ isError: true, hasData: false })).toBe(true)
  // Có dữ liệu cũ: giữ dữ liệu cũ, không che bằng màn lỗi.
  expect(shouldShowQueryError({ isError: true, hasData: true })).toBe(false)
  expect(shouldShowQueryError({ isError: false, hasData: false })).toBe(false)
})

it('QE3 số dư chưa tải được hiện "—", không hiện 0', () => {
  const fmt = (n: number) => `${n} xu`
  expect(formatLoadedValue(undefined, fmt)).toBe('—')
  expect(formatLoadedValue(0, fmt)).toBe('0 xu')
  expect(formatLoadedValue(1200, fmt)).toBe('1200 xu')
})
