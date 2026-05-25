# Tab Bar Scroll Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab bar pill collapses (hides labels, reduces height) when user scrolls down any tab screen, expands when scrolling up — all running on the UI thread with no JS involvement per frame.

**Architecture:** A `TabScrollContext` provides a single `SharedValue<number>` (scrollY) shared across all tab screens and the tab bar. Each active tab screen writes its scroll offset into this SharedValue via `useAnimatedScrollHandler`. `AnimatedTabBar` watches the SharedValue via `useAnimatedReaction`, derives a `collapseFraction` (0=expanded, 1=collapsed), and passes it to each `AnimatedTabButton` which animates the label out.

**Tech Stack:** React Native Reanimated 4.1 (`useSharedValue`, `useAnimatedScrollHandler`, `useAnimatedReaction`, `useAnimatedStyle`, `withTiming`), React Context, `@shopify/flash-list` → `Animated.createAnimatedComponent(FlashList)`, `@react-navigation/native` `useFocusEffect`.

---

## File Map

| File                                            | Action             | Responsibility                                       |
| ----------------------------------------------- | ------------------ | ---------------------------------------------------- |
| `lib/navigation/tab-scroll-context.tsx`         | Create             | SharedValue provider + hooks                         |
| `app/(tabs)/_layout.tsx`                        | Modify (line ~328) | Wrap content with `TabScrollProvider`                |
| `components/navigation/animated-tab-bar.tsx`    | Modify             | Read context, derive + animate `collapseFraction`    |
| `components/navigation/animated-tab-button.tsx` | Modify             | Accept `collapseFraction`, collapse label            |
| `app/(tabs)/home.tsx`                           | Modify             | Write to context scrollY alongside existing parallax |
| `app/(tabs)/menu/index.tsx`                     | Modify             | AnimatedFlashList + scroll handler → context         |
| `app/(tabs)/gift-card.tsx`                      | Modify             | AnimatedFlashList + scroll handler → context         |
| `app/(tabs)/profile/index.tsx`                  | Modify             | AnimatedGestureScrollView + scroll handler → context |

---

### Task 1: Create TabScrollContext

**Files:**

- Create: `lib/navigation/tab-scroll-context.tsx`

- [ ] **Step 1: Create the context file**

```tsx
// lib/navigation/tab-scroll-context.tsx
import React, { createContext, useContext, useMemo } from 'react'
import { useSharedValue } from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

type TabScrollContextValue = {
  scrollY: SharedValue<number>
}

const TabScrollContext = createContext<TabScrollContextValue | null>(null)

export function TabScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useSharedValue(0)
  // useMemo → stable object reference, context consumers never re-render from this
  const value = useMemo(() => ({ scrollY }), [scrollY])
  return (
    <TabScrollContext.Provider value={value}>
      {children}
    </TabScrollContext.Provider>
  )
}

export function useTabScrollContext(): TabScrollContextValue {
  const ctx = useContext(TabScrollContext)
  if (!ctx) throw new Error('useTabScrollContext requires TabScrollProvider')
  return ctx
}
```

- [ ] **Step 2: Export from `lib/navigation/index.ts`**

Open `lib/navigation/index.ts` and add at the end:

```ts
export { TabScrollProvider, useTabScrollContext } from './tab-scroll-context'
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/navigation/tab-scroll-context.tsx lib/navigation/index.ts
git commit -m "feat(navigation): add TabScrollContext for UI-thread scroll→tab-bar bridge"
```

---

### Task 2: Wrap `_layout.tsx` with TabScrollProvider

**Files:**

- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Import TabScrollProvider**

In `app/(tabs)/_layout.tsx`, add to the existing navigation imports block:

```tsx
import { TabScrollProvider } from '@/lib/navigation'
```

- [ ] **Step 2: Wrap the return JSX**

Locate the `return` statement in `TabsLayout` (around line 328). The outermost `<View style={{ flex: 1 }}>` becomes the `TabScrollProvider` child:

```tsx
return (
  <TabScrollProvider>
    <View style={{ flex: 1 }}>
      {/* ... rest of existing JSX unchanged ... */}
    </View>
  </TabScrollProvider>
)
```

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat(navigation): mount TabScrollProvider in tabs layout"
```

---

### Task 3: Wire Home screen to context

**Files:**

- Modify: `app/(tabs)/home.tsx`

Context: Home already has a local `scrollY` SharedValue and `scrollHandler` used for banner parallax. We must keep the local one and ALSO write to the context's SharedValue in the same handler. We also reset context scrollY on focus.

- [ ] **Step 1: Import `useTabScrollContext` and `useFocusEffect`**

Add to the existing import block in `app/(tabs)/home.tsx`:

```tsx
import { useFocusEffect } from '@react-navigation/native'
import { useTabScrollContext } from '@/lib/navigation'
```

- [ ] **Step 2: Get context scrollY and reset on focus**

Inside `HomeScreen`, after the existing `const scrollY = useSharedValue(0)` line, add:

```tsx
const { scrollY: tabScrollY } = useTabScrollContext()

// Reset tab bar to expanded state when this tab gains focus
useFocusEffect(
  useCallback(() => {
    tabScrollY.value = 0
  }, [tabScrollY]),
)
```

- [ ] **Step 3: Write to context inside existing scroll handler**

Find the existing `scrollHandler` (around line 107) and add the context write:

```tsx
const scrollHandler = useAnimatedScrollHandler((e) => {
  'worklet'
  scrollY.value = e.contentOffset.y // local — banner parallax
  tabScrollY.value = e.contentOffset.y // context — tab bar collapse
})
```

- [ ] **Step 4: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/home.tsx
git commit -m "feat(home): write scroll offset to TabScrollContext for tab bar collapse"
```

---

### Task 4: Wire Menu screen to context

**Files:**

- Modify: `app/(tabs)/menu/index.tsx`

Context: Menu uses `FlashList` which is not natively compatible with `useAnimatedScrollHandler`. Wrap it with `Animated.createAnimatedComponent` at module level (outside the component).

- [ ] **Step 1: Add imports**

In `app/(tabs)/menu/index.tsx`, add:

```tsx
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native' // already imported, skip if present
import { useTabScrollContext } from '@/lib/navigation'
```

- [ ] **Step 2: Create AnimatedFlashList at module level** (outside the component, after imports)

```tsx
const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<React.ComponentProps<typeof FlashList>>,
)
```

- [ ] **Step 3: Add context hook + focus reset + scroll handler inside component**

Inside the menu screen component, add:

```tsx
const { scrollY } = useTabScrollContext()

useFocusEffect(
  useCallback(() => {
    scrollY.value = 0
  }, [scrollY]),
)

const tabScrollHandler = useAnimatedScrollHandler((e) => {
  'worklet'
  scrollY.value = e.contentOffset.y
})
```

- [ ] **Step 4: Replace `FlashList` with `AnimatedFlashList` and add handler**

Find the `<FlashList` JSX (around line 689) and change it to `<AnimatedFlashList`. Add:

```tsx
onScroll={tabScrollHandler}
scrollEventThrottle={16}
```

Keep all existing props unchanged. Only the component name and two new props change.

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors. If `AnimatedFlashList` type complains about generic props, adjust the cast in Step 2.

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/menu/index.tsx
git commit -m "feat(menu): wire AnimatedFlashList scroll to TabScrollContext"
```

---

### Task 5: Wire Gift Card screen to context

**Files:**

- Modify: `app/(tabs)/gift-card.tsx`

Same pattern as Task 4 (FlashList).

- [ ] **Step 1: Add imports**

```tsx
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated'
import { useFocusEffect } from '@react-navigation/native'
import { useTabScrollContext } from '@/lib/navigation'
```

- [ ] **Step 2: Create AnimatedFlashList at module level**

```tsx
const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as React.ComponentType<React.ComponentProps<typeof FlashList>>,
)
```

- [ ] **Step 3: Add context hook + focus reset + scroll handler inside component**

```tsx
const { scrollY } = useTabScrollContext()

useFocusEffect(
  useCallback(() => {
    scrollY.value = 0
  }, [scrollY]),
)

const tabScrollHandler = useAnimatedScrollHandler((e) => {
  'worklet'
  scrollY.value = e.contentOffset.y
})
```

- [ ] **Step 4: Replace `FlashList` with `AnimatedFlashList` + add props**

Find the `<FlashList` JSX (around line 414) and:

- Change to `<AnimatedFlashList`
- Add `onScroll={tabScrollHandler}` and `scrollEventThrottle={16}`

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/gift-card.tsx
git commit -m "feat(gift-card): wire AnimatedFlashList scroll to TabScrollContext"
```

---

### Task 6: Wire Profile screen to context

**Files:**

- Modify: `app/(tabs)/profile/index.tsx`

Context: Profile uses `ScrollView as GestureScrollView` from `react-native-gesture-handler`. Wrap with `Animated.createAnimatedComponent` to enable Reanimated scroll handler.

- [ ] **Step 1: Add imports**

```tsx
import Animated, { useAnimatedScrollHandler } from 'react-native-reanimated'
// useFocusEffect already imported in profile
import { useTabScrollContext } from '@/lib/navigation'
```

- [ ] **Step 2: Create AnimatedGestureScrollView at module level**

```tsx
const AnimatedGestureScrollView =
  Animated.createAnimatedComponent(GestureScrollView)
```

- [ ] **Step 3: Add context hook + focus reset + scroll handler inside component**

```tsx
const { scrollY } = useTabScrollContext()

useFocusEffect(
  useCallback(() => {
    scrollY.value = 0
  }, [scrollY]),
)

const tabScrollHandler = useAnimatedScrollHandler((e) => {
  'worklet'
  scrollY.value = e.contentOffset.y
})
```

- [ ] **Step 4: Replace `GestureScrollView` with `AnimatedGestureScrollView` + add props**

Find the `<GestureScrollView` JSX (around line 643) and:

- Change to `<AnimatedGestureScrollView`
- Change closing tag to `</AnimatedGestureScrollView>`
- Add `onScroll={tabScrollHandler}` and `scrollEventThrottle={16}`

Keep all existing props (`style`, `showsVerticalScrollIndicator`, `contentContainerStyle`) unchanged.

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/profile/index.tsx
git commit -m "feat(profile): wire animated scroll view to TabScrollContext"
```

---

### Task 7: Animate tab bar collapse — `AnimatedTabBar` + `AnimatedTabButton`

**Files:**

- Modify: `components/navigation/animated-tab-bar.tsx`
- Modify: `components/navigation/animated-tab-button.tsx`

This task implements the actual collapse animation. Both files must change together to compile.

**Collapse behavior:**

- `scrollY < 60` → always expand (near top of content)
- `scrollY > prev + 4` → collapse (scrolling down, 4px deadband prevents jitter)
- `scrollY < prev - 4` → expand (scrolling up)
- Expand/collapse with `withTiming(target, { duration: 200 })`

**What animates:**

- Label: `opacity` 1→0, `maxHeight` 16→0, `marginTop` 2→0 (removes label space from layout)
- Lift: `translateY` on active button is zeroed when collapsed (no label to balance against)

- [ ] **Step 1: Update `AnimatedTabButton` props type and add `collapseFraction` prop**

In `components/navigation/animated-tab-button.tsx`, add to `AnimatedTabButtonProps`:

```tsx
collapseFraction: SharedValue<number>
```

And add to the destructured params in the function signature:

```tsx
collapseFraction,
```

- [ ] **Step 2: Update `liftStyle` to account for collapse in `AnimatedTabButton`**

Replace the existing `liftStyle`:

```tsx
const liftStyle = useAnimatedStyle(() => ({
  transform: [
    { translateY: activeFraction.value * -3 * (1 - collapseFraction.value) },
    { scale: 1 + activeFraction.value * 0.06 },
  ],
}))
```

- [ ] **Step 3: Update `labelStyle` to collapse with `collapseFraction` in `AnimatedTabButton`**

Replace the existing `labelStyle`:

```tsx
const labelStyle = useAnimatedStyle(() => {
  const show = 1 - collapseFraction.value
  return {
    color: interpolateColor(
      activeFraction.value,
      [0, 1],
      [mutedColor, '#ffffff'],
    ),
    opacity: show,
    maxHeight: show * 16,
    marginTop: show * 2,
  }
})
```

The JSX `<Animated.Text>` doesn't change. Add `overflow: 'hidden'` to `styles.label` so `maxHeight: 0` actually clips the text:

```tsx
label: {
  fontSize: 10,
  marginTop: 2,
  textAlign: 'center',
  overflow: 'hidden',
},
```

- [ ] **Step 4: Update `AnimatedTabBar` imports**

In `components/navigation/animated-tab-bar.tsx`, update the Reanimated import to add `useAnimatedReaction` and `withTiming`:

```tsx
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
```

Also add context import:

```tsx
import { useTabScrollContext } from '@/lib/navigation'
```

- [ ] **Step 5: Add collapse logic inside `AnimatedTabBar` component**

Inside `AnimatedTabBar`, after the existing `const indicatorX = useSharedValue(0)` line, add:

```tsx
const { scrollY } = useTabScrollContext()
const collapseFraction = useSharedValue(0)

useAnimatedReaction(
  () => scrollY.value,
  (current, previous) => {
    'worklet'
    const prev = previous ?? 0
    if (current < 60) {
      // Near top: always expand
      collapseFraction.value = withTiming(0, { duration: 200 })
    } else if (current > prev + 4) {
      // Scrolling down
      collapseFraction.value = withTiming(1, { duration: 200 })
    } else if (current < prev - 4) {
      // Scrolling up
      collapseFraction.value = withTiming(0, { duration: 200 })
    }
  },
)
```

- [ ] **Step 6: Pass `collapseFraction` to each `AnimatedTabButton` in the render**

In the `tabConfigs.map(...)` render, add `collapseFraction={collapseFraction}` to each `<AnimatedTabButton`:

```tsx
{
  tabConfigs.map(({ Icon, href, label }, index) => (
    <AnimatedTabButton
      key={href}
      iconSize={ICON_SIZE}
      itemWidth={ITEM_WIDTH}
      href={href}
      label={label}
      Icon={Icon}
      active={isActive[index]}
      mutedColor={colors.mutedForeground}
      onPressIn={onPressInTabSwitch}
      indicatorX={indicatorX}
      buttonIndex={index}
      buttonPaddingH={paddingH}
      indicatorWidth={itemWidth}
      collapseFraction={collapseFraction}
    />
  ))
}
```

- [ ] **Step 7: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 8: Manual test**

Start the app and verify:

1. Open any tab screen, scroll down → tab bar labels fade out, pill shrinks
2. Scroll up → labels reappear
3. Scroll near top (< 60px) → always expanded
4. Switch tabs → tab bar expands immediately (reset to 0 on focus)
5. Active tab indicator still slides correctly during tab switch

- [ ] **Step 9: Commit**

```bash
git add components/navigation/animated-tab-bar.tsx components/navigation/animated-tab-button.tsx
git commit -m "feat(navigation): collapse tab bar labels on scroll-down via UI-thread SharedValue"
```
