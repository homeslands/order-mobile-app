# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A food/beverage ordering app (Trend Coffee/Tea) built with React Native + Expo. Despite the repo name "mobile-movie-app", this is a full ordering platform targeting iOS, Android, and Web.

## Common Commands

```bash
# Development
expo start                    # Start dev server
expo run:android              # Run on Android
expo run:ios                  # Run on iOS

# Quality checks
npm run typecheck             # TypeScript strict check (tsc --noEmit)
npm run lint                  # ESLint
npm run lint:fix              # ESLint with auto-fix
npm run check                 # typecheck + lint combined
npm run check-circular        # Detect circular dependencies (madge)
npm run format                # Prettier formatting

# Build
npm run build                 # Web export
npm run build:android         # EAS production Android build
npm run build:ios             # EAS production iOS build
```

## Architecture

### Routing (Expo Router - file-based)

- `app/_layout.tsx` — Root layout with all global providers (QueryClient, GestureHandler, BottomSheet, MasterTransition, SharedElement, Toast, I18n, GhostMount)
- `app/(tabs)/_layout.tsx` — Tab navigator with animated tab bar and floating cart button
- Main tabs: home, menu, cart, gift-card, profile, perf (dev)
- Nested routes: `/(tabs)/menu/product/[id]`, `/auth/*`, `/payment/[order]`, `/update-order/[order]`

### State Management

- **Zustand** (39 stores in `stores/`) — Client state, very granular per-domain stores
- **TanStack React Query** — Server state (API data), 30s stale time, 5min GC
- Key large stores: `order-flow.store.ts` (52KB), `update-order.store.ts` (29KB), `cart.store.ts` (16KB)
- Store selectors live in `stores/selectors/`

### Navigation Engine (`lib/navigation/`)

Custom navigation layer on top of Expo Router with:

- **MasterTransitionProvider** — Syncs native stack animation progress with Reanimated shared values
- **GhostMountProvider** — Pre-mounts routes (e.g., menu) for instant navigation
- **Navigation locking** — Prevents concurrent navigations from causing animation conflicts
- **Transition task queue** — Schedules store updates safely during transitions
- **Loading overlay** — Shows during slow navigations, skipped when QueryClient has cached data

### Styling

- **NativeWind 4.2** (Tailwind CSS for React Native) with CSS variable-based theming
- Custom font: BeVietnamPro (4 weights)
- Prettier auto-sorts Tailwind classes

### Animation

- **React Native Reanimated 4.1** — GPU-accelerated animations
- Parallax configs in `lib/transitions/`
- Shared element transitions in `lib/shared-element/`
- Animation constants in `constants/motion.ts`

### API Layer

- Axios-based clients in `api/` with interceptors
- Environment URLs via `EXPO_PUBLIC_*` variables loaded in `metro.config.js`
- Firebase Cloud Messaging for push notifications

### Forms & Validation

- React Hook Form + Zod, unified via `hooks/use-zod-form.ts`

### Local Native Modules (`modules/`)

- `cart-price-calc` — Price calculation engine
- `navigation-bar-color` — Android navigation bar color control

## Key Patterns

- **Predictive prefetching**: `use-predictive-prefetch`, `use-press-in-prefetch`, `use-viewable-menu-prefetch` — data is fetched before the user navigates
- **Bottom sheets** via `@gorhom/bottom-sheet` are used extensively for selection UIs (order type, table, variants, vouchers)
- **Skeleton screens** for loading states throughout the app
- **Path alias**: `@/*` maps to project root (configured in babel + tsconfig)
- **patch-package** for dependency patches (see `patches/`)

## Code Style

- TypeScript strict mode
- No semicolons, single quotes, trailing commas
- Print width: 80
- React 19 (no need for `import React`)
- NativeWind className-based styling (not StyleSheet)

## Layout Conventions

### Screen types & wrappers

| Screen type                                    | Root wrapper                       | Header                        |
| ---------------------------------------------- | ---------------------------------- | ----------------------------- |
| Tab screen (Home, Menu, Cart, Gift Card)       | `<TabScreenLayout>`                | `<TabHeader>`                 |
| Stack screen (Payment, Order, Notification...) | plain `<View style={{ flex: 1 }}>` | `<FloatingHeader>` (absolute) |
| Profile (custom animated header)               | plain `<View>`                     | custom animated header        |

### Safe area — top

```ts
// ✅ ĐÚNG — Tab screens và Stack screen headers
import { STATIC_TOP_INSET } from '@/constants/status-bar'
paddingTop: STATIC_TOP_INSET

// ❌ SAI — KHÔNG dùng useSafeAreaInsets() cho header/layout tĩnh
const insets = useSafeAreaInsets()
paddingTop: insets.top // gây re-render, có thể flicker khi transition
```

`STATIC_TOP_INSET` được tính 1 lần lúc khởi động app, không hook, không re-render.

### Safe area — bottom

```ts
// ✅ ĐÚNG — bottom sheet, scroll content padding
const insets = useSafeAreaInsets()
paddingBottom: insets.bottom + 16   // dynamic vì bottom có thể thay đổi

// ✅ ĐÚNG — tab screen scroll content
import { TAB_BAR_BOTTOM_PADDING } from '@/components/layout'
contentContainerStyle={{ paddingBottom: TAB_BAR_BOTTOM_PADDING }}
```

### Background color

```ts
// ✅ ĐÚNG — dùng colors constant
import { colors } from '@/constants'
backgroundColor: isDark ? colors.background.dark : colors.background.light

// ❌ SAI — không dùng NativeWind cho root View của tab screen
<View className="bg-background">  // NativeWind ở đây unreliable với dynamic theme
```

### Notification Bell

```tsx
// ✅ ĐÚNG — dùng component có sẵn (badge + navigate + unread count)
import { NotificationBell } from '@/components/notification/notification-bell'
<NotificationBell color={iconColor} />

// ❌ SAI — không tự build lại Bell + badge
<Pressable><Bell /><View>…badge…</View></Pressable>
```

### Key layout files

- `components/layout/tab-header.tsx` — Header cho tab screens (`variant="logo"` hoặc `"title"`)
- `components/layout/tab-screen-layout.tsx` — Root wrapper cho tab screens
- `components/navigation/floating-header.tsx` — Header cho stack screens (back + title + right)
- `constants/status-bar.ts` — `STATIC_TOP_INSET` definition

## 🤖 AI Agent Tools (`.claude/`)

This project has a custom Claude Code setup in `.claude/` with hooks, agents, and skills that activate automatically.

### Hooks (auto-enforced, no manual action needed)

| Hook                       | Fires when                              | Effect                                                    |
| -------------------------- | --------------------------------------- | --------------------------------------------------------- |
| `pre-bash-block-no-verify` | Any `Bash` call                         | Blocks `--no-verify` — fix the hook issue instead         |
| `pre-bash-commit-quality`  | `git commit` via Bash                   | Blocks commit if staged TS/JS files contain `console.log` |
| `post-edit-track`          | Every `Edit` or `Write` on `.ts`/`.tsx` | Warns on `console.log`; tracks files for typecheck        |
| `stop-typecheck`           | End of each Claude response             | Runs `npm run typecheck` if any TS files were edited      |

### Agents (invoke by describing what you want)

| Agent                   | When to use                                                |
| ----------------------- | ---------------------------------------------------------- |
| `performance-optimizer` | "Review perf of X", before shipping list/animation feature |
| `typescript-reviewer`   | "Review types before PR", after adding feature to a store  |
| `silent-failure-hunter` | "Audit payment flow", debugging unexplained failures       |
| `code-simplifier`       | Store > 20KB or component > 200 lines — get a split plan   |

**Example:** _"dùng silent-failure-hunter để audit stores/order-flow.store.ts"_

### Skills (auto-loaded based on context)

| Skill               | Triggers when                                                     |
| ------------------- | ----------------------------------------------------------------- |
| `coding-convention` | Writing any TS/TSX code                                           |
| `ui-components`     | Building or modifying UI components                               |
| `design-tokens`     | Adding colors, spacing, typography                                |
| `file-structure`    | Creating new files or folders                                     |
| `api-convention`    | Writing API services or React Query hooks                         |
| `navigation`        | Adding routes, screens, deep links                                |
| `security-review`   | Auth, payment, token handling, form validation                    |
| `git-workflow`      | Commits, branches, PRs, merge conflicts                           |
| `tdd-workflow`      | Writing or asking about tests                                     |
| `animation`         | Reanimated, press feedback, shared element, parallax, transitions |

---

## ⚡ Performance & Optimization Rules

To maintain a consistent **60fps** and minimize **JS Thread spikes**, all components and features must adhere to the following optimization standards:

### 1. List Rendering

- **Prioritize `FlashList`:** Always use `@shopify/flash-list` instead of the default `FlatList` for long or complex lists (e.g., Product Menu, Order History, Voucher Lists).
- **Estimated Item Size:** You **must** provide a precise `estimatedItemSize` prop to ensure efficient view recycling.

### 2. Rendering & Memoization

- **Strict Memoization:** Wrap all functions passed as props to child components in `useCallback`.
  - Use `useMemo` for any complex logic, data transformations from Zustand stores, or derived state calculations.
- **Pure Components:** Use `memo` (imported from `'react'`) for list items and expensive UI sub-trees to prevent unnecessary re-renders when the parent state changes.
- **Zustand selectors:** Never `useStore()` or spread `{ ...useStore() }` — always select specific slices: `useStore(s => s.field)`.

### 3. Animation & Thread Management

- **UI Thread Execution:** Always perform animations on the **UI Thread** using `react-native-reanimated`. Never use `Animated` from `react-native`.
- **Spring configs:** Always import from `SPRING_CONFIGS` / `MOTION` in `constants/motion.ts`. Never hardcode `damping`/`stiffness` values.
- **Transition task queue:** Wrap heavy Zustand updates, AsyncStorage writes, and analytics calls inside `scheduleTransitionTask(() => { ... })` when they happen after `router.push()`. Running them inline blocks the JS thread during the animation.
- **`runOnJS` sparingly:** Only when bridging back from a Reanimated worklet to JS is unavoidable — always add a comment explaining why.
