# Tab Bar Performance & Animation Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 performance and animation issues in the custom animated tab bar — eliminate redundant re-renders on every tab switch, reduce GPU compositing overhead, and drive icon/text color transitions on the UI thread.

**Architecture:** Changes touch 5 files. Tasks 1–6 are independent, low-risk cleanups that can each be reviewed in isolation. Task 7 is the only structural change: it passes `indicatorX` (a Reanimated `SharedValue<number>`) from `AnimatedTabBar` down into each `AnimatedTabButton` so color cross-fade and the active-lift motion run entirely on the UI thread without involving JS re-renders.

**Tech Stack:** React Native 0.81.5, Reanimated 4.1 (`useDerivedValue`, `interpolate`, `interpolateColor`, `Extrapolation`), `react-native-gesture-handler` 2.x, TypeScript strict mode.

**Out of scope (too complex for this plan):**
- A3: Drive indicator from gesture SharedValue (removes 1-frame JS lag — requires reworking NativeGesturePressable + deep-link fallback)
- B5: Spring config softening (wait for B1 fix first; re-evaluate visually)

---

## Files Changed

| File | Tasks | What changes |
|------|-------|-------------|
| `components/navigation/tab-button.tsx` | T1 | **Deleted** — unused component, zero consumers |
| `components/navigation/index.ts` | T1 | Remove `TabButton` export (line 20) |
| `components/navigation/animated-tab-bar.tsx` | T1, T3, T5, T6, T7 | Remove dead props, fix memo, merge state, pass shared values |
| `components/navigation/animated-tab-button.tsx` | T1, T4, T5, T7 | Remove dead props, disable on active, fix callback API, add UI-thread animation |
| `app/(tabs)/_layout.tsx` | T1, T2 | Remove `onBeforeTabSwitch`, reduce gradient stops |

---

### Task 1: Remove dead code — TabButton, onBeforeTabSwitch, hapticStyle (C1 partial, C2, C3)

**Files:**
- Delete: `components/navigation/tab-button.tsx`
- Modify: `components/navigation/index.ts` — line 20
- Modify: `components/navigation/animated-tab-bar.tsx`
- Modify: `components/navigation/animated-tab-button.tsx`
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Delete tab-button.tsx and remove its export**

```bash
git rm components/navigation/tab-button.tsx
```

In `components/navigation/index.ts`, delete line 20:
```ts
// Delete this line:
export { TabButton } from './tab-button'
```

- [ ] **Step 2: Remove onBeforeTabSwitch from AnimatedTabBarProps**

In `components/navigation/animated-tab-bar.tsx`:

Remove from the type (around line 47):
```tsx
// Delete these two lines:
  /** Gọi TRƯỚC khi chuyển tab — (href) => skip nếu đã cache. */
  onBeforeTabSwitch?: (href: string) => void
```

Remove from the destructure (line 58):
```tsx
// Before:
export const AnimatedTabBar = React.memo(function AnimatedTabBar({
  t, colors, tabState, tabRoutes, onBeforeTabSwitch, onPressInTabSwitch,

// After:
export const AnimatedTabBar = React.memo(function AnimatedTabBar({
  t, colors, tabState, tabRoutes, onPressInTabSwitch,
```

Remove from the `items.map` render (lines 166–170):
```tsx
// Delete these lines from AnimatedTabButton render:
            onBeforeTabSwitch={
              !active && onBeforeTabSwitch
                ? () => onBeforeTabSwitch(href)
                : undefined
            }
```

- [ ] **Step 3: Remove onBeforeTabSwitch, primaryColor, hapticStyle from AnimatedTabButtonProps**

In `components/navigation/animated-tab-button.tsx`, replace the full interface and component signature:

```tsx
// Before:
type AnimatedTabButtonProps = {
  href: string
  iconSize?: number
  itemWidth?: number
  label?: string
  Icon: LucideIcon
  active: boolean
  primaryColor: string
  mutedColor: string
  onBeforeTabSwitch?: () => void
  onPressIn?: () => void
}

export const AnimatedTabButton = React.memo(function AnimatedTabButton({
  href, iconSize = 36, itemWidth = 70, label, Icon, active,
  mutedColor, onBeforeTabSwitch, onPressIn,
}: AnimatedTabButtonProps) {
  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      beforeNavigate={onBeforeTabSwitch}
      onPressIn={onPressIn}
      hapticStyle="light"
      style={styles.container}
    >
```

```tsx
// After:
type AnimatedTabButtonProps = {
  href: string
  iconSize?: number
  itemWidth?: number
  label?: string
  Icon: LucideIcon
  active: boolean
  mutedColor: string
  onPressIn?: () => void
}

export const AnimatedTabButton = React.memo(function AnimatedTabButton({
  href, iconSize = 36, itemWidth = 70, label, Icon, active,
  mutedColor, onPressIn,
}: AnimatedTabButtonProps) {
  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      onPressIn={onPressIn}
      style={styles.container}
    >
```

- [ ] **Step 4: Remove onBeforeTabSwitch from _layout.tsx**

In `app/(tabs)/_layout.tsx` around line 386:
```tsx
// Before:
            <AnimatedTabBar
              t={t}
              colors={tabColors}
              tabState={resolvedTabState}
              tabRoutes={tabRoutes}
              onPressInTabSwitch={onPressInTabSwitch}
              onBeforeTabSwitch={undefined}
            />

// After:
            <AnimatedTabBar
              t={t}
              colors={tabColors}
              tabState={resolvedTabState}
              tabRoutes={tabRoutes}
              onPressInTabSwitch={onPressInTabSwitch}
            />
```

- [ ] **Step 5: Typecheck and commit**

```bash
npm run check
```

Expected: no errors, no warnings.

```bash
git add components/navigation/animated-tab-bar.tsx \
  components/navigation/animated-tab-button.tsx \
  components/navigation/index.ts \
  app/\(tabs\)/_layout.tsx
git commit -m "refactor(navigation): remove TabButton dead code and unused onBeforeTabSwitch/hapticStyle props"
```

---

### Task 2: Reduce LinearGradient from 8 stops to 4 (B4)

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace gradientColors useMemo**

In `app/(tabs)/_layout.tsx` around line 165:

```tsx
// Before — 8 stops:
  const gradientColors = useMemo(
    () => [
      'transparent',
      'transparent',
      hexToRgba(colors.background, 0.03),
      hexToRgba(colors.background, 0.08),
      hexToRgba(colors.background, 0.18),
      hexToRgba(colors.background, 0.35),
      hexToRgba(colors.background, 0.55),
      colors.background,
    ],
    [colors.background],
  )
```

```tsx
// After — 4 stops:
  const gradientColors = useMemo(
    () => [
      'transparent',
      hexToRgba(colors.background, 0.15),
      hexToRgba(colors.background, 0.55),
      colors.background,
    ],
    [colors.background],
  )
```

- [ ] **Step 2: Update LinearGradient locations**

Find the `<LinearGradient>` element (~line 357) and update `locations`:

```tsx
// Before:
          <LinearGradient
            colors={
              gradientColors as unknown as [string, string, ...string[]]
            }
            locations={[0, 0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 1]}
            style={{ flex: 1 }}
          />

// After:
          <LinearGradient
            colors={
              gradientColors as unknown as [string, string, ...string[]]
            }
            locations={[0, 0.3, 0.65, 1]}
            style={{ flex: 1 }}
          />
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run check
git add app/\(tabs\)/_layout.tsx
git commit -m "perf(navigation): reduce tab bar LinearGradient from 8 to 4 stops"
```

---

### Task 3: Remove renderToHardwareTextureAndroid from sliding indicator (B3)

**Files:**
- Modify: `components/navigation/animated-tab-bar.tsx`

- [ ] **Step 1: Remove the prop from the indicator Animated.View**

In `components/navigation/animated-tab-bar.tsx` around line 144:

```tsx
// Before:
        <Animated.View
          renderToHardwareTextureAndroid
          style={[
            styles.slidingIndicator,
            {
              width: itemWidth,
              backgroundColor: colors.primary,
            },
            slidingIndicatorStyle,
          ]}
        />

// After:
        <Animated.View
          style={[
            styles.slidingIndicator,
            {
              width: itemWidth,
              backgroundColor: colors.primary,
            },
            slidingIndicatorStyle,
          ]}
        />
```

- [ ] **Step 2: Typecheck and commit**

```bash
npm run check
git add components/navigation/animated-tab-bar.tsx
git commit -m "perf(navigation): remove renderToHardwareTextureAndroid from sliding indicator — invalidates bitmap every frame"
```

---

### Task 4: Disable press-scale on already-active tab (B2)

**Files:**
- Modify: `components/navigation/animated-tab-button.tsx`

- [ ] **Step 1: Pass disabled={active} to NativeGesturePressable**

In `components/navigation/animated-tab-button.tsx`:

```tsx
// Before:
  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      onPressIn={onPressIn}
      style={styles.container}
    >

// After:
  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      onPressIn={onPressIn}
      disabled={active}
      style={styles.container}
    >
```

`NativeGesturePressable` already accepts `disabled?: boolean` (line 35 of that file). When `disabled=true` the `Gesture.Tap()` has `.enabled(false)` so no scale animation fires.

- [ ] **Step 2: Typecheck and commit**

```bash
npm run check
git add components/navigation/animated-tab-button.tsx
git commit -m "fix(navigation): skip press scale when tapping already-active tab"
```

---

### Task 5: Fix inline lambdas — restore AnimatedTabButton React.memo (A1 + A2)

**Root cause recap:** `items` useMemo depends on `tabState` (new object every render). Every tab switch rebuilds `items` and creates new inline lambdas `() => onPressInTabSwitch(href)` for all 4 buttons — breaking `React.memo` on every `AnimatedTabButton` regardless of which `active` flag changed.

**Fix:** Separate the static route/label config (no `tabState` dep) from the per-render active flags. Change `onPressIn` API so `AnimatedTabButton` receives the bare handler and calls it with its own `href` internally — no closure created in the parent.

**Files:**
- Modify: `components/navigation/animated-tab-bar.tsx`
- Modify: `components/navigation/animated-tab-button.tsx`

- [ ] **Step 1: Change onPressIn type in AnimatedTabButtonProps and add handlePressIn**

In `components/navigation/animated-tab-button.tsx`:

Add `useCallback` to the React import:
```tsx
// Before:
import React from 'react'

// After:
import React, { useCallback } from 'react'
```

Update the `onPressIn` type and add an internal stable wrapper:
```tsx
// In AnimatedTabButtonProps, change:
  onPressIn?: () => void
// To:
  onPressIn?: (href: string) => void
```

Inside the component body, before the `return`:
```tsx
export const AnimatedTabButton = React.memo(function AnimatedTabButton({
  href, iconSize = 36, itemWidth = 70, label, Icon, active,
  mutedColor, onPressIn,
}: AnimatedTabButtonProps) {
  const handlePressIn = useCallback(() => {
    onPressIn?.(href)
  }, [href, onPressIn])

  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      onPressIn={handlePressIn}
      disabled={active}
      style={styles.container}
    >
```

- [ ] **Step 2: Split items into tabConfigs (stable, no tabState dep) in AnimatedTabBar**

In `components/navigation/animated-tab-bar.tsx`, replace the `items` useMemo:

```tsx
// Before:
  const items = useMemo(
    () => [
      {
        Icon: Home,
        active: tabState.isHomeActive,
        href: tabRoutes.home,
        label: t('tabs.home', 'Trang chủ'),
      },
      {
        Icon: Menu,
        active: tabState.isMenuActive,
        href: tabRoutes.menu,
        label: t('tabs.menu', 'Thực đơn'),
      },
      {
        Icon: Gift,
        active: tabState.isGiftCardActive,
        href: tabRoutes.giftCard,
        label: t('tabs.giftCard', 'Thẻ quà'),
      },
      {
        Icon: User,
        active: tabState.isProfileActive,
        href: tabRoutes.profile,
        label: t('tabs.profile', 'Tài khoản'),
      },
    ],
    [tabState, tabRoutes, t],
  )
```

```tsx
// After:
  // Static config — no tabState dep; rebuilds only when routes/translations change
  const tabConfigs = useMemo(
    () => [
      { Icon: Home, href: tabRoutes.home, label: t('tabs.home', 'Trang chủ') },
      { Icon: Menu, href: tabRoutes.menu, label: t('tabs.menu', 'Thực đơn') },
      { Icon: Gift, href: tabRoutes.giftCard, label: t('tabs.giftCard', 'Thẻ quà') },
      { Icon: User, href: tabRoutes.profile, label: t('tabs.profile', 'Tài khoản') },
    ],
    [tabRoutes, t],
  )

  // Active flags indexed to match tabConfigs order
  const isActive = [
    tabState.isHomeActive,
    tabState.isMenuActive,
    tabState.isGiftCardActive,
    tabState.isProfileActive,
  ]
```

- [ ] **Step 3: Update the render in AnimatedTabBar**

Replace the `items.map(...)` block:

```tsx
// Before:
        {items.map(({ Icon, active, href, label }) => (
          <AnimatedTabButton
            key={href}
            iconSize={ICON_SIZE}
            itemWidth={ITEM_WIDTH}
            href={href}
            label={label}
            Icon={Icon}
            active={active}
            primaryColor={colors.primary}
            mutedColor={colors.mutedForeground}
            onPressIn={
              !active && onPressInTabSwitch
                ? () => onPressInTabSwitch(href)
                : undefined
            }
          />
        ))}

// After:
        {tabConfigs.map(({ Icon, href, label }, index) => (
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
          />
        ))}
```

`onPressIn={onPressInTabSwitch}` — no inline lambda. `AnimatedTabButton` binds `href` internally via `handlePressIn`. When only one button's `active` changes (tab switch), only that button's `handlePressIn` rebuilds and only 2/4 buttons re-render (the one activating, the one deactivating).

- [ ] **Step 4: Typecheck**

```bash
npm run check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/navigation/animated-tab-bar.tsx \
  components/navigation/animated-tab-button.tsx
git commit -m "perf(navigation): fix inline lambdas in tab bar map — restore AnimatedTabButton React.memo"
```

---

### Task 6: Merge double setState in onPillLayout (A4)

**Files:**
- Modify: `components/navigation/animated-tab-bar.tsx`

- [ ] **Step 1: Merge the two state declarations**

In `components/navigation/animated-tab-bar.tsx` around line 60:

```tsx
// Before:
  const [paddingH, setPaddingH] = useState(PADDING_H_DEFAULT)
  const [pillWidth, setPillWidth] = useState(0)
```

```tsx
// After:
  const [layout, setLayout] = useState({ pillWidth: 0, paddingH: PADDING_H_DEFAULT })
  const { pillWidth, paddingH } = layout
```

All downstream uses of `paddingH` and `pillWidth` remain unchanged since they're destructured at the top.

- [ ] **Step 2: Update onPillLayout to single setState**

```tsx
// Before:
  const onPillLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) {
      setPillWidth(w)
      const ph = (8 * PILL_RADIUS - w) / 6
      setPaddingH(Math.max(4, Math.min(ph, 20)))
    }
  }, [])

// After:
  const onPillLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) {
      const ph = Math.max(4, Math.min((8 * PILL_RADIUS - w) / 6, 20))
      setLayout({ pillWidth: w, paddingH: ph })
    }
  }, [])
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run check
git add components/navigation/animated-tab-bar.tsx
git commit -m "perf(navigation): merge double setState in onPillLayout into single update"
```

---

### Task 7: UI-thread color sync + lift animation from indicatorX SharedValue (B1 + C1 fold-in)

**What this does:**
- Passes the existing `indicatorX: SharedValue<number>` from `AnimatedTabBar` into each `AnimatedTabButton`
- Each button computes `activeFraction` (0→1) on the UI thread: 1 when the indicator is exactly over this button, 0 when one slot away
- Icon color: two overlapping icons (muted + white) with animated opacity — cross-fades on UI thread, no step-change
- Label color: `Animated.Text` + `useAnimatedStyle` with `interpolateColor` — UI thread
- Active lift: `translateY: -3px` + `scale: 1.06` as indicator arrives — replaces the orphaned `TabButton` motion

**Mathematical basis for activeFraction:**
- Indicator left edge at button `i`: `indicatorX.value = paddingH + i * itemWidth`
- `activeFraction = clamp(1 - |indicatorX.value - buttonLeft| / indicatorWidth, 0, 1)`
- This is 1 only when indicator exactly covers the button, smoothly falls to 0 as the spring moves away

**Files:**
- Modify: `components/navigation/animated-tab-button.tsx`
- Modify: `components/navigation/animated-tab-bar.tsx`

- [ ] **Step 1: Update imports in animated-tab-button.tsx**

Replace the existing imports at the top of `components/navigation/animated-tab-button.tsx` with:

```tsx
import type { LucideIcon } from 'lucide-react-native'
import React, { useCallback } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import { NativeGesturePressable } from './native-gesture-pressable'
```

- [ ] **Step 2: Add new props to AnimatedTabButtonProps**

```tsx
type AnimatedTabButtonProps = {
  href: string
  iconSize?: number
  itemWidth?: number
  label?: string
  Icon: LucideIcon
  active: boolean
  mutedColor: string
  onPressIn?: (href: string) => void
  // UI-thread animation — passed from AnimatedTabBar
  indicatorX: SharedValue<number>
  buttonIndex: number
  buttonPaddingH: number
  indicatorWidth: number
}
```

- [ ] **Step 3: Replace the entire AnimatedTabButton component body**

```tsx
export const AnimatedTabButton = React.memo(function AnimatedTabButton({
  href,
  iconSize = 36,
  itemWidth = 70,
  label,
  Icon,
  active,
  mutedColor,
  onPressIn,
  indicatorX,
  buttonIndex,
  buttonPaddingH,
  indicatorWidth,
}: AnimatedTabButtonProps) {
  const handlePressIn = useCallback(() => {
    onPressIn?.(href)
  }, [href, onPressIn])

  // 1 when indicator covers this button, 0 when ≥1 slot away — all on UI thread
  const activeFraction = useDerivedValue(() => {
    const buttonLeft = buttonPaddingH + buttonIndex * indicatorWidth
    const dist = Math.abs(indicatorX.value - buttonLeft)
    return interpolate(dist, [0, indicatorWidth], [1, 0], Extrapolation.CLAMP)
  })

  const liftStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: activeFraction.value * -3 },
      { scale: 1 + activeFraction.value * 0.06 },
    ],
  }))

  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(activeFraction.value, [0, 1], [mutedColor, '#ffffff']),
  }))

  const activeIconOpacity = useAnimatedStyle(() => ({
    opacity: activeFraction.value,
  }))

  const iconPx = iconSize * 0.55

  return (
    <NativeGesturePressable
      navigation={{ type: 'navigate', href }}
      onPressIn={handlePressIn}
      disabled={active}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { width: itemWidth }, liftStyle]}>
        {/* Icon: muted layer always present; white layer fades in as indicator arrives */}
        <View style={{ width: iconPx, height: iconPx }}>
          <Icon color={mutedColor} size={iconPx} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.iconOverlay, activeIconOpacity]}>
            <Icon color="#ffffff" size={iconPx} />
          </Animated.View>
        </View>
        {label ? (
          <Animated.Text
            style={[styles.label, { maxWidth: itemWidth - 20 }, labelStyle]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>
        ) : null}
      </Animated.View>
    </NativeGesturePressable>
  )
})
```

- [ ] **Step 4: Update styles in animated-tab-button.tsx**

```tsx
const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  iconOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
```

- [ ] **Step 5: Pass indicatorX and layout props from AnimatedTabBar**

In `components/navigation/animated-tab-bar.tsx`, update the `tabConfigs.map(...)` render (introduced in Task 5):

```tsx
        {tabConfigs.map(({ Icon, href, label }, index) => (
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
          />
        ))}
```

`indicatorX` = existing `useSharedValue(0)` in `AnimatedTabBar` (line 62).
`paddingH` and `itemWidth` = from `layout` state destructure + computed value (from Task 6 and existing code).

Note: `itemWidth` in `AnimatedTabBar` = `pillWidth > 0 ? (pillWidth - 2 * paddingH) / 4 : ITEM_WIDTH`. This is the actual rendered slot width. The constant `ITEM_WIDTH = 70` passed as `itemWidth` prop to `AnimatedTabButton` is for content layout only — these are intentionally different.

- [ ] **Step 6: Typecheck**

```bash
npm run check
```

Expected: no errors. If `interpolateColor` import fails, verify it is exported from `react-native-reanimated`:
```bash
node -e "const r = require('react-native-reanimated'); console.log(typeof r.interpolateColor)"
```
Expected: `function`

- [ ] **Step 7: Manual visual test**

```bash
expo start
```

Verify on device/simulator:

| Scenario | Expected |
|----------|----------|
| Tab switch (adjacent) | Indicator springs to new button; icon + label color cross-fades in sync with indicator, no step-change |
| Tab switch (Home → Profile, 3 slots) | Indicator sweeps across; intermediate buttons briefly "lighten" as indicator passes through them |
| Active tab tap | No press-scale animation (button is disabled) |
| Tab bar fade-out (navigate to product) | Bar fades out smoothly; no flicker |
| Dark mode switch | Colors update correctly on next render |

- [ ] **Step 8: Commit**

```bash
git add components/navigation/animated-tab-bar.tsx \
  components/navigation/animated-tab-button.tsx
git commit -m "perf(navigation): drive tab icon/text color and lift animation from UI-thread indicatorX SharedValue"
```
