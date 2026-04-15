import {
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated'

import { SPRING_CONFIGS } from '@/constants'

export function useShakeAnimation() {
  const translateX = useSharedValue(0)

  const shake = () => {
    translateX.value = withSequence(
      withSpring(10, SPRING_CONFIGS.press),
      withSpring(-10, SPRING_CONFIGS.press),
      withSpring(6, SPRING_CONFIGS.press),
      withSpring(-6, SPRING_CONFIGS.press),
      withSpring(0, SPRING_CONFIGS.press),
    )
  }

  return { translateX, shake }
}
