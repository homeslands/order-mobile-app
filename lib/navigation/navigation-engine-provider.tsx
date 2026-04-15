/**
 * Gắn router vào Navigation Engine khi app mount.
 * useLayoutEffect: set router sớm hơn useEffect → giảm race routerRef null lúc init.
 */
import { useRouter } from 'expo-router'
import { useLayoutEffect } from 'react'
import { setNavigationRouter } from './navigation-engine'

export function NavigationEngineProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useLayoutEffect(() => {
    setNavigationRouter(router as Parameters<typeof setNavigationRouter>[0])
    return () => setNavigationRouter(null)
  }, [router])

  return <>{children}</>
}
