// Use cases E1–E2 (lối vào "Quét QR trả đơn" trong components/profile/
// qr-selection-sheet.tsx) và D1–D2 (app/payment/payment-point-confirm-dialog).
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import { PointConfirmDialog } from '@/app/payment/payment-point-confirm-dialog'
import QRSelectionSheet from '@/components/profile/qr-selection-sheet'
import { scheduleTransitionTask } from '@/lib/navigation'
import { useQRSelectionSheetStore } from '@/stores/qr-selection-sheet.store'

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  initialWindowMetrics: undefined,
}))

jest.mock('@gorhom/bottom-sheet', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { createElement: h, forwardRef, useImperativeHandle } = require('react')
  const { View } = require('react-native')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const BottomSheetModal = forwardRef(
    (props: { children: unknown }, ref: unknown) => {
      useImperativeHandle(ref, () => ({ present: () => {}, dismiss: () => {} }))
      return h(View, null, props.children)
    },
  )
  return {
    BottomSheetModal,
    BottomSheetScrollView: (props: { children: unknown }) =>
      h(View, null, props.children),
    BottomSheetBackdrop: () => null,
  }
})

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@/lib/navigation', () => ({
  scheduleTransitionTask: jest.fn(),
}))

let mockAuthed = true
jest.mock('@/stores', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: () => mockAuthed }) },
}))

// t(key) trả key; bảng mockDict dịch vài key khi case cần (đơn vị xu).
const mockDict: Record<string, string> = {}
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) => mockDict[key] ?? key,
    i18n: { language: 'vi' },
  }),
}))

afterEach(() => {
  // Xem ghi chú ở point-confirm.test.tsx: đọc global lười của jest-expo trước
  // khi môi trường test đóng.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('qr-selection-sheet entry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useQRSelectionSheetStore.setState({ visible: true })
  })

  function tapScanPayAndRunTask() {
    render(<QRSelectionSheet />)
    fireEvent.press(screen.getByText('profile.qr.scanPay'))
    expect(scheduleTransitionTask).toHaveBeenCalledTimes(1)
    // push chỉ chạy khi task được lên lịch chạy, không chạy ngay.
    expect(mockPush).not.toHaveBeenCalled()
    const task = jest.mocked(scheduleTransitionTask).mock.calls[0][0]
    act(() => {
      task()
    })
  }

  it('E1 logged in: scanPay schedules push to /payment/scan-point', () => {
    mockAuthed = true
    tapScanPayAndRunTask()
    expect(mockPush).toHaveBeenCalledWith('/payment/scan-point')
    expect(useQRSelectionSheetStore.getState().visible).toBe(false)
  })

  it('E2 logged out: scanPay pushes /auth/login', () => {
    mockAuthed = false
    tapScanPayAndRunTask()
    expect(mockPush).toHaveBeenCalledWith('/auth/login')
  })
})

describe('PointConfirmDialog', () => {
  const setup = () => {
    const onClose = jest.fn()
    const onConfirm = jest.fn()
    render(
      <PointConfirmDialog
        visible
        onClose={onClose}
        onConfirm={onConfirm}
        orderSubtotal={6400}
        coinBalance={390600}
        primaryColor="#f7a737"
        isDark={false}
      />,
    )
    return { onClose, onConfirm }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Giá trị khác "xu" mặc định để chắc đơn vị lấy từ i18n chứ không từ
    // chuỗi dự phòng.
    mockDict['paymentMethod.coinUnit'] = 'XU_I18N'
  })

  it('D1 shows balance, −amount and balance after with i18n coin unit', () => {
    setup()
    expect(screen.getByText('390.600 XU_I18N')).toBeTruthy()
    expect(screen.getByText('-6.400 XU_I18N')).toBeTruthy()
    // Khớp chính xác cả chuỗi nên cũng chứng minh không có hai dấu cách.
    expect(screen.getByText('384.200 XU_I18N')).toBeTruthy()
  })

  it('D2 confirm label is common.confirm; cancel closes; confirm confirms', () => {
    const { onClose, onConfirm } = setup()
    expect(screen.getByText('common:common.confirm')).toBeTruthy()
    fireEvent.press(screen.getByText('common:common.cancel'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    screen.unmount()

    // Huỷ xong hộp thoại tự gỡ — dựng lại để thử nút xác nhận.
    const second = setup()
    fireEvent.press(screen.getByText('common:common.confirm'))
    expect(second.onConfirm).toHaveBeenCalledTimes(1)
    expect(second.onClose).not.toHaveBeenCalled()
  })
})
