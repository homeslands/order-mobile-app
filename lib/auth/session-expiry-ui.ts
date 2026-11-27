import { isLoginRequiredRoute } from '@/lib/auth/login-required-routes'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { scheduleTransitionTask } from '@/lib/navigation/transition-task-queue'
import {
  useLoginSheetStore,
  type LoginSheetCloseReason,
} from '@/stores/login-sheet.store'
import { useUserStore } from '@/stores/user.store'
import { showToast } from '@/utils/toast'

const removeUserInfo = () => useUserStore.getState().removeUserInfo()

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
        // Go Home first so the screen's own <Redirect href="/auth/login" />
        // (fired once userInfo is gone) cannot win the navigation.
        navigateWhenUnlocked.replace('/(tabs)/home')
        scheduleTransitionTask(removeUserInfo)
        return
      }
      removeUserInfo()
    })
}
