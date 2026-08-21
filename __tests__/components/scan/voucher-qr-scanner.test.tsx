// Ba hành vi dễ hỏng nhất của lớp phủ camera:
//   1. onBarcodeScanned bắn nhiều lần mỗi giây — chỉ được xử lý lần đầu
//   2. CameraView không bao giờ được dựng khi chưa có quyền hoặc khi ẩn
//   3. Mã sai định dạng phải chặn tại chỗ, không gọi ngược lên bên trên
import { act, render, fireEvent, screen } from '@testing-library/react-native'

import { VoucherQrScanner } from '@/components/scan/voucher-qr-scanner'
import type { ScanStatus } from '@/components/sheet/scan-status'

// Mọi biến được nhắc tới bên trong factory của jest.mock BẮT BUỘC phải bắt
// đầu bằng "mock" — jest hoist các lệnh mock lên đầu file và sẽ ném lỗi
// "not allowed to reference any out-of-scope variables" nếu đặt tên khác.
// Vì cùng lý do đó, bên trong factory chỉ dùng require, không dùng import.

// Trạng thái quyền thay đổi theo từng test
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = null
const mockRequestPermission = jest.fn(() => Promise.resolve())

// Giữ lại callback mà component truyền cho CameraView để bắn thủ công
let mockOnBarcodeScanned: ((r: { data: string }) => void) | null = null

jest.mock('expo-camera', () => ({
  CameraView: (props: { onBarcodeScanned?: (r: { data: string }) => void }) => {
    mockOnBarcodeScanned = props.onBarcodeScanned ?? null
    /* eslint-disable @typescript-eslint/no-require-imports */
    // Đặt tên khác "createElement": NativeWind babel plugin viết lại mọi
    // lệnh gọi có tên đúng "createElement" thành
    // _ReactNativeCSSInterop.createInteropElement(...), tham chiếu một biến
    // ngoài phạm vi factory — khiến jest-hoist báo lỗi "out-of-scope variable".
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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

// Màn quét là Modal toàn màn hình nên dùng useSafeAreaInsets cho footer;
// ngoài SafeAreaProvider hook này ném lỗi. initialWindowMetrics để undefined
// là an toàn — constants/status-bar đọc nó qua optional chaining.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  initialWindowMetrics: undefined,
}))

beforeEach(() => {
  mockPermission = { granted: true, canAskAgain: true }
  mockOnBarcodeScanned = null
  mockRequestPermission.mockClear()
})

const IDLE: ScanStatus = { kind: 'idle' }

// Scanner giờ là component trình bày: status do sheet đẩy vào. Helper này giữ
// các test cũ tập trung vào hành vi chốt quét, không lặp lại 4 prop mặc định.
function renderScanner(
  props: Partial<React.ComponentProps<typeof VoucherQrScanner>> = {},
) {
  const merged = {
    visible: true,
    status: IDLE,
    onScanned: jest.fn(),
    onRetry: jest.fn(),
    onConfirmReplace: jest.fn(),
    onClose: jest.fn(),
    ...props,
  }
  return { ...render(<VoucherQrScanner {...merged} />), props: merged }
}

describe('VoucherQrScanner', () => {
  it('không dựng CameraView khi visible = false', () => {
    renderScanner({ visible: false })
    expect(screen.queryByTestId('camera-view')).toBeNull()
  })

  it('không dựng CameraView khi chưa có quyền, hiện nút xin quyền', () => {
    mockPermission = { granted: false, canAskAgain: true }
    renderScanner()
    expect(screen.queryByTestId('camera-view')).toBeNull()
    expect(screen.getByText('scan.permAllow')).toBeTruthy()
  })

  it('gọi requestPermission khi bấm cho phép', () => {
    mockPermission = { granted: false, canAskAgain: true }
    renderScanner()
    fireEvent.press(screen.getByText('scan.permAllow'))
    expect(mockRequestPermission).toHaveBeenCalledTimes(1)
  })

  it('hiện hướng dẫn Cài đặt khi quyền bị từ chối vĩnh viễn', () => {
    mockPermission = { granted: false, canAskAgain: false }
    renderScanner()
    expect(screen.getByText('scan.openSettings')).toBeTruthy()
    expect(screen.queryByTestId('camera-view')).toBeNull()
  })

  it('chỉ gọi onScanned một lần dù camera bắn ba lần', () => {
    const onScanned = jest.fn()
    renderScanner({ onScanned })

    mockOnBarcodeScanned?.({ data: 'SUMMER30' })
    mockOnBarcodeScanned?.({ data: 'SUMMER30' })
    mockOnBarcodeScanned?.({ data: 'SUMMER30' })

    expect(onScanned).toHaveBeenCalledTimes(1)
    expect(onScanned).toHaveBeenCalledWith('SUMMER30')
  })

  it('cắt khoảng trắng nhưng GIỮ NGUYÊN hoa thường của mã', () => {
    const onScanned = jest.fn()
    renderScanner({ onScanned })

    mockOnBarcodeScanned?.({ data: '  summer30 ' })

    expect(onScanned).toHaveBeenCalledWith('summer30')
  })

  it('chặn mã sai định dạng tại chỗ và hiện thông báo', () => {
    const onScanned = jest.fn()
    renderScanner({ onScanned })

    act(() => {
      mockOnBarcodeScanned?.({ data: 'https://trendcoffee.vn' })
    })

    expect(onScanned).not.toHaveBeenCalled()
    expect(screen.getByText('scan.notAVoucher')).toBeTruthy()
  })

  it('mở lại chốt sau khi bấm quét lại', () => {
    const onScanned = jest.fn()
    renderScanner({ onScanned })

    act(() => {
      mockOnBarcodeScanned?.({ data: 'https://trendcoffee.vn' })
    })
    fireEvent.press(screen.getByText('scan.retry'))
    expect(screen.queryByText('scan.notAVoucher')).toBeNull()

    mockOnBarcodeScanned?.({ data: 'SUMMER30' })

    expect(onScanned).toHaveBeenCalledWith('SUMMER30')
  })

  it('mở lại chốt khi visible tắt rồi bật lại', () => {
    const onScanned = jest.fn()
    const shared = {
      status: IDLE,
      onScanned,
      onRetry: jest.fn(),
      onConfirmReplace: jest.fn(),
      onClose: jest.fn(),
    }
    const { rerender } = render(<VoucherQrScanner visible {...shared} />)

    mockOnBarcodeScanned?.({ data: 'SUMMER30' })

    rerender(<VoucherQrScanner visible={false} {...shared} />)
    rerender(<VoucherQrScanner visible {...shared} />)
    mockOnBarcodeScanned?.({ data: 'SUMMER30' })

    expect(onScanned).toHaveBeenCalledTimes(2)
  })
  it('hiện thông điệp đang kiểm tra khi status là checking', () => {
    renderScanner({ status: { kind: 'checking' } })
    expect(screen.getByText('scan.checking')).toBeTruthy()
    expect(screen.queryByText('scan.hint')).toBeNull()
  })

  it('hiện thông điệp đang áp dụng khi status là ready', () => {
    renderScanner({
      status: { kind: 'ready', voucher: { slug: 'v1' } as never },
    })
    expect(screen.getByText('scan.applying')).toBeTruthy()
  })

  it('hiện lỗi từ status ngay trong camera, kèm nút quét lại', () => {
    renderScanner({
      status: { kind: 'error', title: 'Đơn tối thiểu 200.000₫', detail: 'X' },
    })
    expect(screen.getByText('Đơn tối thiểu 200.000₫')).toBeTruthy()
    expect(screen.getByText('X')).toBeTruthy()
    expect(screen.getByText('scan.retry')).toBeTruthy()
  })

  it('bấm quét lại báo lên sheet để xoá kết quả cũ', () => {
    const onRetry = jest.fn()
    renderScanner({
      status: { kind: 'error', title: 'Không tìm thấy' },
      onRetry,
    })
    fireEvent.press(screen.getByText('scan.retry'))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hỏi trước khi thay voucher đang dùng, và chỉ thay khi bấm xác nhận', () => {
    const onConfirmReplace = jest.fn()
    const onRetry = jest.fn()
    renderScanner({
      status: {
        kind: 'confirmReplace',
        voucher: { slug: 'new' } as never,
        currentLabel: 'Giảm 50.000₫',
        nextLabel: 'Giảm 30.000₫',
      },
      onConfirmReplace,
      onRetry,
    })

    expect(screen.getByText('Giảm 50.000₫')).toBeTruthy()
    expect(screen.getByText('Giảm 30.000₫')).toBeTruthy()

    fireEvent.press(screen.getByText('scan.replaceKeep'))
    expect(onConfirmReplace).not.toHaveBeenCalled()
    expect(onRetry).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByText('scan.replaceConfirm'))
    expect(onConfirmReplace).toHaveBeenCalledTimes(1)
  })
  it('từ chối QR chứa URL — hợp đồng là mã trần, không phải đường dẫn', () => {
    const onScanned = jest.fn()
    renderScanner({ onScanned })

    act(() => {
      mockOnBarcodeScanned?.({
        data: 'https://sandbox.order.cmsiot.net/voucher/b3644671ed',
      })
    })

    expect(onScanned).not.toHaveBeenCalled()
    expect(screen.getByText('scan.notAVoucher')).toBeTruthy()
  })
})
