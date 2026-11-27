import { usePathname } from 'expo-router'
import { memo, useEffect } from 'react'

import { useSessionExpiryStore } from '@/lib/auth/session-expiry'
import { onSessionExpiredUI } from '@/lib/auth/session-expiry-ui'

const SessionExpiryHandlerComponent = () => {
  const pending = useSessionExpiryStore((s) => s.pending)
  const pathname = usePathname()

  useEffect(() => {
    if (!pending) return
    useSessionExpiryStore.getState().consume()
    onSessionExpiredUI(pathname)
  }, [pending, pathname])

  return null
}

const SessionExpiryHandler = memo(SessionExpiryHandlerComponent)
export default SessionExpiryHandler
