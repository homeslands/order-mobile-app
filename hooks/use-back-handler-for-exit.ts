/**
 * Double-back-to-exit cho Android.
 * Khi ở root (tabs), lần back đầu hiện toast, lần thứ 2 trong 2s → exit.
 * Tránh thoát app nhầm trên low-end Android.
 *
 * Effect chỉ subscribe BackHandler đúng một lần (deps: []). t/router thay đổi
 * theo language hoặc navigation — đọc từ refs để tránh re-subscribe.
 */
import { useRouter } from 'expo-router'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { BackHandler, Platform } from 'react-native'

import { showToast } from '@/utils'

const EXIT_DELAY_MS = 2000

export function useBackHandlerForExit() {
  const router = useRouter()
  const { t: tToast } = useTranslation('toast')

  const lastBackPress = useRef(0)
  const tToastRef = useRef(tToast)
  const routerRef = useRef(router)

  useEffect(() => {
    tToastRef.current = tToast
  }, [tToast])

  useEffect(() => {
    routerRef.current = router
  }, [router])

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const onBackPress = () => {
      if (routerRef.current.canGoBack()) {
        return false // Let default (pop) happen
      }

      const now = Date.now()
      if (now - lastBackPress.current < EXIT_DELAY_MS) {
        lastBackPress.current = 0
        BackHandler.exitApp()
        return true
      }

      lastBackPress.current = now
      showToast(tToastRef.current('toast.pressBackToExit'), 'info')
      return true
    }

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress)
    return () => sub.remove()
  }, [])
}
