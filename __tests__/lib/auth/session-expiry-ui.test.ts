const mockShowToast = jest.fn()
const mockReplace = jest.fn()
const mockRemoveUserInfo = jest.fn()

jest.mock('@/utils/toast', () => ({
  showToast: (...a: unknown[]) => mockShowToast(...a),
}))
jest.mock('@/lib/navigation', () => ({
  navigateWhenUnlocked: { replace: (...a: unknown[]) => mockReplace(...a) },
}))
jest.mock('@/lib/navigation/transition-task-queue', () => ({
  scheduleTransitionTask: (fn: () => void) => fn(),
}))
jest.mock('@/stores/user.store', () => ({
  useUserStore: { getState: () => ({ removeUserInfo: mockRemoveUserInfo }) },
}))

import {
  isLoginRequiredRoute,
  LOGIN_REQUIRED_ROUTES,
} from '@/lib/auth/login-required-routes'
import { onSessionExpiredUI } from '@/lib/auth/session-expiry-ui'
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
    jest.clearAllMocks()
    useLoginSheetStore.setState({
      visible: false,
      onSuccess: null,
      onClose: null,
    })
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
      expect(mockRemoveUserInfo).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it('dismissed: về Home trước, rồi removeUserInfo', () => {
      useLoginSheetStore.getState().close('dismissed')
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home')
      expect(mockRemoveUserInfo).toHaveBeenCalledTimes(1)
      expect(mockReplace.mock.invocationCallOrder[0]).toBeLessThan(
        mockRemoveUserInfo.mock.invocationCallOrder[0],
      )
    })

    it('navigated: removeUserInfo, không điều hướng', () => {
      useLoginSheetStore.getState().close('navigated')
      expect(mockRemoveUserInfo).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
    })
  })
})
