---
name: navigation
description: Trigger when creating screens, adding routes, setting up nested navigation, handling deep links, implementing navigation guards, or working on any navigation-related code.
---

# Navigation & Routing Convention

This project uses **Expo Router** (file-based routing) with a **custom navigation engine** for performance optimization and smooth animations.

## Routing Structure

### File-Based Routing (Expo Router)

```
app/
├── _layout.tsx              # Root layout + global providers
├── (tabs)/                  # Tab group — OS-native tab bar (expo-router/unstable-native-tabs)
│   ├── _layout.tsx         # NativeTabs config — home, menu, gift-card, profile, cart (in this order)
│   ├── home.tsx
│   ├── menu/
│   │   ├── _layout.tsx     # Menu nested layout (index only — product moved to root stack)
│   │   ├── index.tsx
│   │   ├── menu-item-row.tsx
│   │   └── menu-filter-bar.tsx
│   ├── menu-detail/
│   │   ├── _layout.tsx
│   │   └── [slug].tsx
│   ├── gift-card.tsx
│   ├── cart.tsx             # Cart tab — last tab, role="search" detached pill on iOS 26+
│   └── profile/
│       ├── _layout.tsx
│       ├── index.tsx       # Profile tab screen — sub-routes below live in root app/profile/
│       └── profile-item.tsx
├── product/
│   └── [id].tsx             # Product detail — root stack, NOT nested under (tabs)/menu anymore
├── profile/                  # Account sub-routes — root stack, NOT nested under (tabs)/profile anymore
│   ├── _layout.tsx
│   ├── edit.tsx
│   ├── general-info.tsx
│   ├── gift-card-hub.tsx
│   ├── loyalty-point-hub.tsx
│   ├── history.tsx
│   └── ...
├── auth/                    # Auth screens (outside tabs)
│   ├── _layout.tsx
│   ├── login.tsx
│   ├── forgot-password.tsx
│   └── register/
├── payment/
│   └── [order].tsx         # Payment flow for order
├── update-order/
│   └── [slug].tsx          # Update order flow
└── ...
```

### Route Naming Convention

| Screen Type  | Pattern                | Example                          |
| ------------ | ---------------------- | --------------------------------- |
| Tab screen   | `/(tabs)/[name]`       | `/(tabs)/home`                   |
| Nested route (inside a tab) | `/(tabs)/[tab]/[name]` | `/(tabs)/menu-detail/[slug]` |
| Standalone (root stack) | `/[name]`  | `/payment/[order]`, `/product/[id]` |
| Dynamic      | `/[name]/[param]`      | `/product/[id]`                  |

## Navigation Object

### Tab Routes

**Defined in**: `constants/navigation.config.ts`

```tsx
const TAB_ROUTES = {
  HOME: '/(tabs)/home',
  MENU: '/(tabs)/menu',
  CART: '/(tabs)/cart',
  GIFT_CARD: '/(tabs)/gift-card',
  PROFILE: '/(tabs)/profile',
} as const
```

### Navigate Between Screens

```tsx
import { useRouter } from 'expo-router'

const router = useRouter()

// Navigate to tab
router.push(TAB_ROUTES.MENU)

// Navigate with params
router.push({
  pathname: '/product/[id]',
  params: { id: '123' },
})

// Navigate to screen outside tabs
router.push({
  pathname: '/payment/[order]',
  params: { order: orderId },
})

// Replace (don't add to history)
router.replace('/(tabs)/home')

// Go back
router.back()

// Reset stack
router.push('/(tabs)/home')
```

## Accessing Route Params

### useLocalSearchParams

```tsx
import { useLocalSearchParams } from 'expo-router'

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()

  return <Text>Product {id}</Text>
}
```

### useRoute (for nested screens)

```tsx
import { useRoute } from '@react-navigation/native'

const route = useRoute()
const { params } = route
```

## Dynamic Routes

### File-based Dynamic Segments

**File**: `app/product/[id].tsx`

```tsx
import { useLocalSearchParams } from 'expo-router'

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  if (!id)
    return (
      <View>
        <Text>No product ID</Text>
      </View>
    )

  return <ProductDetail productId={id} />
}
```

**Navigate to it**:

```tsx
router.push({
  pathname: '/product/[id]',
  params: { id: productId },
})
```

### Catch-All Routes

Not commonly used — prefer specific dynamic routes.

## Layouts & Nesting

### Root Layout

**File**: `app/_layout.tsx`

Sets up **global providers** (QueryClient, GestureHandler, BottomSheet, MasterTransition, Toast, I18n, notifications):

```tsx
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>
        <SafeAreaProvider>
          <MasterTransitionProvider>
            <BottomSheetModalProvider>
              <AppToastProvider>
                <I18nProvider>
                  <NavigationEngineProvider>
                    <SharedElementProvider>
                      <Stack /* or Tabs */ />
                    </SharedElementProvider>
                  </NavigationEngineProvider>
                </I18nProvider>
              </AppToastProvider>
            </BottomSheetModalProvider>
          </MasterTransitionProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
```

### Tabs Layout

**File**: `app/(tabs)/_layout.tsx`

Defines the tab navigator — the OS-native tab bar via `expo-router/unstable-native-tabs`, NOT a custom-drawn tab bar:

```tsx
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs'

export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.primary} labelVisibilityMode="labeled">
      <NativeTabs.Trigger name="home">
        <Icon sf={{ default: 'house', selected: 'house.fill' }} />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>
      {/* menu, gift-card, profile... */}
      <NativeTabs.Trigger
        name="cart"
        role={supportsDetachedSearchTab ? 'search' : undefined}
      >
        <Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
        <Label>{t('tabs.cart')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
```

Cart is a tab (last one) rather than a floating button. On iOS 26+, giving its trigger `role="search"` renders it as a detached pill per Apple HIG — see the version-gating comment in `app/(tabs)/_layout.tsx` for why this must NOT apply below iOS 26.

### Nested Layout Example

**File**: `app/(tabs)/menu/_layout.tsx`

Nested navigation within a tab — the menu tab only has `index` now; `product/[id]` moved out to the root stack (see `app/product/[id].tsx`), so it is no longer declared here:

```tsx
import { Stack } from 'expo-router'

export default function MenuLayout() {
  return <Stack screenOptions={menuScreenOptions} />
}
```

## Screen Options & Headers

### Tab Bar Styling

**File**: `app/(tabs)/_layout.tsx`

`NativeTabs` is styled with props directly on the component — there is no separate `tabsScreenOptions` constant:

```tsx
<NativeTabs
  tintColor={colors.primary}
  iconColor={{ default: colors.mutedForeground, selected: colors.primary }}
  backgroundColor={isAndroid ? colors.card : undefined}
  labelVisibilityMode="labeled"
  indicatorColor={colors.primary}
  minimizeBehavior="onScrollDown"
>
```

### Custom Header

```tsx
export const screenOptions: NativeStackNavigationOptions = {
  headerShown: true,
  header: ({ navigation, route }) => (
    <CustomHeader title={route.name} canGoBack={navigation.canGoBack()} />
  ),
  animationEnabled: true,
  animationTypeForReplace: 'pop',
}
```

### Disable Header

```tsx
<Stack.Screen
  name="details/[id]"
  options={{
    headerShown: false,
  }}
/>
```

## Navigation Engine (Custom)

### Master Transition Provider

Syncs **native stack animation** with **Reanimated shared values** for smooth custom transitions:

**File**: `lib/navigation/master-transition-provider.tsx`

```tsx
export function useMasterTransition() {
  const context = useContext(MasterTransitionContext)
  if (!context) {
    throw new Error('useMasterTransition must be inside provider')
  }
  return context
}
```

### Loading Overlay

Shown during **slow navigations** if data not cached:

```tsx
const masterTransition = useMasterTransition()

// Show during navigation
masterTransition.showLoadingOverlay()

// Auto-hides when data loads
```

**Skip overlay if data cached**:

```tsx
const cached = queryClient.getQueryData(cacheKey)
if (cached) return // Skip loading overlay
```

### Navigation Locking

Prevents concurrent navigations from causing animation conflicts:

```tsx
// Internally managed — don't call manually
// Each navigation waits for previous to complete
```

## Deep Linking

### Deep Link Format

```
https://app.example.com/product/123
```

### Configure in `app.json`

```json
{
  "scheme": "trendcoffee",
  "plugins": [
    [
      "expo-router",
      {
        "origin": "https://app.example.com"
      }
    ]
  ]
}
```

### Handle Deep Links in Code

Expo Router automatically maps URLs to routes:

```
trendcoffee:///payment/order123
→ /payment/[order].tsx with params { order: 'order123' }
```

## Auth Flow & Route Guards

### Auth Check

Typically done at app startup:

```tsx
// In root _layout.tsx
useEffect(() => {
  const checkAuth = async () => {
    const isAuth = useAuthStore.getState().isAuthenticated()
    if (!isAuth) {
      router.replace('/auth/login')
    }
  }
  checkAuth()
}, [])
```

### Protected Routes

Route to auth if not authenticated:

```tsx
export default function ProfileScreen() {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated()) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Please log in</Text>
        <Button onPress={() => router.push('/auth/login')}>Go to Login</Button>
      </View>
    )
  }

  return <ProfileContent />
}
```

## Transition Configuration

### Parallax Transitions

**File**: `lib/transitions/`

```tsx
import { parallaxConfig } from '@/lib/transitions'

// Used internally by MasterTransitionProvider
```

### Shared Element Transitions

**File**: `lib/shared-element/`

```tsx
import { SharedElement } from '@/lib/shared-element'

// Example: Product image animates from list to detail
;<SharedElement id={`product-${product.id}`}>
  <Image source={{ uri: product.image }} />
</SharedElement>
```

## Bottom Sheet Navigation

For selection UIs (size, order type, table, etc.):

```tsx
import { BottomSheetModal } from '@gorhom/bottom-sheet'

export function OrderTypeSheet({ visible, onClose }) {
  const sheetRef = useRef<BottomSheetModal>(null)

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [visible])

  return (
    <BottomSheetModal ref={sheetRef} snapPoints={[300]} onDismiss={onClose}>
      <View className="gap-3 p-4">
        <Pressable onPress={() => selectType('dine-in')}>
          <Text>Dine In</Text>
        </Pressable>
        <Pressable onPress={() => selectType('takeaway')}>
          <Text>Takeaway</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  )
}
```

## Navigation Prefetching

### Predictive Prefetch

Pre-fetch data when user presses (before navigation):

```tsx
import { usePredictivePrefetch } from '@/hooks'

export function MenuList({ items }: { items: IMenuItem[] }) {
  const { prefetchOrder } = usePredictivePrefetch()

  return (
    <FlashList
      data={items}
      renderItem={({ item }) => (
        <Pressable
          onPressIn={() => prefetchOrder(item.id)}
          onPress={() =>
            router.push({
              pathname: '/product/[id]',
              params: { id: item.id },
            })
          }
        >
          <Text>{item.name}</Text>
        </Pressable>
      )}
      keyExtractor={(item) => item.id}
      estimatedItemSize={100}
    />
  )
}
```

## Common Navigation Patterns

### Tab Switch with Params

```tsx
// Home tab → Menu tab with filter
router.push({
  pathname: '/(tabs)/menu',
  params: {
    date: '2024-03-30',
    branch: 'downtown',
  },
})
```

### Product List → Product Detail

```tsx
// Detect product in menu → open detail
const handleSelectProduct = (productId: string) => {
  router.push({
    pathname: '/product/[id]',
    params: { id: productId },
  })
}
```

### Order List → Payment Flow

```tsx
// Profile/history → Payment screen
const handleCheckOrder = (orderId: string) => {
  router.push({
    pathname: '/payment/[order]',
    params: { order: orderId },
  })
}
```

### Cart → Checkout → Payment

```tsx
// Cart page
<Button
  onPress={() => {
    // Create order via mutation
    createOrder(cartItems).then((order) => {
      // Navigate to payment
      router.push({
        pathname: '/payment/[order]',
        params: { order: order.id },
      })
    })
  }}
>
  Proceed to Payment
</Button>
```

## Status Bar & Navigation Bar

### Status Bar Color

```tsx
import { StatusBar } from 'expo-status-bar'
;<StatusBar barStyle="light-content" backgroundColor="#F7A737" />
```

### Android Navigation Bar Color

```tsx
import { setNavigationBarColorFixed } from '@/hooks'

useEffect(() => {
  setNavigationBarColorFixed(colors.primary.light)
}, [])
```

## Navigation Stack Management

### Reset Stack (Logout)

```tsx
router.replace('/auth/login') // Clears history
```

### Replace Instead of Push

```tsx
// Don't add to history
router.replace('/(tabs)/home')

// Add to history (default)
router.push('/(tabs)/home')
```

### dismissTo — Back to a Tab from a Root-Stack Screen

**Trap**: screens like `app/product/[id].tsx` and `app/profile/edit.tsx` live in the root stack, outside `(tabs)`. From there, `router.push('/(tabs)/...')` or `router.replace('/(tabs)/...')` does NOT switch the existing tab — it pushes a whole new tab set on top of the root stack, duplicating it. Use `router.dismissTo(...)` instead: it pops the root-stack screen(s) and lands back on the existing tab set.

```tsx
// app/product/[id].tsx — after adding to cart, go back to the Cart tab
router.dismissTo(TAB_ROUTES.CART)

// app/profile/edit.tsx — bail out to the Profile tab if userInfo is missing
router.dismissTo('/(tabs)/profile')
```

This only applies when navigating from a root-stack screen back into `(tabs)`. Navigating between tab screens, or from `(tabs)` into a root-stack screen, still uses `push`/`replace` as usual.

## Accessibility

### testID

```tsx
<Pressable testID="menu-item-123" onPress={handlePress}>
  <Text>Menu Item</Text>
</Pressable>
```

### Accessibility Labels

```tsx
<Pressable
  accessibilityRole="button"
  accessibilityLabel="Go to menu"
  onPress={() => router.push(TAB_ROUTES.MENU)}
>
  <Text>Menu</Text>
</Pressable>
```

## Performance Tips

1. **Prefetch data** before navigation (usePredictivePrefetch)
2. **Check cache** before showing loading overlay
3. **Use Stack screens carefully** — avoid deep nesting
4. **Lazy load** heavy screens/components
5. **Memoize** navigation callbacks with `useCallback`

---

**Key Rule**: Always use `router.push()` with params, never pass state through context for navigation.
