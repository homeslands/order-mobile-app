import { useEffect, useState } from 'react'
import { Dimensions, ScaledSize } from 'react-native'

const MOBILE_BREAKPOINT = 768

/**
 * Hook to detect if device is mobile (width < 768px)
 * In React Native, we consider all devices as mobile since we're building a mobile app
 * This hook can be useful for tablet detection or responsive layouts
 */
export function useIsMobile(): boolean {
  const [dimensions, setDimensions] = useState<ScaledSize>(Dimensions.get('window'))

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window)
    })

    return () => {
      subscription?.remove()
    }
  }, [])

  // In React Native mobile app, we consider all devices as mobile
  // But you can customize this logic based on your needs
  return dimensions.width < MOBILE_BREAKPOINT
}
