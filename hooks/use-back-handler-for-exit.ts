/**
 * Double-back-to-exit cho Android.
 * Khi ở root (tabs), lần back đầu hiện toast, lần thứ 2 trong 2s → exit.
 * Tránh thoát app nhầm trên low-end Android.
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { BackHandler, Platform } from 'react-native'

import { showToast } from '@/utils'

const EXIT_DELAY_MS = 2000

export function useBackHandlerForExit() {
  const router = useRouter()
  const lastBackPress = useRef(0)

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const onBackPress = () => {
      if (router.canGoBack()) {
        return false // Let default (pop) happen
      }

      const now = Date.now()
      if (now - lastBackPress.current < EXIT_DELAY_MS) {
        lastBackPress.current = 0
        BackHandler.exitApp()
        return true
      }

      lastBackPress.current = now
      showToast('Nhấn lại để thoát', 'Thông báo')
      return true
    }

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => sub.remove()
  }, [router])
}
