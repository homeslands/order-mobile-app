---
name: coding-convention
description: Trigger when writing any code (components, hooks, services, utilities, types). Guide all code structure, naming, formatting, imports, and patterns to maintain consistency.
---

# Coding Conventions

This project follows **TypeScript strict mode**, **React 19**, and **NativeWind** styling conventions.

## General Format Rules

- **No semicolons** at end of statements
- **Single quotes** for strings
- **Trailing commas** in multiline arrays/objects
- **Print width**: 80 characters
- **Prettier** auto-formats on save

## Naming Conventions

### Files & Folders

| Type                 | File name  | Export name | Example                                          |
| -------------------- | ---------- | ----------- | ------------------------------------------------ |
| Component            | kebab-case | PascalCase  | `button.tsx` → `export const Button`             |
| Component (compound) | kebab-case | PascalCase  | `cart-item-row.tsx` → `export const CartItemRow` |
| Hook                 | kebab-case | camelCase   | `use-auth.ts` → `export function useAuth`        |
| Service/API          | kebab-case | camelCase   | `order.ts` → `export async function createOrder` |
| Util                 | kebab-case | camelCase   | `cn.ts` → `export function cn`                   |
| Type/Interface file  | kebab-case | PascalCase  | `types/order.ts` → `export interface IOrder`     |
| Constant file        | kebab-case | camelCase   | `colors.constant.ts` → `export const colors`     |
| Store                | kebab-case | camelCase   | `user.store.ts` → `export const useUserStore`    |

### Components

```tsx
// File: button.tsx
import { forwardRef } from 'react'
import { Pressable, type PressableProps } from 'react-native'
import { cn } from '@/utils/cn'

export interface ButtonProps extends PressableProps {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  className?: string
}

export const Button = forwardRef<
  React.ElementRef<typeof Pressable>,
  ButtonProps
>(({ className, variant = 'default', size = 'md', ...props }, ref) => {
  // Component logic
})

Button.displayName = 'Button'
```

**Key points**:

- Use `React.forwardRef` for UI components
- Set `displayName` for debugging
- Use `className` + `cn()` utility for Tailwind merging
- Props interface extends base component props
- Default variants defined

### Hooks

```tsx
// File: use-auth.ts
import { useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth.store'

export function useAuth() {
  // ✅ Select only the fields needed — never spread the whole store
  // Spreading triggers re-render on ANY store change
  const setToken = useAuthStore((s) => s.setToken)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true)
      try {
        const result = await authService.login(email, password)
        setToken(result.token)
        return result
      } finally {
        setIsLoading(false)
      }
    },
    [setToken],
  )

  return { isAuthenticated, login, isLoading }
}
```

**Key points**:

- Custom hooks start with `use` prefix
- **Never** `return { ...useStore() }` — subscribe only to specific slices via selectors
- Wrap callbacks with `useCallback` when passed to children
- Use `useMemo` for complex derived state
- Return only the fields the consumer needs

### Services / API Functions

```tsx
// File: api/order.ts
import { IApiResponse, IOrder } from '@/types'
import { http } from '@/utils'

export async function createOrder(
  payload: ICreateOrderRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.post<IApiResponse<IOrder>>('/orders', payload)
  return response.data
}

export async function getOrder(orderId: string): Promise<IApiResponse<IOrder>> {
  const response = await http.get<IApiResponse<IOrder>>(`/orders/${orderId}`)
  return response.data
}
```

**Key points**:

- Always type API responses with `IApiResponse<T>`
- One function per endpoint
- Function names match HTTP verbs: `get*`, `create*`, `update*`, `delete*`
- Import from `@/utils` (http client)
- Async/await pattern

### Utilities

```tsx
// File: utils/cn.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// File: utils/format.ts
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
```

**Key points**:

- Pure functions (no side effects)
- Short, focused utilities
- Export as named exports
- Document complex logic with comments

### Types & Interfaces

```tsx
// File: types/order.ts
export interface IOrder {
  id: string
  userId: string
  items: IOrderItem[]
  total: number
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

export interface IOrderItem {
  productId: string
  quantity: number
  price: number
  notes?: string
}

export interface ICreateOrderRequest {
  items: Omit<IOrderItem, 'price'>[]
  notes?: string
  deliveryAddress?: string
}

export interface IApiResponse<T> {
  success: boolean
  data: T
  message?: string
  statusCode: number
}
```

**Key points**:

- Prefix interfaces with `I` (e.g., `IOrder`)
- Group related types in same file
- Use `Omit<>`, `Pick<>`, `Partial<>` for type composition
- Request/response types clearly named: `ICreateOrderRequest`, `IApiResponse`

### Zustand Stores

```tsx
// File: stores/user.store.ts
import { create } from 'zustand'
import type { IUser } from '@/types'

interface UserState {
  userInfo: IUser | null
  isLoading: boolean
  setUserInfo: (user: IUser) => void
  removeUserInfo: () => void
  setLoading: (loading: boolean) => void
}

export const useUserStore = create<UserState>((set) => ({
  userInfo: null,
  isLoading: false,
  setUserInfo: (user) => set({ userInfo: user }),
  removeUserInfo: () => set({ userInfo: null }),
  setLoading: (loading) => set({ isLoading: loading }),
}))
```

**Key points**:

- Define state interface separately
- Actions are methods in the store
- Use `set()` to update state
- Export with `use*` prefix for hooks

## Import Order

```tsx
// 1. React & React Native
// React 19: no default import needed — import named exports only
import { useState, useCallback, memo } from 'react'
import { View, Text } from 'react-native'

// 2. External libraries
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'

// 3. Internal: Components
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

// 4. Internal: Hooks
import { useAuth } from '@/hooks/use-auth'

// 5. Internal: Utils, Services, Types
import { cn } from '@/utils/cn'
import { getOrder } from '@/api/order'
import type { IOrder } from '@/types'

// 6. Styles (if using CSS files)
import styles from './Order.module.css'
```

## Component Structure Template

```tsx
// imports

interface OrderDetailProps {
  orderId: string
}

export const OrderDetail = memo<OrderDetailProps>(({ orderId }) => {
  // Hooks
  const { isAuthenticated } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId),
    enabled: isAuthenticated,
  })

  // Memoized callbacks
  const handleCancel = useCallback(async () => {
    // Logic
  }, [])

  // Render logic
  if (isLoading) return <SkeletonLoader />
  if (!data) return <EmptyState />

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      <Text className="text-lg font-semibold">{data.id}</Text>
      <Button onPress={handleCancel}>Cancel Order</Button>
    </View>
  )
})

OrderDetail.displayName = 'OrderDetail'
```

## Performance & Optimization Rules

### Memoization Requirements

```tsx
// ✅ Memoize expensive components
const MenuItem = memo<MenuItemProps>(({ item }) => {
  return <View>{/* render */}</View>
})

// ✅ Wrap callbacks passed to children
const handlePress = useCallback(() => {
  // Logic
}, [dependency])

// ✅ Memoize derived state
const filteredItems = useMemo(() => {
  return items.filter(item => item.price > minPrice)
}, [items, minPrice])

// ❌ Don't create callbacks inline
<Button onPress={() => handlePress(item)} /> // Bad

// ❌ Don't create objects inline in render
<FlatList renderItem={({ item }) => <Card data={{ id: item.id }} />} /> // Bad
```

### List Rendering

```tsx
// ✅ Always use FlashList with estimatedItemSize
import { FlashList } from '@shopify/flash-list'

<FlashList
  data={items}
  renderItem={({ item }) => <MenuItem item={item} />}
  keyExtractor={(item) => item.id}
  estimatedItemSize={100}
/>

// ❌ Don't use FlatList for long lists
<FlatList data={items} /> // Slow for 100+ items
```

## Async/Await Pattern

```tsx
// ✅ Use async/await
async function fetchData() {
  try {
    const result = await getOrder(orderId)
    setOrder(result.data)
  } catch (error) {
    console.error('Failed to fetch order:', error)
    showErrorToast('Failed to load order')
  }
}

// ✅ In React Query
const { data, error, isLoading } = useQuery({
  queryKey: ['order', orderId],
  queryFn: () => getOrder(orderId),
})

// ❌ Avoid promise chains
getOrder(orderId)
  .then((data) => setOrder(data))
  .catch((error) => console.error(error))
```

## Error Handling

```tsx
// ✅ Error handling pattern
try {
  const order = await createOrder(payload)
  store.addOrder(order)
  showSuccessToast('Order created')
} catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error'
  console.error('Failed to create order:', message)
  showErrorToast(message)
}

// ✅ API error handling (in services)
export async function getOrder(id: string) {
  try {
    const response = await http.get(`/orders/${id}`)
    return response.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || 'API Error')
    }
    throw error
  }
}
```

## Anti-Patterns to Avoid

| ❌ Don't                    | ✅ Do Instead                    |
| --------------------------- | -------------------------------- |
| Inline objects in props     | Extract to `useMemo` or variable |
| Create callbacks in render  | Wrap with `useCallback`          |
| Abbreviate variable names   | Use clear, descriptive names     |
| Comments explaining "what"  | Comment only the "why"           |
| Nested ternaries            | Use early returns or switch      |
| Prop drilling deep          | Use context or Zustand           |
| Large monolithic components | Split into smaller components    |
| Hard-coded values           | Use constants or env variables   |

## Comments & Documentation

```tsx
// ✅ Good: Explains WHY
// Skip loading overlay if data cached (perf optimization)
const cached = queryClient.getQueryData(cacheKey)
if (cached) return

// ❌ Bad: States the obvious
// Set isLoading to true
setIsLoading(true)

// ✅ Good: Complex logic needs explanation
// Token refresh: queue failed requests while refreshing
const processQueue = (error, token) => {
  failedQueue.forEach((prom) => {
    if (token) prom.resolve(token)
    else prom.reject(error)
  })
}
```

## TypeScript Strict Mode

Always enable strict mode checks. All files must pass:

```bash
npm run typecheck
```

Common strict mode requirements:

- No `any` types (use `unknown` and narrow)
- All function return types explicit
- No null/undefined without explicit handling
- Props interfaces always typed

```tsx
// ✅ Typed
interface Props {
  onPress: (id: string) => void
  loading?: boolean
}

function Component({ onPress, loading = false }: Props): JSX.Element {
  return <Button onPress={() => onPress('123')} />
}

// ❌ Loose (fails typecheck)
function Component({ onPress, loading }) {
  return <Button onPress={() => onPress('123')} />
}
```
