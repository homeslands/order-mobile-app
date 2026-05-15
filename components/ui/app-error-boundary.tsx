import React from 'react'
import { Appearance, Pressable, Text, View } from 'react-native'

import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'

interface AppErrorBoundaryProps {
  children: React.ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level React error boundary. Catches uncaught render errors anywhere
 * in the tree and shows a recoverable fallback UI instead of crashing the
 * entire JS surface.
 *
 * Must be a class component — hooks cannot implement `componentDidCatch`.
 */
export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Surface to dev console; production would forward to Sentry/Crashlytics.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[AppErrorBoundary]', error, info.componentStack)
    }
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      const isDark = Appearance.getColorScheme() === 'dark'
      return (
        <View
          style={{
            flex: 1,
            paddingTop: STATIC_TOP_INSET + 24,
            paddingHorizontal: 24,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isDark
              ? colors.background.dark
              : colors.background.light,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              marginBottom: 8,
              color: isDark ? colors.foreground.dark : colors.foreground.light,
              textAlign: 'center',
            }}
          >
            Đã xảy ra lỗi
          </Text>
          <Text
            style={{
              fontSize: 14,
              marginBottom: 24,
              color: isDark
                ? colors.mutedForeground.dark
                : colors.mutedForeground.light,
              textAlign: 'center',
            }}
          >
            Vui lòng thử lại. Nếu lỗi tiếp tục xuất hiện, hãy khởi động lại
            ứng dụng.
          </Text>
          <Pressable
            onPress={this.handleReset}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 8,
              backgroundColor: isDark
                ? colors.primary.dark
                : colors.primary.light,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Thử lại</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
