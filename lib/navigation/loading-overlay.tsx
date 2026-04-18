import React from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useNavigationLoading } from '@/hooks/use-navigation-loading'

/**
 * Navigation Loading Overlay
 * Displays a semi-transparent overlay with loading indicator
 * Used during screen transitions and async operations
 *
 * Show smooth loading state to user instead of janky UI updates
 */
export function NavigationLoadingOverlay() {
  const isLoading = useNavigationLoading()

  if (!isLoading) return null

  return (
    <View className="absolute inset-0 z-50 items-center justify-center bg-black/50">
      <ActivityIndicator size="large" color="#fff" />
    </View>
  )
}
