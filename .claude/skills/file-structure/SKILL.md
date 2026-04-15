---
name: file-structure
description: Trigger when creating new files, adding features, creating components/hooks/services, moving files, or refactoring structure. Always place files in the correct directory following this structure.
---

# File & Folder Structure

## Project Root Structure

```
mobile-movie-app/
├── app/                          # Expo Router app directory (file-based routing)
│   ├── _layout.tsx              # Root layout with global providers
│   ├── global.css               # Design tokens & Tailwind config
│   ├── (tabs)/                  # Tab group
│   │   ├── _layout.tsx          # Tab navigator
│   │   ├── home/
│   │   ├── menu/
│   │   ├── cart/
│   │   ├── gift-card/
│   │   ├── profile/
│   │   └── perf/                # Dev-only performance tab
│   ├── auth/                    # Auth screens (outside tabs)
│   ├── payment/[order].tsx      # Dynamic payment screen
│   ├── update-order/[order].tsx # Update order screen
│   └── ...
├── components/                   # Reusable UI components
│   ├── ui/                      # Atomic UI components (button, input, card, etc.)
│   ├── button/
│   ├── dialog/
│   ├── cart/
│   ├── menu/
│   ├── profile/
│   ├── navigation/
│   ├── home/
│   └── ...
├── hooks/                        # Custom React hooks
│   ├── use-auth.ts
│   ├── use-cart.ts
│   ├── use-menu.ts
│   └── ...
├── stores/                       # Zustand stores (39 files)
│   ├── user.store.ts
│   ├── cart.store.ts
│   ├── order-flow.store.ts      # 52KB (large)
│   ├── update-order.store.ts    # 29KB (large)
│   ├── selectors/               # Store selectors
│   │   ├── menu-filter.selectors.ts
│   │   ├── order-flow.selectors.ts
│   │   └── ...
│   └── ...
├── api/                          # API services & endpoints
│   ├── index.ts
│   ├── order.ts
│   ├── menu.ts
│   ├── auth.ts
│   └── ...
├── types/                        # TypeScript type definitions
│   ├── index.ts
│   ├── order.ts
│   ├── user.ts
│   └── ...
├── utils/                        # Utility functions
│   ├── http.ts                  # Axios instance + interceptors
│   ├── cn.ts                    # Tailwind classname merger
│   ├── format.ts
│   ├── auth-helpers.ts
│   └── ...
├── constants/                    # Constants & enums
│   ├── colors.constant.ts
│   ├── motion.ts
│   ├── route.constant.ts
│   ├── navigation.config.ts
│   └── ...
├── lib/                          # Internal libraries & configs
│   ├── navigation/              # Navigation engine
│   │   ├── master-transition-provider.tsx
│   │   ├── ghost-mount-provider.tsx
│   │   └── ...
│   ├── http-setup.ts            # Bootstrap HTTP auth
│   ├── shared-element/          # Shared element transitions
│   ├── transitions/             # Animation configs
│   └── ...
├── providers/                    # Context providers
│   ├── toast-provider.tsx
│   ├── i18n-provider.tsx
│   └── ...
├── modules/                      # Native modules
│   ├── cart-price-calc/        # Price calculation engine
│   └── navigation-bar-color/   # Android nav bar color
├── i18n/                         # Internationalization
│   ├── en/                       # English translations
│   └── vi/                       # Vietnamese translations
├── assets/                       # Images, fonts, icons
│   ├── fonts/
│   ├── images/
│   └── icons/
├── patches/                      # patch-package dependencies
├── layouts/                      # Layout components
│   ├── stack-with-master-transition.tsx
│   └── ...
├── metro.config.js              # Metro bundler config
├── tailwind.config.js           # Tailwind CSS config
├── babel.config.js              # Babel config
├── app.json                     # Expo config
├── tsconfig.json                # TypeScript config
├── package.json
└── .env.local                   # Environment variables (not in git)
```

## Directory Details & Rules

### `app/` — Expo Router (File-based Routing)

**Structure**:
- `app/_layout.tsx` — Root layout with **global providers** (QueryClient, GestureHandler, BottomSheet, MasterTransition, SharedElement, Toast, I18n)
- `app/(tabs)/` — Group for tab-based navigation
  - `app/(tabs)/_layout.tsx` — Tab navigator with animated bar
  - Each tab (home, menu, cart, gift-card, profile) has its own folder
- Nested routes use `[id]` syntax: `/payment/[order]`, `/menu/product/[id]`

**File naming**:
- Use `_layout.tsx` for layout files
- Use `index.tsx` for default routes
- Use `[param].tsx` for dynamic routes

### `components/` — Reusable UI Components

**Subdirectories by category**:
- `ui/` — Atomic components (Button, Input, Card, Badge, Modal, Sheet, etc.)
- `button/` — Button variants (QuantitySelector, etc.)
- `dialog/` — Dialog/Modal wrappers
- `cart/` — Cart-specific components
- `menu/` — Menu screen components
- `profile/` — Profile screen components
- `navigation/` — Navigation-related components (TabBar, etc.)
- `home/` — Home screen components
- `form/` — Form wrappers
- `input/` — Input field variants
- `select/` — Select/Dropdown wrappers
- `skeletons/` — Loading skeletons

**File naming**:
- PascalCase: `Button.tsx`, `MenuItem.tsx`
- Barrel exports: `index.tsx` re-exports from component file
- Example:
  ```
  components/button/
  ├── index.tsx         # export { default } from './button'
  ├── button.tsx        # export const Button = ...
  └── quantity-selector.tsx
  ```

### `hooks/` — Custom React Hooks

**Naming**: `use-*.ts`

**Patterns**:
- Data fetching: `use-menu.ts`, `use-order.ts`
- State management: `use-auth.ts`, `use-cart.ts`
- Navigation: `use-screen-transition.ts`, `use-navigation-bar.ts`
- Prefetch: `use-predictive-prefetch.ts`, `use-press-in-prefetch.ts`
- Animations: `use-profile-animation.ts`

**Each hook file exports one function**.

### `stores/` — Zustand State Management

**Current stores** (39 files):
- Large stores: `order-flow.store.ts` (52KB), `update-order.store.ts` (29KB)
- Auth: `auth.store.ts`, `user.store.ts`
- Domain: `cart.store.ts`, `menu.store.ts`, `order.store.ts`, `branch.store.ts`

**Selectors**: `stores/selectors/` — Memoized selectors for store access
- `menu-filter.selectors.ts`
- `order-flow.selectors.ts`

**File naming**: `[domain].store.ts` and `[domain].selectors.ts`

### `api/` — API Services

**Endpoints by domain**:
- `auth.ts` — Login, logout, token refresh
- `order.ts` — Create, fetch, update, cancel orders
- `menu.ts` — Get menu items, specific menus
- `user.ts` / `profile.ts` — User profile, address
- `voucher.ts` — Voucher validation
- `catalog.ts` — Product catalogs
- etc.

**Pattern**:
```tsx
export async function getOrder(id: string): Promise<IApiResponse<IOrder>> {
  const response = await http.get(`/orders/${id}`)
  return response.data
}

export async function createOrder(
  payload: ICreateOrderRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.post('/orders', payload)
  return response.data
}
```

### `types/` — Type Definitions

**Organize by domain**:
- `api.ts` — Generic API types (`IApiResponse<T>`)
- `auth.ts` — Auth types
- `order.ts` — Order & OrderItem types
- `user.ts` — User & Profile types
- `menu.ts` — Menu types
- `index.ts` — Re-exports all types

**Naming convention**: Prefix interfaces with `I` (e.g., `IOrder`)

### `utils/` — Utility Functions

**Utilities by purpose**:
- `http.ts` — Axios instance with interceptors
- `cn.ts` — Tailwind classname merger
- `format.ts` — Format currency, date, etc.
- `auth-helpers.ts` — Auth utility functions
- `storage.ts` — Local/async storage helpers
- `toast.ts` — Toast notification helpers
- `date.ts` — Date utilities

**Rule**: One utility per file or group related ones.

### `constants/` — Configuration & Constants

**Files**:
- `colors.constant.ts` — Color palette
- `motion.ts` — Animation constants
- `route.constant.ts` — Route paths
- `navigation.config.ts` — Navigation config
- `query.constant.ts` — React Query keys
- Domain constants: `order-flow.constant.ts`, `payment.constant.ts`, etc.

### `lib/` — Internal Libraries

**Subfolders**:
- `navigation/` — Custom navigation engine (MasterTransition, GhostMount)
- `shared-element/` — Shared element transition logic
- `transitions/` — Animation configs
- `http-setup.ts` — Bootstrap HTTP auth interceptor
- `fonts/` — Font loading
- `utils/` — Internal utilities

### `providers/` — Context Providers

**Global context providers**:
- `toast-provider.tsx` — Toast notifications
- `i18n-provider.tsx` — i18n configuration
- `notification-provider.tsx` — Push notifications
- `query-provider.tsx` — React Query provider

### `modules/` — Native Modules

**Local modules**:
- `cart-price-calc/` — Native price calculation engine (C++ or native code)
- `navigation-bar-color/` — Android navigation bar color control

### `i18n/` — Internationalization

**Structure**:
```
i18n/
├── en/
│   ├── common.json
│   ├── menu.json
│   ├── cart.json
│   └── ...
└── vi/
    ├── common.json
    ├── menu.json
    └── ...
```

## Creating New Features

### Creating a New Screen

```
app/(tabs)/new-feature/
├── _layout.tsx          # (if nested routes)
├── index.tsx            # Main screen
└── hooks/               # Feature-specific hooks (optional)
```

### Creating a New Component

```
components/new-feature/
├── index.tsx            # Barrel export
├── NewFeatureItem.tsx   # Component
├── NewFeatureHeader.tsx # Sub-component
└── use-new-feature.ts   # Feature hook (if needed)
```

### Creating a New Feature Store

```
stores/new-feature.store.ts
stores/selectors/new-feature.selectors.ts
```

### Creating a New API Service

```
api/new-feature.ts

# Example
export async function getNewFeature(): Promise<IApiResponse<INewFeature>> {
  const response = await http.get('/new-feature')
  return response.data
}
```

## Import Path Aliases

**Configured in `tsconfig.json` & `babel.config.js`**:
- `@/*` → `./` (project root)

**Examples**:
```tsx
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { getOrder } from '@/api/order'
import type { IOrder } from '@/types'
import { cn } from '@/utils/cn'
import { colors } from '@/constants/colors.constant'
```

## Barrel Exports (`index.ts`)

**Use for re-exporting multiple items from a folder**:

```tsx
// components/ui/index.ts
export { Button } from './button'
export { Input } from './input'
export { Card } from './card'

// Usage
import { Button, Input, Card } from '@/components/ui'
```

**Don't create barrel exports for large folders with unrelated items** — be selective.

## Rules Summary

| Category | Location | Case | Re-export |
|----------|----------|------|-----------|
| Component | `components/*/` | PascalCase | Yes (barrel) |
| Hook | `hooks/` | kebab-case | No (named) |
| API Service | `api/` | kebab-case | Re-export in `api/index.ts` |
| Type | `types/` | PascalCase | Re-export in `types/index.ts` |
| Constant | `constants/` | PascalCase | Export as named |
| Util | `utils/` | kebab-case | Export as named |
| Store | `stores/` | kebab-case | Export directly |
