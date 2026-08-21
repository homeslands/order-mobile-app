import { useUserStore, useAuthStore } from '@/stores'
import { AuthState } from '@/types'

/**
 * Kiểm tra xem có cần load userInfo không
 * Sử dụng bên ngoài auth store để tránh circular dependency
 */
export const checkNeedsUserInfo = (): boolean => {
  const userStore = useUserStore.getState()
  return !userStore.userInfo
}

/**
 * Lấy auth state với đầy đủ logic kiểm tra userInfo
 */
export const getDetailedAuthState = (): AuthState => {
  // Import auth store methods
  const authStore = useAuthStore.getState()

  if (authStore.isRefreshing) {
    return AuthState.REFRESHING
  }

  if (!authStore.isTokenValid()) {
    return AuthState.UNAUTHENTICATED
  }

  // Kiểm tra xem có cần userInfo không
  if (checkNeedsUserInfo()) {
    return AuthState.LOADING
  }

  return AuthState.AUTHENTICATED
}

/**
 * Check authentication với userInfo consideration
 */
export const isFullyAuthenticated = (): boolean => {
  return getDetailedAuthState() === AuthState.AUTHENTICATED
}

/**
 * Check nếu đang trong trạng thái loading (có token nhưng chưa có userInfo)
 */
export const isAuthLoading = (): boolean => {
  return getDetailedAuthState() === AuthState.LOADING
}

/**
 * Hồ sơ bắt buộc phải có đủ họ, tên và ngày sinh.
 *
 * Người dùng đã đăng nhập đầy đủ TRƯỚC khi tới màn điền hồ sơ (xem
 * register-otp-password-step.tsx — handleAuthSuccess lưu token rồi mới điều
 * hướng), nên nếu không có cổng này thì chỉ cần tắt app là bỏ qua được bước
 * điền và không bao giờ bị hỏi lại.
 */
export const isProfileIncomplete = (
  info: {
    firstName?: string | null
    lastName?: string | null
    dob?: string | null
  } | null,
): boolean => {
  if (!info) return false
  return !info.firstName || !info.lastName || !info.dob
}

/** Có phải điều hướng về màn hoàn tất hồ sơ ngay khi mở app không. */
export const needsProfileCompletion = (): boolean => {
  // isAuthenticated là hàm (tự kiểm tra hạn token), không phải cờ boolean.
  if (!useAuthStore.getState().isAuthenticated()) return false
  return isProfileIncomplete(useUserStore.getState().userInfo)
}
