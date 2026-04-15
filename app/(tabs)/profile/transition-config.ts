import { WithSpringConfig } from 'react-native-reanimated'

export const SNAP_BRAKE_CONFIG: WithSpringConfig = {
  damping: 24,
  stiffness: 400,
  mass: 0.45,
  overshootClamping: true,
  energyThreshold: 0.1,
}
