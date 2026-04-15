import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { focusManager, MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as SplashScreen from 'expo-splash-screen'
import * as SystemUI from 'expo-system-ui'

import { NativeStackWithMasterTransition } from '@/layouts/stack-with-master-transition'
import { useBeVietnamProFont } from '@/lib/fonts/be-vietnam-pro'
import { MasterTransitionProvider } from '@/lib/navigation/master-transition-provider'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import {
  AppState,
  InteractionManager,
  Platform,
  useColorScheme,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import LogoutSheetPortal from '@/components/profile/logout-sheet-portal'
import QRSelectionSheet from '@/components/profile/qr-selection-sheet'
import ScanSheetPortal from '@/components/profile/scan-sheet-portal'
import { applyTheme, useThemeStore } from '@/stores/theme.store'
import { useBackHandlerForExit } from '@/hooks'
import {
  setNavigationBarColorFixed,
  useNavigationBarFixed,
} from '@/hooks/use-navigation-bar-fixed'
import '@/lib/http-setup'
import { NavigationEngineProvider } from '@/lib/navigation'
import { isNotificationNavigationPending } from '@/lib/notification-navigation'
import { SharedElementProvider } from '@/lib/shared-element'
import '@/lib/store-sync-setup'
import { AppToastProvider, I18nProvider } from '@/providers'
import { showErrorToast } from '@/utils/toast'
import { NotificationProvider } from '@/providers/notification-provider'

import './global.css'

import { resetReactProfilerStats } from '@/lib/qa/react-profiler-logger'

SplashScreen.preventAutoHideAsync().catch(() => {})

// Global error handlers (keep awake suppress)
// Lỗi này đến từ expo-modules-core khi một dependency cố gắng activate keep awake
// nhưng không thành công (có thể do không có quyền hoặc không được setup đúng)

// Sync errors
if (__DEV__ && typeof ErrorUtils !== 'undefined') {
  const originalErrorHandler = ErrorUtils.getGlobalHandler()
  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    const errorMessage = error?.message || String(error)

    // Suppress lỗi keep awake - không ảnh hưởng đến chức năng
    if (
      errorMessage.includes('Unable to activate keep awake') ||
      errorMessage.includes('keep awake')
    ) {
      // Silently ignore - không cần thiết cho app này
      return
    }

    // Gọi original handler cho các lỗi khác
    if (originalErrorHandler) {
      originalErrorHandler(error, isFatal)
    }
  })
}

// Unhandled promise rejections
if (typeof global !== 'undefined' && !global.onunhandledrejection) {
  global.onunhandledrejection = function (event: PromiseRejectionEvent) {
    const error = event?.reason as Error | undefined
    const errorMessage = error?.message || String(error || '')

    // Suppress lỗi keep awake - không ảnh hưởng đến chức năng
    if (
      typeof errorMessage === 'string' &&
      (errorMessage.includes('Unable to activate keep awake') ||
        errorMessage.includes('keep awake'))
    ) {
      // Prevent default error logging
      if (event?.preventDefault) {
        event.preventDefault()
      }
      return
    }

    // Log other rejections (dev only)
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('Unhandled promise rejection:', error)
    }
  }
}

function extractStatusCode(error: unknown): number | null {
  const err = error as { response?: { data?: { statusCode?: number; code?: number } } }
  return err?.response?.data?.statusCode ?? err?.response?.data?.code ?? null
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipGlobalError) return
      const code = extractStatusCode(error)
      if (code) showErrorToast(code)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return
      if (mutation.meta?.skipGlobalError) return
      const code = extractStatusCode(error)
      if (code) showErrorToast(code)
    },
  }),
  defaultOptions: {
    queries: {
      // Performance optimizations: stale time 30s, cache 5min
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const SPLASH_TIMEOUT_MS = 5000 // Fallback: ẩn splash sau 5s nếu font/init treo

function AppContent() {
  const [fontsLoaded, fontError] = useBeVietnamProFont()
  const ready = fontsLoaded || fontError
  const savedTheme = useThemeStore((s) => s.theme)

  // Apply saved theme on app start
  useEffect(() => {
    applyTheme(savedTheme as Parameters<typeof applyTheme>[0])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const profilerGlobal = globalThis as {
      __ENABLE_REACT_PROFILER?: boolean
    }
    if (typeof profilerGlobal.__ENABLE_REACT_PROFILER !== 'boolean') {
      profilerGlobal.__ENABLE_REACT_PROFILER = false
    }
    if (profilerGlobal.__ENABLE_REACT_PROFILER) {
      resetReactProfilerStats()
    }
  }, [])

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {})
    }
  }, [ready])

  // Fallback: ẩn splash sau timeout nếu font loading treo (mạng chậm, CDN block...)
  // Skip nếu ready đã true — không cần set timer vô ích.
  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {})
    }, SPLASH_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [ready])

  if (!ready) {
    return null
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <BottomSheetModalProvider>
            <LogoutSheetPortal />
            <QRSelectionSheet />
            <ScanSheetPortal />
            <NotificationProvider />
            <I18nProvider>
              <NavigationEngineProvider>
                <MasterTransitionProvider>
                  <AppToastProvider>
                    <SharedElementProvider>
                      <NativeStackWithMasterTransition />
                    </SharedElementProvider>
                  </AppToastProvider>
                </MasterTransitionProvider>
              </NavigationEngineProvider>
            </I18nProvider>
          </BottomSheetModalProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

export default function RootLayout() {
  useNavigationBarFixed('#FFFFFF', true, true)
  useBackHandlerForExit()
  const isDark = useColorScheme() === 'dark'

  // Sync TanStack Query focusManager với AppState của React Native
  // Khi app về foreground → các query có refetchOnWindowFocus: true sẽ tự refetch nếu stale
  //
  // Lưu ý iOS:
  // 1. 'inactive' state fire khi user pull Control Center / nhận call alert — app
  //    vẫn visible, không nên blur query. Chỉ treat 'background' là thực sự blur.
  // 2. Nếu đang có notification cold-start navigation pending (600ms delay), defer
  //    focus để tránh refetch query trong lúc transition đang pending — tránh flicker
  //    loading state trên destination screen.
  useEffect(() => {
    let deferFocusTimeout: ReturnType<typeof setTimeout> | null = null

    const sub = AppState.addEventListener('change', (state) => {
      const focused = state !== 'background'

      if (deferFocusTimeout) {
        clearTimeout(deferFocusTimeout)
        deferFocusTimeout = null
      }

      if (focused && isNotificationNavigationPending()) {
        // Defer tới sau khi notification nav pending window đã xong (600ms + buffer)
        deferFocusTimeout = setTimeout(() => {
          deferFocusTimeout = null
          focusManager.setFocused(true)
        }, 700)
        return
      }

      focusManager.setFocused(focused)
    })

    return () => {
      if (deferFocusTimeout) clearTimeout(deferFocusTimeout)
      sub.remove()
    }
  }, [])

  useEffect(() => {
    let innerTimeout: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      SystemUI.setBackgroundColorAsync('#ffffff').catch(() => {})

      if (Platform.OS === 'android') {
        innerTimeout = setTimeout(() => {
          innerTimeout = null
          setNavigationBarColorFixed('#FFFFFF', true, true).catch(() => {})
        }, 800)
      }
    })
    return () => {
      task.cancel()
      if (innerTimeout) clearTimeout(innerTimeout)
    }
  }, [])

  return (
    <>
      {/* Global edge-to-edge: Android enters translucent mode at app startup,
          so no screen ever sees a layout shift when statusBarTranslucent toggles.
          Style reactive theo system theme — khi user đổi Light/Dark mid-session,
          status bar (giờ, wifi, pin) đổi màu theo content mới. */}
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        translucent
        backgroundColor="transparent"
      />
      <AppContent />
    </>
  )
}
