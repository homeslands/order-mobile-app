// Ánh xạ sự kiện của sheet → lý do đóng: onSessionExpiredUI dựa vào đúng
// lý do để quyết định về Home, chờ điều hướng, hay giữ nguyên màn hình.

type PanelProps = {
  onLoginSuccess: () => void
  onBeforeNavigate: () => void
}
type ModalProps = { onDismiss: () => void; children: React.ReactNode }

const mockClose = jest.fn()
const mockOnSuccess = jest.fn()
let mockPanelProps: PanelProps | null = null
let mockModalProps: ModalProps | null = null

jest.mock('@/components/auth', () => ({
  LoginPanel: (props: PanelProps) => {
    mockPanelProps = props
    return null
  },
}))

jest.mock('@/components/ui/glass-sheet-background', () => ({
  GlassSheetBackground: () => null,
}))

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: (props: ModalProps) => {
    mockModalProps = props
    return props.children
  },
  BottomSheetBackdrop: () => null,
  BottomSheetScrollView: ({ children }: { children: React.ReactNode }) =>
    children,
}))

jest.mock('@/stores/login-sheet.store', () => ({
  useLoginSheetStore: (
    selector: (s: {
      visible: boolean
      onSuccess: () => void
      close: (reason: string) => void
    }) => unknown,
  ) => selector({ visible: true, onSuccess: mockOnSuccess, close: mockClose }),
}))

import { render } from '@testing-library/react-native'

import LoginSheetPortal from '@/components/auth/login-sheet-portal'

describe('LoginSheetPortal — lý do đóng sheet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPanelProps = null
    mockModalProps = null
    render(<LoginSheetPortal />)
  })

  it("vuốt/bấm nền đóng sheet → close('dismissed')", () => {
    mockModalProps?.onDismiss()
    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(mockClose).toHaveBeenCalledWith('dismissed')
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("sang đăng ký/quên mật khẩu → close('navigated')", () => {
    mockPanelProps?.onBeforeNavigate()
    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(mockClose).toHaveBeenCalledWith('navigated')
    expect(mockOnSuccess).not.toHaveBeenCalled()
  })

  it("đăng nhập thành công → close('success') rồi mới onSuccess", () => {
    mockPanelProps?.onLoginSuccess()
    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(mockClose).toHaveBeenCalledWith('success')
    expect(mockOnSuccess).toHaveBeenCalledTimes(1)
    expect(mockClose.mock.invocationCallOrder[0]).toBeLessThan(
      mockOnSuccess.mock.invocationCallOrder[0],
    )
  })
})
