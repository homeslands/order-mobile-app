// Test host-level: app/profile/settings.tsx phải có lối vào "Đổi mật khẩu"
// khi đã đăng nhập. Trước đây màn change-password chỉ được push từ
// app/profile/index.tsx — màn cũ đã bị tab Tài khoản che — nên khách đang
// đăng nhập không có cách nào đổi mật khẩu.

const mockPush = jest.fn()
let mockUserInfo: { phonenumber: string } | null = null

// t() trả về key để test bám theo key i18n, không phụ thuộc chuỗi dịch.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}))

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ removeQueries: jest.fn() }),
}))

jest.mock('@/components/navigation', () => ({ FloatingHeader: () => null }))

jest.mock('@/components/profile', () => {
  const { Pressable, Text } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native') as typeof import('react-native')
  return {
    ProfileMenuItem: ({
      title,
      onPress,
    }: {
      title: string
      onPress?: () => void
    }) => (
      <Pressable onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    ),
    DeleteAccountSheet: () => null,
    FontSizeSheet: () => null,
    LanguageSheet: () => null,
    ThemeSheet: () => null,
    profileCardStyles: { card: {}, divider: {} },
  }
})

jest.mock('@/lib/biometric-login', () => ({
  biometricLabelKey: () => 'biometric.faceId',
  disableBiometricLogin: jest.fn(),
  getBiometricType: () => Promise.resolve(null),
  getEnabledPhone: () => Promise.resolve(null),
}))

jest.mock('@/stores', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ setLogout: jest.fn() }),
  useUserStore: Object.assign(
    (selector: (s: unknown) => unknown) =>
      selector({ userInfo: mockUserInfo, removeUserInfo: jest.fn() }),
    { getState: () => ({ deviceToken: undefined }) },
  ),
}))

jest.mock('@/stores/notification.store', () => ({
  useNotificationStore: { getState: () => ({ clearAll: jest.fn() }) },
}))

jest.mock('@/utils/http', () => ({ resetHttpState: jest.fn() }))

import { fireEvent, render, waitFor } from '@testing-library/react-native'

import SettingsScreen from '@/app/profile/settings'

describe('app/profile/settings.tsx — lối vào Đổi mật khẩu', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('đã đăng nhập: hiện dòng Đổi mật khẩu, bấm thì mở /profile/change-password', async () => {
    mockUserInfo = { phonenumber: '0900000000' }
    const { getByText } = render(<SettingsScreen />)

    fireEvent.press(getByText('profile.changePassword.title'))

    expect(mockPush).toHaveBeenCalledWith('/profile/change-password')
    // Chờ effect đọc trạng thái sinh trắc học xong để không rò act() warning.
    await waitFor(() => expect(getByText('profile.fontSize.title')))
  })

  it('chưa đăng nhập: không hiện dòng Đổi mật khẩu', async () => {
    mockUserInfo = null
    const { queryByText, getByText } = render(<SettingsScreen />)

    expect(queryByText('profile.changePassword.title')).toBeNull()
    await waitFor(() => expect(getByText('profile.fontSize.title')))
  })
})
