import Constants from 'expo-constants'
import { useEffect } from 'react'
import { AppState, Platform } from 'react-native'
import NavigationBarColorModule from 'navigation-bar-color'

const isExpoGo = Constants.executionEnvironment === 'storeClient'

export function useNavigationBarFixed(
  backgroundColor: string = '#FFFFFF',
  light: boolean = true,
  animated: boolean = true,
) {
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return
    }

    // Expo Go không hỗ trợ native modules tùy chỉnh
    const module = NavigationBarColorModule
    if (isExpoGo || !module) {
      if (__DEV__ && isExpoGo) {
        // eslint-disable-next-line no-console
        console.warn(
          '⚠️ Navigation bar color không hoạt động trên Expo Go. Cần build development build.',
        )
      }
      return
    }

    const setColor = async () => {
      if (AppState.currentState !== 'active') {
        return
      }

      try {
        // Tăng delay để đảm bảo Activity đã được attach
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Kiểm tra lại AppState sau delay
        if (AppState.currentState !== 'active') {
          return
        }

        await module.changeNavigationBarColor(backgroundColor, light, animated)
      } catch (error) {
        // Chỉ log error nếu không phải lỗi "not attached to Activity"
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        if (__DEV__ && !errorMessage.includes('not attached to an Activity')) {
          // eslint-disable-next-line no-console
          console.error('Navigation bar error:', error)
        }
      }
    }

    // Delay initial call để đảm bảo Activity đã sẵn sàng
    const timeoutId = setTimeout(() => {
      setColor()
    }, 500)

    const subscription = AppState.addEventListener('change', () => {
      if (AppState.currentState === 'active') {
        // Delay khi app trở lại active
        setTimeout(() => {
          setColor()
        }, 300)
      }
    })

    return () => {
      clearTimeout(timeoutId)
      subscription?.remove()
    }
  }, [backgroundColor, light, animated])
}

export const setNavigationBarColorFixed = async (
  backgroundColor: string,
  light: boolean = true,
  animated: boolean = true,
): Promise<{ success: boolean }> => {
  if (Platform.OS !== 'android') {
    return { success: false }
  }

  // Expo Go không hỗ trợ native modules tùy chỉnh
  if (isExpoGo || !NavigationBarColorModule) {
    return { success: false }
  }

  try {
    if (AppState.currentState !== 'active') {
      return { success: false }
    }

    // Tăng delay để đảm bảo Activity đã được attach
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Kiểm tra lại AppState sau delay
    if (AppState.currentState !== 'active') {
      return { success: false }
    }

    const result = await NavigationBarColorModule.changeNavigationBarColor(
      backgroundColor,
      light,
      animated,
    )
    return result ?? { success: true }
  } catch (error) {
    // Chỉ log error nếu không phải lỗi "not attached to Activity"
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (__DEV__ && !errorMessage.includes('not attached to an Activity')) {
      // eslint-disable-next-line no-console
      console.error('Navigation bar error:', error)
    }
    return { success: false }
  }
}
