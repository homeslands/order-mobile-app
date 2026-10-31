// Dòng lời chào dưới banner trên Home (thay cho header logo): ảnh đại diện,
// "Xin chào, <tên>", và chuông thông báo.
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { HomeGreeting } from '@/components/home/home-greeting'
import { publicFileURL } from '@/constants'

type MockUser = { firstName: string; lastName: string; image?: string } | null
const mockUserState: { userInfo: MockUser } = { userInfo: null }

jest.mock('@/stores', () => ({
  useUserStore: (sel: (s: typeof mockUserState) => unknown) =>
    sel(mockUserState),
}))

jest.mock('@/components/notification/notification-bell', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { Text } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return { NotificationBell: () => h(Text, null, '[BELL]') }
})

jest.mock('expo-image', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { View } = require('react-native')
  const { createElement: h } = require('react')
  /* eslint-enable @typescript-eslint/no-require-imports */
  return {
    Image: (props: Record<string, unknown>) =>
      h(View, { ...props, testID: 'home-avatar-image' }),
  }
})

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string) =>
      key.split('.').reduce<unknown>(
        (acc, k) =>
          acc && typeof acc === 'object'
            ? (acc as Record<string, unknown>)[k]
            : undefined,
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('@/i18n/vi/home.json').home,
      ) ?? key,
  }),
}))

beforeEach(() => {
  mockUserState.userInfo = null
})

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('HomeGreeting', () => {
  it('GR1 đã đăng nhập: chào bằng tên, ảnh đại diện là chữ cái đầu', () => {
    mockUserState.userInfo = { firstName: 'Thắng', lastName: 'Phan' }
    render(<HomeGreeting />)
    expect(screen.getByText('Xin chào,')).toBeTruthy()
    expect(screen.getByText('Thắng')).toBeTruthy()
    expect(screen.getByText('T')).toBeTruthy()
  })

  it('GR2 chưa đăng nhập: chỉ "Xin chào", không tên', () => {
    render(<HomeGreeting />)
    expect(screen.getByText('Xin chào')).toBeTruthy()
    expect(screen.queryByText('Thắng')).toBeNull()
  })

  it('GR3 luôn có chuông thông báo', () => {
    render(<HomeGreeting />)
    expect(screen.getByText('[BELL]')).toBeTruthy()
  })

  it('GR4 ảnh đường dẫn tương đối: ghép publicFileURL như màn Profile', () => {
    mockUserState.userInfo = {
      firstName: 'Thắng',
      lastName: 'Phan',
      image: '/avatars/u1.jpg',
    }
    render(<HomeGreeting />)
    const img = screen.getByTestId('home-avatar-image')
    expect((img.props.source as { uri: string }).uri).toBe(
      `${publicFileURL}/avatars/u1.jpg`,
    )
  })

  it('GR5 nút chuông đủ vùng chạm 44pt (Apple HIG)', () => {
    render(<HomeGreeting />)
    const bell = StyleSheet.flatten(screen.getByTestId('home-bell').props.style)
    expect(bell.width).toBeGreaterThanOrEqual(44)
    expect(bell.height).toBeGreaterThanOrEqual(44)
  })
})
