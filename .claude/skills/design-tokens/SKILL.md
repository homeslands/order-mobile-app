---
name: design-tokens
description: Trigger when creating components, updating styles, adding colors, or working with typography, spacing, shadows, or design tokens. Always reference these tokens when styling UI elements in React Native + NativeWind.
---

# Design Tokens & Theme System

This project uses **NativeWind 4.2** (Tailwind CSS for React Native) with CSS variable-based theming defined in `app/global.css`.

## Colors

### Primary

- **Light mode**: `#F7A737` (hsl(35, 93%, 55%))
- **Dark mode**: `#D68910` (hsl(35, 70%, 53%))
- **Tailwind class**: `bg-primary`, `text-primary`, `border-primary`

### Semantic Colors

#### Destructive (Red)

- **Light**: `#ef4444` (hsl(0, 84.2%, 60.2%))
- **Dark**: `#dc2626` (hsl(355, 87%, 47%))
- **Class**: `bg-destructive`, `text-destructive-foreground`

#### Success (Green)

- **Light**: `#22c55e` | **Dark**: `#4ade80`
- **Backgrounds**: `bg-green-50` (light), `bg-green-900/20` (dark)
- **Borders**: `border-green-200` (light), `border-green-800` (dark)
- **Usage**: Status indicators, verification badges

#### Warning (Amber)

- **Light**: `#f59e0b` | **Dark**: `#fbbf24`
- **Backgrounds**: `bg-amber-50` (light), `bg-amber-900/20` (dark)
- **Borders**: `border-amber-200` (light), `border-amber-800` (dark)
- **Usage**: Unverified status, alerts

### Neutral & Gray Scale

| Level | Hex Value | Class                            |
| ----- | --------- | -------------------------------- |
| 50    | `#f9fafb` | `bg-gray-50`                     |
| 100   | `#f3f4f6` | `bg-gray-100`                    |
| 200   | `#e5e7eb` | `bg-gray-200`                    |
| 300   | `#d1d5db` | `bg-gray-300`                    |
| 400   | `#9ca3af` | `bg-gray-400`                    |
| 500   | `#6b7280` | `bg-gray-500` (muted foreground) |
| 600   | `#4b5563` | `bg-gray-600`                    |
| 700   | `#374151` | `bg-gray-700`                    |
| 800   | `#1f2937` | `bg-gray-800`                    |
| 900   | `#111827` | `bg-gray-900`                    |

### Theme Variables (Light/Dark)

All tokens defined in [app/global.css](app/global.css) as HSL space-separated values for NativeWind.
Programmatic access (non-Tailwind): use `colors` from `@/constants/colors.constant`.

| Token                | Tailwind class                      | Light                          | Dark                           |
| -------------------- | ----------------------------------- | ------------------------------ | ------------------------------ |
| `--background`       | `bg-background`                     | `hsl(210,16%,96%)` `#F0F2F5`   | `hsl(220,12%,7%)` `#0F0F10`    |
| `--foreground`       | `text-foreground`                   | `hsl(20,14.3%,4.1%)` `#0a0a0a` | `hsl(60,9.1%,97.8%)` `#fafafa` |
| `--card`             | `bg-card`                           | `hsl(0,0%,100%)` `#ffffff`     | `hsl(0,0%,12.55%)` `#1c1c1e`   |
| `--primary`          | `bg-primary` `text-primary`         | `hsl(35,93%,55%)` `#F7A737`    | `hsl(35,70%,53%)` `#D68910`    |
| `--secondary`        | `bg-secondary`                      | `hsl(60,4.8%,95.9%)`           | `hsl(0,0%,18%)`                |
| `--muted`            | `bg-muted`                          | `hsl(60,4.8%,95.9%)`           | `hsl(0,0%,18%)`                |
| `--muted-foreground` | `text-muted-foreground`             | `hsl(25,5.3%,44.7%)` `#6b7280` | `hsl(24,5.4%,63.9%)` `#9ca3af` |
| `--accent`           | `bg-accent`                         | `hsl(60,4.8%,95.9%)`           | `hsl(0,0%,18%)`                |
| `--destructive`      | `bg-destructive` `text-destructive` | `hsl(0,84.2%,60.2%)` `#ef4444` | `hsl(355,87%,47%)` `#dc2626`   |
| `--border`           | `border-border`                     | `hsl(20,5.9%,90%)` `#e5e7eb`   | `hsl(0,0%,18%)` `#2e2e2e`      |
| `--input`            | `border-input`                      | same as `--border`             | same as `--border`             |
| `--ring`             | `ring` (focus)                      | `hsl(20,14.3%,4.1%)`           | `hsl(24,5.7%,82.9%)`           |

## Typography

### Font Family

- **Custom font**: BeVietnamPro (4 weights)
  - Regular (400): `font-sans`
  - Medium (500): `font-sans-medium`
  - SemiBold (600): `font-sans-semibold`
  - Bold (700): `font-sans-bold`

### Font Sizes & Classes

| Size | Class       | Notes          |
| ---- | ----------- | -------------- |
| xs   | `text-xs`   | 12px           |
| sm   | `text-sm`   | 14px           |
| base | `text-base` | 16px (default) |
| lg   | `text-lg`   | 18px           |
| xl   | `text-xl`   | 20px           |

### Font Weight Classes

- `font-medium` — Medium weight (500)
- `font-semibold` — SemiBold (600)
- `font-bold` — Bold (700)

## Spacing & Layout

### Padding & Margin Scales

```
px-2, px-3, px-4, px-5, px-6, px-8  (standard padding)
py-2, py-3, py-4, py-5, py-6, py-8  (standard padding)
m-2, m-3, m-4, m-5, m-6, m-8        (standard margin)
gap-2, gap-3, gap-4, gap-5, gap-6   (flex/grid gaps)
```

### Common Spacing Values

- **Compact**: `px-3 py-2`
- **Standard**: `px-4 py-3`
- **Spacious**: `px-5 py-4`
- **Large**: `px-8 py-6`

## Border Radius

| Token | Value                       | Classes                                |
| ----- | --------------------------- | -------------------------------------- |
| `lg`  | `var(--radius)`             | `rounded-lg` (0.5rem)                  |
| `md`  | `calc(var(--radius) - 2px)` | `rounded-md`                           |
| `sm`  | `calc(var(--radius) - 4px)` | `rounded-sm`                           |
| Full  | —                           | `rounded-full` (for circular elements) |

## Shadows

> **Android caveat:** NativeWind `shadow-*` classes only render on **iOS**. For Android use `elevation` via inline style or a wrapper.

```tsx
// ✅ Cross-platform shadow
<View
  className="shadow-md"                    // iOS
  style={{ elevation: 4 }}                 // Android
>

// ✅ iOS only (cards in modal sheets — Android uses bg contrast instead)
<View className="shadow-sm bg-card rounded-lg" />

// ❌ Don't rely on shadow-* for Android visibility
<View className="shadow-lg" /> // invisible on Android
```

| Class       | iOS effect      | Android equivalent |
| ----------- | --------------- | ------------------ |
| `shadow-sm` | Subtle (cards)  | `elevation: 2`     |
| `shadow-md` | Medium (modals) | `elevation: 4`     |
| `shadow-lg` | Prominent       | `elevation: 8`     |

## Usage Patterns

### ✅ Correct Usage

```tsx
// Color
<View className="bg-primary px-4 py-3 rounded-lg">
  <Text className="text-white font-semibold text-lg">Primary Button</Text>
</View>

// Dark mode support
<View className="bg-white dark:bg-gray-900 px-4 py-3">
  <Text className="text-foreground">Auto theme support</Text>
</View>

// Semantic colors
<View className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
  <Text className="text-success-light dark:text-success-dark">Success!</Text>
</View>

// Spacing
<View className="flex-row items-center gap-3 px-4 py-3">
  <Icon />
  <Text>Content</Text>
</View>
```

### ❌ Avoid

```tsx
// Hard-coded colors instead of tokens
<View style={{ backgroundColor: '#FF0000' }} /> // Use text-destructive instead

// Inconsistent spacing
<View style={{ padding: 12, marginRight: 8 }} /> // Use NativeWind classes

// Missing dark mode
<Text className="text-black"> // Should use text-foreground

// Arbitrary colors without semantic meaning
<View className="bg-blue-500" /> // Use semantic colors when possible
```

## Implementation in Code

### Importing colors for non-Tailwind use

```tsx
import { colors } from '@/constants/colors.constant'

// Example: Using colors in native styles
<ActivityIndicator color={colors.primary.light} />
<StatusBar barStyle="light-content" />
```

### CSS Variable Access

All Tailwind colors map to CSS variables defined in `app/global.css`:

```css
--background: 210 16% 96%;
--primary: 35 93% 55%;
/* Use as: bg-primary, text-primary, border-primary */
```

---

**Key Rule**: Always use Tailwind utility classes from this design system. Hard-coded colors or arbitrary values break the theme consistency and dark mode support.
