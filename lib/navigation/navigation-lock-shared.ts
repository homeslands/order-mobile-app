/**
 * SharedValue mirror của navigation lock state.
 * Dùng trong worklet để check lock TRƯỚC runOnJS — tránh gọi runOnJS khi locked.
 *
 * Worklet có thể đọc isLockedShared.value mà không cần chạy JS.
 */
import { makeMutable } from 'react-native-reanimated'

/** 0 = unlocked, 1 = locked. Worklet-safe. */
export const isLockedShared = makeMutable(0)
