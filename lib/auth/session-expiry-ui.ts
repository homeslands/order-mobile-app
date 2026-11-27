import { router } from 'expo-router'

import { isLoginRequiredRoute } from '@/lib/auth/login-required-routes'
import { STACK_TRANSITION_DURATION_MS } from '@/lib/navigation/constants'
import {
  useLoginSheetStore,
  type LoginSheetCloseReason,
} from '@/stores/login-sheet.store'
import { useUserStore } from '@/stores/user.store'
import { showToast } from '@/utils/toast'

const removeUserInfo = () => useUserStore.getState().removeUserInfo()

// Wait for the stack transition to finish: while the login-required screen is
// still focused, its own guard (<Redirect href="/auth/login" />, back()) would
// react to the missing userInfo and win the navigation.
const removeUserInfoAfterTransition = () => {
  setTimeout(removeUserInfo, STACK_TRANSITION_DURATION_MS)
}

/**
 * UI reaction to a session that died while the app is in use. Token clearing
 * is already done by expireSession; userInfo removal is owned here.
 */
export function onSessionExpiredUI(pathname: string): void {
  showToast('toast.sessionExpired', 'warning')

  if (!isLoginRequiredRoute(pathname)) {
    removeUserInfo()
    return
  }

  useLoginSheetStore
    .getState()
    .open(undefined, (reason: LoginSheetCloseReason) => {
      if (reason === 'success') return
      if (reason === 'dismissed') {
        // dismissTo instead of replace: login-required screens live on the
        // root stack, replace('/(tabs)/…') there pushes a second tab navigator
        // instead of switching the existing one.
        router.dismissTo('/(tabs)/home')
      }
      // 'navigated': LoginPanel is pushing register/forgot-password right now
      removeUserInfoAfterTransition()
    })
}
