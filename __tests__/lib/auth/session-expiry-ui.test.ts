const mockShowToast = jest.fn()
const mockDismissTo = jest.fn()
const mockRemoveUserInfo = jest.fn()

jest.mock('@/utils/toast', () => ({
  showToast: (...a: unknown[]) => mockShowToast(...a),
}))
jest.mock('expo-router', () => ({
  router: { dismissTo: (...a: unknown[]) => mockDismissTo(...a) },
}))
jest.mock('@/stores/user.store', () => ({
  useUserStore: { getState: () => ({ removeUserInfo: mockRemoveUserInfo }) },
}))

import {
  isLoginRequiredRoute,
  LOGIN_REQUIRED_ROUTES,
} from '@/lib/auth/login-required-routes'
import { onSessionExpiredUI } from '@/lib/auth/session-expiry-ui'
import { STACK_TRANSITION_DURATION_MS } from '@/lib/navigation/constants'
import { useLoginSheetStore } from '@/stores/login-sheet.store'

describe('isLoginRequiredRoute', () => {
  it.each([
    '/profile/history',
    '/profile/coin-hub',
    '/profile/gift-card-hub',
    '/profile/gift-card-orders',
    '/profile/gift-cards',
    '/profile/loyalty-point',
    '/profile/loyalty-point-hub',
    '/profile/edit',
    '/profile/info',
    '/profile/general-info',
    '/profile/change-password',
    '/profile/verify-email',
    '/profile/verify-phone-number',
    '/notification',
    '/gift-card/checkout',
    '/gift-card/checkout/abc',
  ])('true cho %s', (p) => {
    expect(isLoginRequiredRoute(p)).toBe(true)
  })

  it.each([
    '/profile',
    '/profile/settings',
    '/home',
    '/menu',
    '/payment/ORD1',
    '/order/1',
    '/update-order/x',
    '/profile-x',
  ])('false cho %s', (p) => {
    expect(isLoginRequiredRoute(p)).toBe(false)
  })

  it('danh sách không rỗng', () => {
    expect(LOGIN_REQUIRED_ROUTES.length).toBeGreaterThan(0)
  })
})

describe('onSessionExpiredUI', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    useLoginSheetStore.setState({
      visible: false,
      onSuccess: null,
      onClose: null,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('màn thường: toast một lần, removeUserInfo ngay, không mở sheet', () => {
    onSessionExpiredUI('/menu')

    expect(mockShowToast).toHaveBeenCalledTimes(1)
    expect(mockShowToast).toHaveBeenCalledWith(
      'toast.sessionExpired',
      'warning',
    )
    expect(mockRemoveUserInfo).toHaveBeenCalledTimes(1)
    expect(useLoginSheetStore.getState().visible).toBe(false)
  })

  describe('màn cần đăng nhập', () => {
    beforeEach(() => onSessionExpiredUI('/profile/history'))

    it('toast một lần, mở sheet, chưa removeUserInfo', () => {
      expect(mockShowToast).toHaveBeenCalledTimes(1)
      expect(mockShowToast).toHaveBeenCalledWith(
        'toast.sessionExpired',
        'warning',
      )
      expect(useLoginSheetStore.getState().visible).toBe(true)
      expect(mockRemoveUserInfo).not.toHaveBeenCalled()
    })

    it('success: không removeUserInfo, không điều hướng', () => {
      useLoginSheetStore.getState().close('success')
      jest.runAllTimers()
      expect(mockRemoveUserInfo).not.toHaveBeenCalled()
      expect(mockDismissTo).not.toHaveBeenCalled()
    })

    it('dismissed: dismissTo Home (không replace — tránh nhân đôi bộ tab)', () => {
      useLoginSheetStore.getState().close('dismissed')
      expect(mockDismissTo).toHaveBeenCalledTimes(1)
      expect(mockDismissTo).toHaveBeenCalledWith('/(tabs)/home')
    })

    it('dismissed: removeUserInfo chỉ chạy sau khi transition xong', () => {
      useLoginSheetStore.getState().close('dismissed')
      expect(mockRemoveUserInfo).not.toHaveBeenCalled()
      jest.advanceTimersByTime(STACK_TRANSITION_DURATION_MS - 1)
      expect(mockRemoveUserInfo).not.toHaveBeenCalled()
      jest.advanceTimersByTime(1)
      expect(mockRemoveUserInfo).toHaveBeenCalledTimes(1)
    })

    it('navigated: không điều hướng, removeUserInfo chỉ chạy sau khi transition xong', () => {
      useLoginSheetStore.getState().close('navigated')
      expect(mockRemoveUserInfo).not.toHaveBeenCalled()
      jest.advanceTimersByTime(STACK_TRANSITION_DURATION_MS - 1)
      expect(mockRemoveUserInfo).not.toHaveBeenCalled()
      jest.advanceTimersByTime(1)
      expect(mockRemoveUserInfo).toHaveBeenCalledTimes(1)
      expect(mockDismissTo).not.toHaveBeenCalled()
    })
  })
})
