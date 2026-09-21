// QrCamera không biết gì về voucher hay thanh toán: mọi chữ do bên gọi đưa
// vào qua `labels`, nên test dùng chính tên key làm giá trị để dễ tìm.
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import {
  QrCamera,
  type QrCameraLabels,
  type QrCameraStatus,
} from '@/components/scan/qr-camera'

// Biến dùng trong factory của jest.mock phải bắt đầu bằng "mock" (jest hoist).
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = null
const mockRequestPermission = jest.fn(() => Promise.resolve())
let mockOnBarcodeScanned: ((r: { data: string }) => void) | null = null

jest.mock('expo-camera', () => ({
  CameraView: (props: { onBarcodeScanned?: (r: { data: string }) => void }) => {
    mockOnBarcodeScanned = props.onBarcodeScanned ?? null
    /* eslint-disable @typescript-eslint/no-require-imports */
    // Không đặt tên "createElement": NativeWind babel plugin viết lại lệnh gọi
    // đó và tham chiếu biến ngoài factory.
    const { createElement: h } = require('react')
    const { View } = require('react-native')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return h(View, { testID: 'camera-view' })
  },
  useCameraPermissions: () => [mockPermission, mockRequestPermission],
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  initialWindowMetrics: undefined,
}))

const LABELS: QrCameraLabels = {
  title: 'title',
  closeA11y: 'closeA11y',
  hint: 'hint',
  hintSource: 'hintSource',
  rejectedTitle: 'rejectedTitle',
  rejectedHint: 'rejectedHint',
  retry: 'retry',
  permTitle: 'permTitle',
  permBody: 'permBody',
  permDeniedTitle: 'permDeniedTitle',
  permDeniedBody: 'permDeniedBody',
  permAllow: 'permAllow',
  openSettings: 'openSettings',
  permDismiss: 'permDismiss',
}

const IDLE: QrCameraStatus = { kind: 'idle' }

// Chỉ nhận chuỗi bắt đầu bằng "OK-" để thử cả hai nhánh của parse.
const parseOk = (raw: string) => (raw.startsWith('OK-') ? raw : null)

function renderCamera(
  props: Partial<React.ComponentProps<typeof QrCamera>> = {},
) {
  const merged = {
    labels: LABELS,
    parse: parseOk,
    onScanned: jest.fn(),
    status: IDLE,
    onRetry: jest.fn(),
    onClose: jest.fn(),
    ...props,
  }
  return { ...render(<QrCamera {...merged} />), props: merged }
}

beforeEach(() => {
  mockPermission = { granted: true, canAskAgain: true }
  mockOnBarcodeScanned = null
  mockRequestPermission.mockClear()
})

describe('QrCamera', () => {
  it('không dựng CameraView khi chưa có quyền, hiện nút xin quyền', () => {
    mockPermission = { granted: false, canAskAgain: true }
    renderCamera()
    expect(screen.queryByTestId('camera-view')).toBeNull()
    fireEvent.press(screen.getByText('permAllow'))
    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
  })

  it('quyền bị chặn vĩnh viễn thì hiện nút mở Cài đặt', () => {
    mockPermission = { granted: false, canAskAgain: false }
    renderCamera()
    expect(screen.getByText('openSettings')).toBeTruthy()
    expect(screen.getByText('permDeniedTitle')).toBeTruthy()
  })

  it('nút phụ trên panel quyền gọi onClose', () => {
    mockPermission = { granted: false, canAskAgain: true }
    const onClose = jest.fn()
    renderCamera({ onClose })
    fireEvent.press(screen.getByText('permDismiss'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('chỉ gọi onScanned một lần dù camera bắn nhiều lần', () => {
    const onScanned = jest.fn()
    renderCamera({ onScanned })
    mockOnBarcodeScanned?.({ data: 'OK-1' })
    mockOnBarcodeScanned?.({ data: 'OK-1' })
    expect(onScanned).toHaveBeenCalledTimes(1)
    expect(onScanned).toHaveBeenCalledWith('OK-1')
  })

  it('parse trả null thì báo lỗi tại chỗ, hiện chuỗi thô, không gọi onScanned', () => {
    const onScanned = jest.fn()
    renderCamera({ onScanned })
    act(() => {
      mockOnBarcodeScanned?.({ data: 'https://x.vn' })
    })
    expect(onScanned).not.toHaveBeenCalled()
    expect(screen.getByText('rejectedTitle')).toBeTruthy()
    expect(screen.getByText('https://x.vn')).toBeTruthy()
  })

  it('Quét lại sau khi bị từ chối thì mở khoá và gọi onRetry', () => {
    const onScanned = jest.fn()
    const onRetry = jest.fn()
    renderCamera({ onScanned, onRetry })
    act(() => {
      mockOnBarcodeScanned?.({ data: 'bad' })
    })
    fireEvent.press(screen.getByText('retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('rejectedTitle')).toBeNull()
    mockOnBarcodeScanned?.({ data: 'OK-2' })
    expect(onScanned).toHaveBeenCalledWith('OK-2')
  })

  it('status busy hiện nhãn, không hiện hướng dẫn', () => {
    renderCamera({ status: { kind: 'busy', label: 'Đang kiểm tra' } })
    expect(screen.getByText('Đang kiểm tra')).toBeTruthy()
    expect(screen.queryByText('hint')).toBeNull()
  })

  it('status error hiện tiêu đề, chi tiết và nút Quét lại mở khoá', () => {
    const onScanned = jest.fn()
    const onRetry = jest.fn()
    renderCamera({
      onScanned,
      onRetry,
      status: { kind: 'error', title: 'Mã đã bị huỷ', detail: 'D' },
    })
    mockOnBarcodeScanned?.({ data: 'OK-1' })
    expect(screen.getByText('Mã đã bị huỷ')).toBeTruthy()
    expect(screen.getByText('D')).toBeTruthy()
    fireEvent.press(screen.getByText('retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    mockOnBarcodeScanned?.({ data: 'OK-3' })
    expect(onScanned).toHaveBeenLastCalledWith('OK-3')
  })

  it('renderCenter thay khối giữa và nhận hàm retry mở khoá', () => {
    const onScanned = jest.fn()
    const onRetry = jest.fn()
    const { Pressable, Text } = jest.requireActual('react-native')
    renderCamera({
      onScanned,
      onRetry,
      renderCenter: (retry) => (
        <Pressable onPress={retry}>
          <Text>custom</Text>
        </Pressable>
      ),
    })
    mockOnBarcodeScanned?.({ data: 'OK-1' })
    fireEvent.press(screen.getByText('custom'))
    expect(onRetry).toHaveBeenCalledTimes(1)
    mockOnBarcodeScanned?.({ data: 'OK-4' })
    expect(onScanned).toHaveBeenLastCalledWith('OK-4')
  })

  it('hiện footer do bên gọi đưa vào', () => {
    const { Text } = jest.requireActual('react-native')
    renderCamera({ footer: <Text>footer</Text> })
    expect(screen.getByText('footer')).toBeTruthy()
  })
})
