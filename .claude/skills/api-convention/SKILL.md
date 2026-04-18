---
name: api-convention
description: Trigger when creating API services, handling requests/responses, managing authentication, dealing with errors, or any API-related code. Ensures consistent API integration patterns.
---

# API & Service Layer Convention

This project uses **Axios** as the HTTP client with **React Query** for server state management.

## HTTP Client Setup

### Axios Instance Configuration

**File**: `utils/http.ts`

```tsx
import axios, { AxiosInstance } from 'axios'

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_BASE_API_URL ||
  'https://api.example.com'

const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

export { http }
```

### Authentication Setup (Bootstrap)

**File**: `lib/http-setup.ts` — Called at app startup

```tsx
import { configureHttpAuth } from '@/utils/http'
import { useAuthStore, useUserStore } from '@/stores'

configureHttpAuth({
  getAuthState: () => {
    const state = useAuthStore.getState()
    return {
      token: state.token,
      expireTime: state.expireTime,
      refreshToken: state.refreshToken,
      setToken: state.setToken,
      setRefreshToken: state.setRefreshToken,
      setExpireTime: state.setExpireTime,
      setIsRefreshing: state.setIsRefreshing,
      setLogout: state.setLogout,
    }
  },
  onLogout: () => {
    useUserStore.getState().removeUserInfo()
  },
})
```

## API Response Format

### Standard Response Type

```tsx
// types/api.ts
export interface IApiResponse<T> {
  success: boolean
  data: T
  message?: string
  statusCode: number
}
```

### Usage

```tsx
export async function getOrder(id: string): Promise<IApiResponse<IOrder>> {
  const response = await http.get<IApiResponse<IOrder>>(`/orders/${id}`)
  return response.data
}
```

## API Service File Structure

### File Organization

**Each domain gets one file**: `api/[domain].ts`

```
api/
├── index.ts              # Re-exports all services
├── auth.ts              # Login, logout, token
├── order.ts             # Create, fetch, update, cancel
├── menu.ts              # Menu items, catalogs
├── user.ts              # Profile, addresses
├── voucher.ts           # Validate vouchers
└── ...
```

### Service Pattern

```tsx
// api/order.ts
import { IApiResponse, IOrder, ICreateOrderRequest } from '@/types'
import { http } from '@/utils'

export async function getOrders(): Promise<IApiResponse<IOrder[]>> {
  const response = await http.get<IApiResponse<IOrder[]>>('/orders')
  return response.data
}

export async function getOrder(id: string): Promise<IApiResponse<IOrder>> {
  const response = await http.get<IApiResponse<IOrder>>(`/orders/${id}`)
  return response.data
}

export async function createOrder(
  payload: ICreateOrderRequest,
): Promise<IApiResponse<IOrder>> {
  const response = await http.post<IApiResponse<IOrder>>('/orders', payload)
  return response.data
}

export async function updateOrder(
  id: string,
  payload: Partial<IOrder>,
): Promise<IApiResponse<IOrder>> {
  const response = await http.put<IApiResponse<IOrder>>(
    `/orders/${id}`,
    payload,
  )
  return response.data
}

export async function deleteOrder(id: string): Promise<IApiResponse<null>> {
  const response = await http.delete<IApiResponse<null>>(`/orders/${id}`)
  return response.data
}
```

### Key Points

- **One function per endpoint** — no overloading
- **Name matches HTTP verb**: `get*`, `create*`, `update*`, `delete*`
- **Always type response**: `Promise<IApiResponse<T>>`
- **Always type request**: `<IApiResponse<T>>` in `http.method()`
- **Return `response.data`** — unwrap Axios wrapper
- **No error handling** — let consumers handle with try/catch
- **Async/await pattern** — not promise chains

## React Query Integration

### Query Setup

```tsx
// hooks/use-order.ts
import { useQuery } from '@tanstack/react-query'
import { getOrder } from '@/api/order'
import { QUERYKEY } from '@/constants'
import type { IOrder } from '@/types'

export function useOrder(orderId: string) {
  return useQuery<IApiResponse<IOrder>>({
    queryKey: [QUERYKEY.ORDER, orderId],
    queryFn: () => getOrder(orderId),
    staleTime: 30 * 1000, // 30s
    gcTime: 5 * 60 * 1000, // 5min (cache time)
  })
}
```

### Query Configuration

**Default options** (set in `app/_layout.tsx`):

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // Data stale after 30s
      gcTime: 5 * 60 * 1000, // Cache GC after 5min
      retry: 1, // Retry once on failure
      refetchOnWindowFocus: false, // Don't refetch on app focus
    },
  },
})
```

### Mutation Setup

```tsx
// hooks/use-create-order.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createOrder } from '@/api/order'
import { QUERYKEY } from '@/constants'

export function useCreateOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: ICreateOrderRequest) => createOrder(payload),
    onSuccess: (data) => {
      // Invalidate order list to refetch
      queryClient.invalidateQueries({
        queryKey: [QUERYKEY.ORDERS],
      })
      // Show success notification
      showSuccessToast('Order created')
    },
    onError: (error) => {
      showErrorToast(error.message)
    },
  })
}
```

### Query Keys

**Centralized in `constants/query.constant.ts`**:

```tsx
export const QUERYKEY = {
  ORDERS: ['orders'],
  ORDER: ['order'],
  MENU: ['menu'],
  MENU_ITEMS: ['menu-items'],
  USER: ['user'],
  PROFILE: ['profile'],
  VOUCHERS: ['vouchers'],
} as const
```

**Usage**:

```tsx
useQuery({
  queryKey: [QUERYKEY.ORDER, orderId],
  queryFn: () => getOrder(orderId),
})

// Invalidate multiple keys
queryClient.invalidateQueries({
  queryKey: [QUERYKEY.ORDER],
})
```

## Error Handling

### Service Layer Error Handling

```tsx
// api/auth.ts
import axios from 'axios'

export async function login(email: string, password: string) {
  try {
    const response = await http.post<IApiResponse<IAuthToken>>('/auth/login', {
      email,
      password,
    })
    return response.data
  } catch (error) {
    // Map API errors to user-friendly messages
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || 'Login failed'
      throw new Error(message)
    }
    throw error
  }
}
```

### Component Level Error Handling

```tsx
// hooks/use-auth.ts
import { useCallback, useState } from 'react'
import { login as loginApi } from '@/api/auth'
import { showErrorToast } from '@/utils/toast'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const result = await loginApi(email, password)
      useAuthStore.getState().setToken(result.data.token)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed'
      showErrorToast(message)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { login, isLoading }
}
```

### React Query Error Handling

```tsx
const { data, error, isError } = useQuery({
  queryKey: [QUERYKEY.ORDER, id],
  queryFn: () => getOrder(id),
})

if (isError) {
  return (
    <View>
      <Text>Error: {error?.message}</Text>
      <Button onPress={() => refetch()}>Retry</Button>
    </View>
  )
}
```

## Token & Auth Interceptor

### Request Interceptor Pattern

The HTTP client includes an **automatic request interceptor** that:

1. **Adds Bearer token to headers** from `useAuthStore`
2. **Checks token expiry** — refreshes if expired
3. **Queues requests** during refresh — retries after token updated
4. **Handles 401 responses** — triggers logout on auth failure

**Files involved**:

- `utils/http.ts` — Interceptor logic
- `lib/http-setup.ts` — Bootstrap (call at app startup)
- `stores/auth.store.ts` — Token storage

**Example flow**:

```
1. Request made → Interceptor checks token
2. Token expired? → Start refresh flow
3. Queue request → Wait for new token
4. Token refreshed → Retry original request
5. Request succeeds → Return data
```

### No manual token header needed:

```tsx
// ✅ No need to add header manually
export async function getOrder(id: string) {
  const response = await http.get(`/orders/${id}`)
  return response.data
}

// ❌ Don't manually add Authorization header
const response = await http.get(`/orders/${id}`, {
  headers: { Authorization: `Bearer ${token}` },
})
```

## Public Routes (No Auth)

**Routes that don't require authentication**:

```tsx
// utils/http.ts
const publicRoutes = [
  { path: /^\/auth\/login$/, methods: ['post'] },
  { path: /^\/auth\/register$/, methods: ['post'] },
  { path: /^\/menu\/specific\/public$/, methods: ['get'] },
]
```

**These routes skip token injection automatically**.

## Environment Variables

**Setup in `app.json` or `.env.local`**:

```
EXPO_PUBLIC_API_URL=https://api.production.com
EXPO_PUBLIC_BASE_API_URL=https://api.staging.com  # Fallback
```

**Access in code**:

```tsx
const baseURL = process.env.EXPO_PUBLIC_API_URL || 'https://default.com'
```

## Predictive Prefetching

Pre-fetch data before user navigates:

```tsx
// hooks/use-predictive-prefetch.ts
export function usePredictivePrefetch() {
  const queryClient = useQueryClient()

  const prefetchOrder = useCallback((orderId: string) => {
    queryClient.prefetchQuery({
      queryKey: [QUERYKEY.ORDER, orderId],
      queryFn: () => getOrder(orderId),
      staleTime: 30 * 1000,
    })
  }, [queryClient])

  return { prefetchOrder }
}

// Usage in component
const { prefetchOrder } = usePredictivePrefetch()

<Pressable
  onPressIn={() => prefetchOrder(orderId)}
  onPress={() => navigation.navigate('OrderDetail', { orderId })}
>
  View Order
</Pressable>
```

## API Response Caching

### React Query Cache Management

```tsx
// Manual cache invalidation
queryClient.invalidateQueries({
  queryKey: [QUERYKEY.ORDERS],
})

// Set data directly
queryClient.setQueryData([QUERYKEY.ORDER, orderId], newOrderData)

// Prefetch (prevents loading state)
queryClient.prefetchQuery({
  queryKey: [QUERYKEY.MENU],
  queryFn: getMenu,
})
```

### Check if data is cached

```tsx
const cached = queryClient.getQueryData([QUERYKEY.ORDER, id])
if (cached) {
  // Skip loading overlay
  return
}
```

## ✅ Correct API Pattern Example

```tsx
// api/menu.ts
import { getSpecificMenu } from '@/api/menu'
import type { ISpecificMenuRequest, ISpecificMenu } from '@/types'

export async function getSpecificMenu(
  query: ISpecificMenuRequest,
): Promise<IApiResponse<ISpecificMenu>> {
  const response = await http.get<IApiResponse<ISpecificMenu>>(
    '/menu/specific',
    { params: query },
  )
  return response.data
}

// hooks/use-menu.ts
import { useQuery } from '@tanstack/react-query'
import { getSpecificMenu } from '@/api/menu'
import { QUERYKEY } from '@/constants'

export function useMenu(query: ISpecificMenuRequest) {
  return useQuery({
    queryKey: [QUERYKEY.MENU, query],
    queryFn: () => getSpecificMenu(query),
    enabled: !!query.branch,
  })
}

// Component usage
const { data, isLoading, error } = useMenu({
  branch: branchId,
  date: '2024-03-30',
})

if (isLoading) return <SkeletonLoader />
if (error) return <ErrorState error={error} />
return <MenuList items={data?.data} />
```

## ❌ Common Mistakes

| ❌ Don't                           | ✅ Do                           |
| ---------------------------------- | ------------------------------- |
| Import `useAuthStore` in API layer | Pass token via interceptor only |
| Add manual Bearer header           | Let interceptor handle it       |
| Call API directly in components    | Use React Query hooks           |
| Create new `axios` instances       | Use exported `http` client      |
| Ignore error types                 | Check `axios.isAxiosError()`    |
| Return `response` directly         | Return `response.data`          |
| Mix query + mutation patterns      | Use appropriate hook            |
| Hard-code API URLs                 | Use environment variables       |
