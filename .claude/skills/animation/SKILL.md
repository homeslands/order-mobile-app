---
name: animation
description: Trigger when writing animations, gestures, press feedback, transitions, shared element transitions, parallax effects, or any Reanimated code. Always use project spring configs from constants/motion.ts instead of hardcoding values.
---

# Animation & Transitions

This project uses **React Native Reanimated 4.1** with a custom navigation engine. All animations run on the **UI thread**. Heavy JS work during transitions is queued via `scheduleTransitionTask`.

## Golden Rules

```
1. Animations → UI thread (Reanimated worklets). Never Animated from react-native.
2. Spring values → import from constants/motion.ts. Never hardcode damping/stiffness.
3. Heavy logic during navigation → scheduleTransitionTask(). Never run inline.
4. runOnJS() → last resort only. Comment why it's needed.
5. measure() → only in callbacks (onPressIn), never in render.
```

---

## Spring Configs (`constants/motion.ts`)

Single source of truth for all physics. Import `SPRING_CONFIGS` or `MOTION`.

```ts
import { SPRING_CONFIGS, MOTION } from '@/constants'
```

| Config                   | Use case                      | Key values                          |
| ------------------------ | ----------------------------- | ----------------------------------- |
| `SPRING_CONFIGS.press`   | Button/Pressable tap feedback | damping 24, stiffness 350, mass 0.5 |
| `SPRING_CONFIGS.modal`   | Sheet/Dialog open-close       | damping 30, stiffness 380, mass 0.6 |
| `SPRING_CONFIGS.dot`     | Pagination dot scale          | damping 28, stiffness 400, mass 0.3 |
| `SPRING_CONFIGS.popover` | Dropdown/Tooltip              | damping 32, stiffness 420, mass 0.4 |
| `MOTION.parallaxSpring`  | Parallax background slide     | damping 18, stiffness 220, mass 0.9 |
| `MOTION.stackTransition` | Stack screen push             | stiffness 300, damping 30           |

---

## Press Scale Animation

Standard tap feedback for all interactive elements:

```tsx
import { useCallback } from 'react'
import { Pressable } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { MOTION, SPRING_CONFIGS } from '@/constants'

export function AnimatedPressable({
  onPress,
  children,
  className,
}: PressableProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(MOTION.pressScale, SPRING_CONFIGS.press)
  }, [scale])

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIGS.press)
  }, [scale])

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={animatedStyle} className={className}>
        {children}
      </Animated.View>
    </Pressable>
  )
}
```

**Key:** `MOTION.pressScale = 0.97` — not 0.95 or 0.9. Subtle, Telegram-style.

---

## Sheet / Modal Animation

```tsx
import { withSpring } from 'react-native-reanimated'
import { SPRING_CONFIGS } from '@/constants'

// Opening a bottom sheet programmatically
translateY.value = withSpring(0, SPRING_CONFIGS.modal)

// Closing
translateY.value = withSpring(screenHeight, SPRING_CONFIGS.modal)
```

**Note:** `@gorhom/bottom-sheet` handles its own spring internally. Use `SPRING_CONFIGS.modal` only for custom sheet implementations, not for `BottomSheetModal`.

---

## Parallax (Navigation Transitions)

The parallax effect runs during stack navigation via `MasterTransitionProvider`. Config lives in `lib/transitions/`.

```ts
// lib/transitions/reanimated-parallax-config.ts — re-exports from MOTION:
export const REANIMATED_PARALLAX_SPRING = MOTION.parallaxSpring
export const PARALLAX_BG_SCALE_START = MOTION.parallaxBgScaleStart // 0.97
export const PARALLAX_BG_SCALE_END = MOTION.parallaxBgScaleEnd // 1.0
export const PARALLAX_SHADOW_OPACITY_END = MOTION.shadowOpacityEnd // 0.15
```

```tsx
// Consuming transition progress in a screen component
import { useMasterTransition } from '@/lib/navigation'

export function MenuScreen() {
  const { progress } = useMasterTransition()

  const backgroundStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0, 1],
          [PARALLAX_BG_SCALE_START, PARALLAX_BG_SCALE_END],
        ),
      },
    ],
  }))

  return <Animated.View style={backgroundStyle}>{/* ... */}</Animated.View>
}
```

**JS Stack parallax factor:** `MOTION.jsStack.parallaxFactor = -0.25` (background slides opposite direction)

---

## Navigation Transition Specs (`lib/navigation/interactive-transition.ts`)

Two distinct animations for push vs pop:

```ts
import {
  OPEN_TIMING,
  CLOSE_SPRING,
} from '@/lib/navigation/interactive-transition'

// PUSH (open) — timing, ease-out-expo feel, 400ms
// Cubic bezier: (0.21, 1.02, 0.35, 1) — fast start, long deceleration phase
OPEN_TIMING = { duration: 400, easing: Easing.bezier(0.21, 1.02, 0.35, 1) }

// POP (close/gesture release) — spring, velocity-aware
// ζ ≈ 0.82 → 95% settle ~280ms
CLOSE_SPRING = {
  damping: 26,
  stiffness: 190,
  mass: 0.7,
  overshootClamping: true,
}
```

**Do NOT override these** in individual screens — they're set globally in the navigation engine.

---

## Shared Element Transitions (`lib/shared-element/`)

For product image animation from list → detail screen:

```tsx
// Source (list item) — lib/shared-element/shared-element-source.tsx
import { useSharedElementSource } from '@/lib/shared-element'

export const ProductCard = memo(({ product }: { product: IProduct }) => {
  const { animatedRef, capture } = useSharedElementSource(product.imageUri)

  return (
    <Pressable
      onPressIn={capture} // ✅ Capture layout BEFORE navigation starts
      onPress={() =>
        router.push({
          pathname: '/(tabs)/menu/product/[id]',
          params: { id: product.id },
        })
      }
    >
      <Animated.View ref={animatedRef}>
        <Image source={{ uri: product.imageUri }} />
      </Animated.View>
    </Pressable>
  )
})

// Destination (detail screen) — lib/shared-element/shared-element-dest.tsx
import { useSharedElementDest } from '@/lib/shared-element'

export function ProductDetail() {
  const { animatedStyle } = useSharedElementDest()

  return (
    <Animated.View style={animatedStyle}>
      <Image
        source={{ uri: product.imageUri }}
        style={{ width: '100%', height: 300 }}
      />
    </Animated.View>
  )
}
```

**Rules:**

- `capture()` → always in `onPressIn`, never `onPress` (too late — navigation already started)
- `measure()` runs synchronously on JS thread — keep the view mounted when calling
- If view is detached or not yet laid out, `measure()` throws — this is caught in `useSharedElementSource`

---

## Transition Task Queue (`lib/navigation/transition-task-queue.ts`)

Heavy side effects during navigation transitions cause frame drops. Queue them:

```ts
import { scheduleTransitionTask } from '@/lib/navigation/transition-task-queue'

// ❌ Heavy work inline during transition
router.push(route)
updateOrderFlowStore(largePayload) // blocks JS thread during animation
writeToAsyncStorage(data) // I/O during animation

// ✅ Queue it — runs 100ms after transition completes
router.push(route)
scheduleTransitionTask(() => {
  updateOrderFlowStore(largePayload)
})
scheduleTransitionTask(() => {
  writeToAsyncStorage(data)
})
```

**What to queue:**

- Heavy Zustand store updates (order-flow, cart with large payloads)
- AsyncStorage / SecureStore writes
- Analytics events
- Complex selector recalculations
- JSON.parse on large objects

**What NOT to queue (run immediately):**

- UI state needed for the destination screen to render (must be ready before screen mounts)
- Auth state changes
- Navigation params

---

## `useAnimatedStyle` Rules

```tsx
// ✅ Only derived values — no side effects, no JS functions
const style = useAnimatedStyle(() => ({
  opacity: interpolate(progress.value, [0, 1], [0, 1]),
  transform: [{ translateX: offset.value }],
}))

// ❌ Calling JS functions inside worklet
const style = useAnimatedStyle(() => {
  console.log(progress.value) // crashes — not a worklet
  someZustandAction() // crashes — not a worklet
  return { opacity: progress.value }
})

// ✅ When you must bridge to JS thread — use runOnJS sparingly
const onAnimationEnd = useCallback(() => {
  store.setVisible(false)
}, [])

const style = useAnimatedStyle(() => {
  if (progress.value === 0) {
    runOnJS(onAnimationEnd)() // bridge back to JS — only if necessary
  }
  return { opacity: progress.value }
})
```

---

## Anti-Patterns

| ❌ Don't                                     | ✅ Do                                           |
| -------------------------------------------- | ----------------------------------------------- |
| `Animated` from `react-native`               | `Animated` from `react-native-reanimated`       |
| Hardcode `damping: 20, stiffness: 200`       | `SPRING_CONFIGS.press` / `SPRING_CONFIGS.modal` |
| Heavy store update during `router.push`      | `scheduleTransitionTask(() => update())`        |
| `useColorScheme()` inside `useAnimatedStyle` | Pass `isDark` from outside the worklet          |
| `measure()` in render                        | `measure()` in `onPressIn` callback only        |
| New `useSharedValue` for every list item     | Share a single value or use item-scoped keys    |
| `runOnJS` for every state update             | Batch updates, call once at animation end       |

---

## Checklist — New Animation Feature

- [ ] Spring config imported from `SPRING_CONFIGS` or `MOTION` (not hardcoded)
- [ ] `useAnimatedStyle` worklet has no side effects
- [ ] No heavy work during `router.push` → `scheduleTransitionTask`
- [ ] `measure()` called in `onPressIn`, not in render
- [ ] `runOnJS` justified with a comment if used
- [ ] Animation tested on low-end Android (frame drops show there first)
