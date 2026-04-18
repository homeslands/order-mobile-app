---
name: tdd-workflow
description: Trigger when writing tests, adding test files, or when the user asks how to test a component, hook, store, or API service in this React Native + Expo project. Provides the testing stack, file conventions, and Arrange/Act/Assert patterns specific to this codebase.
---

# TDD Workflow — React Native (Trend Coffee)

## Testing Stack

| Tool                                                               | Purpose                                        |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| **Jest** + `jest-expo`                                             | Test runner, configured for Expo               |
| **React Native Testing Library** (`@testing-library/react-native`) | Component rendering + interaction              |
| **MSW** (`msw`) or `jest.mock`                                     | API mocking                                    |
| **Zod**                                                            | Validates test fixture shapes match real types |

---

## File Conventions

```
# Co-locate tests next to the file they test
components/cart/cart-item-row.tsx
components/cart/__tests__/cart-item-row.test.tsx

hooks/use-cart.ts
hooks/__tests__/use-cart.test.ts

stores/cart.store.ts
stores/__tests__/cart.store.test.ts

api/order.ts
api/__tests__/order.test.ts
```

**Rules:**

- Test files live in `__tests__/` inside the same folder as the file under test
- Filename: `<source-file>.test.ts` or `<source-file>.test.tsx`
- Test IDs in components: `testID="cart-item-{id}"` — use in queries

---

## Arrange / Act / Assert Pattern

Every test block follows this structure:

```ts
it('should add item to cart when quantity is valid', () => {
  // Arrange — set up the precondition
  const { result } = renderHook(() => useCartStore())
  const item: ICartItem = { id: '1', name: 'Latte', price: 45000, quantity: 1 }

  // Act — perform the operation
  act(() => {
    result.current.addItem(item)
  })

  // Assert — verify the outcome
  expect(result.current.items).toHaveLength(1)
  expect(result.current.items[0].id).toBe('1')
})
```

---

## Component Tests

```tsx
// components/cart/__tests__/cart-item-row.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { CartItemRow } from '../cart-item-row'

const mockItem: ICartItem = {
  id: '1',
  name: 'Latte',
  price: 45000,
  quantity: 2,
}

describe('CartItemRow', () => {
  it('renders item name and price', () => {
    render(<CartItemRow item={mockItem} onRemove={jest.fn()} />)

    expect(screen.getByText('Latte')).toBeTruthy()
    expect(screen.getByText('90,000đ')).toBeTruthy()
  })

  it('calls onRemove when swipe delete is triggered', () => {
    const onRemove = jest.fn()
    render(<CartItemRow item={mockItem} onRemove={onRemove} />)

    fireEvent.press(screen.getByTestId('cart-item-remove-1'))

    expect(onRemove).toHaveBeenCalledWith('1')
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('does not render when item is undefined', () => {
    // Edge case — guard against undefined data from API
    const { toJSON } = render(
      <CartItemRow item={undefined as any} onRemove={jest.fn()} />,
    )
    expect(toJSON()).toBeNull()
  })
})
```

**Queries to use (in priority order):**

1. `getByTestId` — when testID is set (preferred for RN)
2. `getByText` — visible text content
3. `getByRole` — accessibility role
4. `getByDisplayValue` — input values
5. **Never** use `getByClassName` or DOM-specific queries

---

## Hook Tests

```ts
// hooks/__tests__/use-cart.test.ts
import { renderHook, act } from '@testing-library/react-native'
import { useCart } from '../use-cart'

// Reset store between tests
beforeEach(() => {
  useCartStore.getState().reset()
})

describe('useCart', () => {
  it('adds item and recalculates total', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addItem({ id: '1', price: 45000, quantity: 1 })
    })

    expect(result.current.total).toBe(45000)
  })

  it('clamps quantity to max 10', () => {
    const { result } = renderHook(() => useCart())

    act(() => {
      result.current.addItem({ id: '1', price: 10000, quantity: 99 })
    })

    expect(result.current.items[0].quantity).toBe(10)
  })
})
```

---

## Zustand Store Tests

```ts
// stores/__tests__/cart.store.test.ts
import { useCartStore } from '../cart.store'

beforeEach(() => {
  useCartStore.setState(useCartStore.getInitialState())
})

describe('cartStore', () => {
  it('initial state is empty', () => {
    const { items, total } = useCartStore.getState()
    expect(items).toHaveLength(0)
    expect(total).toBe(0)
  })

  it('addItem appends item to list', () => {
    const { addItem } = useCartStore.getState()
    addItem({ id: '1', name: 'Matcha', price: 55000, quantity: 1 })

    expect(useCartStore.getState().items).toHaveLength(1)
  })

  it('removeItem removes by id', () => {
    useCartStore.setState({
      items: [{ id: '1', name: 'Matcha', price: 55000, quantity: 1 }],
    })

    useCartStore.getState().removeItem('1')

    expect(useCartStore.getState().items).toHaveLength(0)
  })
})
```

---

## API Service Tests

```ts
// api/__tests__/order.test.ts
import { createOrder } from '../order'
import { http } from '@/utils'

// Mock the axios http instance
jest.mock('@/utils/http', () => ({
  post: jest.fn(),
}))

const mockHttp = http as jest.Mocked<typeof http>

describe('createOrder', () => {
  it('posts to /orders and returns typed response', async () => {
    const mockResponse: IApiResponse<IOrder> = {
      success: true,
      statusCode: 201,
      data: { id: 'order-1', total: 90000, status: 'pending', items: [] },
    }
    mockHttp.post.mockResolvedValueOnce({ data: mockResponse })

    const result = await createOrder({ items: [], notes: '' })

    expect(mockHttp.post).toHaveBeenCalledWith('/orders', {
      items: [],
      notes: '',
    })
    expect(result.data.id).toBe('order-1')
  })

  it('propagates axios errors without swallowing', async () => {
    mockHttp.post.mockRejectedValueOnce(new Error('Network Error'))

    await expect(createOrder({ items: [] })).rejects.toThrow('Network Error')
  })
})
```

---

## React Query Hook Tests

```tsx
// hooks/__tests__/use-order.test.tsx
import { renderHook, waitFor } from '@testing-library/react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useOrder } from '../use-order'
import * as orderApi from '@/api/order'

jest.mock('@/api/order')
const mockGetOrder = orderApi.getOrder as jest.Mock

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useOrder', () => {
  it('returns order data on success', async () => {
    mockGetOrder.mockResolvedValue({
      success: true,
      statusCode: 200,
      data: { id: 'order-1', total: 90000 },
    })

    const { result } = renderHook(() => useOrder('order-1'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data?.data.id).toBe('order-1')
  })

  it('sets isError when API fails', async () => {
    mockGetOrder.mockRejectedValue(new Error('Not found'))

    const { result } = renderHook(() => useOrder('bad-id'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

---

## What to Test vs What Not to Test

### ✅ Always test

- Business logic in stores (add, remove, update, price calc)
- API functions — success response shape and error propagation
- Custom hooks — state transitions, side effects
- Form validation schemas (Zod)
- Navigation guards (auth check logic)
- Edge cases: empty arrays, null data, network errors

### ❌ Don't test

- NativeWind class names (implementation detail)
- Reanimated animation values (UI thread, mock is complex)
- Component pixel positions or layout metrics
- Third-party library internals (FlashList rendering, BottomSheet snap)
- `console.log` output

---

## TDD Cycle

```
1. RED   — Write a failing test for the desired behavior
2. GREEN — Write the minimum code to make it pass
3. REFACTOR — Clean up without breaking the test

Repeat per behavior unit.
```

**Practical rule:** Write the test first when adding to stores, hooks, or API functions. Write the component first (then test) for UI-heavy work where the shape isn't clear yet.

---

## Running Tests

```bash
# All tests
npx jest

# Watch mode (during development)
npx jest --watch

# Single file
npx jest cart.store.test.ts

# Coverage report
npx jest --coverage
```

**Coverage targets (aim for, not enforced by CI yet):**

- Stores: > 80%
- API functions: > 90%
- Critical hooks (auth, cart, order-flow): > 75%
