/**
 * Native Stack với MasterTransitionProvider listeners.
 *
 * Chuyển hẳn sang Native Stack (UINavigationController / Fragments) — giảm Bridge Crossing,
 * animation chạy native, không phụ thuộc JS thread để bắt đầu transition.
 *
 * __DEV__: Merge Transition FPS Monitor.
 */
import { useMemo } from 'react'
import { useColorScheme } from 'react-native'

import { colors } from '@/constants'
import { nativeStackScreenOptions } from '@/layouts/custom-stack'
import { useMasterTransition } from '@/lib/navigation/master-transition-provider'
import {
  startTransitionFPSMonitor,
  stopTransitionFPSMonitor,
} from '@/lib/qa/transition-fps-monitor'
import { Stack } from 'expo-router'

function isTransitionFPSMonitorEnabled(): boolean {
  const g = globalThis as
    | { __ENABLE_TRANSITION_FPS_MONITOR?: boolean }
    | undefined
  return !!g?.__ENABLE_TRANSITION_FPS_MONITOR
}

function useTransitionListeners() {
  const { screenListeners } = useMasterTransition()

  return useMemo(() => {
    if (!__DEV__ || !isTransitionFPSMonitorEnabled()) return screenListeners
    return {
      ...screenListeners,
      transitionStart: (e: { data: { closing: boolean } }) => {
        startTransitionFPSMonitor()
        screenListeners.transitionStart?.(e)
      },
      transitionEnd: (e: { data: { closing: boolean } }) => {
        screenListeners.transitionEnd?.(e)
        stopTransitionFPSMonitor()
      },
    }
  }, [screenListeners])
}

/**
 * Native Stack — slide_from_right + hãm phanh.
 * Dùng cho root, Menu, Home, Auth, Payment, UpdateOrder, ...
 */
export function NativeStackWithMasterTransition() {
  const mergedListeners = useTransitionListeners()
  const isDark = useColorScheme() === 'dark'

  // Override contentStyle + statusBarStyle theo theme hiện tại (reactive).
  // custom-stack.tsx đọc Appearance.getColorScheme() 1 lần tại module load,
  // không update khi user đổi theme mid-session. Wrapper hook này patch lại.
  //
  // Base off nativeStackScreenOptions (NOT profileNativeStackScreenOptions) —
  // dùng profile sẽ leak `gestureResponseDistance: { start: 10000 }` sang mọi
  // root screen, steal horizontal FlashList swipe gesture trên iOS.
  const screenOptions = useMemo(
    () => ({
      ...nativeStackScreenOptions,
      contentStyle: {
        backgroundColor: isDark
          ? colors.background.dark
          : colors.background.light,
      },
      statusBarStyle: isDark ? ('light' as const) : ('dark' as const),
      headerShown: false,
    }),
    [isDark],
  )

  return (
    <Stack
      // Native Stack tren react-native-screens tu dong detach/freeze man khong active.
      screenOptions={screenOptions}
      screenListeners={mergedListeners}
    >
      <Stack.Screen
        name="onboarding"
        options={{
          headerShown: false,
          gestureEnabled: false,
          animation: 'fade',
        }}
      />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="notification" options={{ headerShown: false }} />
      <Stack.Screen name="payment" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen
        name="auth"
        options={{
          headerShown: false,
          // Auth screens use white/gray-900, not the app background (#F0F2F5/#0F0F10).
          // Matching contentStyle prevents the background color flash during the
          // push transition from home → auth/login.
          contentStyle: {
            backgroundColor: isDark ? colors.gray[900] : '#ffffff',
          },
        }}
      />
      <Stack.Screen name="cart" options={{ headerShown: false }} />
      <Stack.Screen name="product" options={{ headerShown: false }} />
      <Stack.Screen name="system/payment" options={{ headerShown: false }} />
      <Stack.Screen name="update-order" options={{ headerShown: false }} />
    </Stack>
  )
}
