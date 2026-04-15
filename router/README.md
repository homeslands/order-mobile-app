# Router Configuration

Thư mục này chứa cấu hình routes cho ứng dụng React Native với Expo Router.

## Cấu trúc

- `routes.ts` - Định nghĩa sidebar routes với metadata (title, icon, permission)
- `navigation.ts` - Helper functions để navigate với Expo Router

## Expo Router (File-based Routing)

Với Expo Router, routing được định nghĩa bằng cấu trúc file trong thư mục `app/`:

```
app/
  ├── _layout.tsx          # Root layout
  ├── (tabs)/              # Tab group
  │   ├── _layout.tsx      # Tabs layout
  │   ├── home.tsx         # Route: /(tabs)/home
  │   ├── menu.tsx         # Route: /(tabs)/menu
  │   └── profile.tsx      # Route: /(tabs)/profile
  └── onboarding.tsx       # Route: /onboarding
```

## Cách sử dụng

### 1. Navigate trong component

```tsx
import { useRouter } from 'expo-router'
import { ROUTE } from '@/constants'

export default function MyComponent() {
  const router = useRouter()
  
  const handleNavigate = () => {
    // Navigate đến route
    router.push('/menu')
    
    // Hoặc dùng ROUTE constant
    router.push(ROUTE.CLIENT_MENU)
  }
  
  return <Button onPress={handleNavigate} />
}
```

### 2. Sử dụng navigation helper

```tsx
import { useNavigation } from '@/router/navigation'

export default function MyComponent() {
  const { navigate, goBack, goHome } = useNavigation()
  
  return (
    <>
      <Button onPress={() => navigate(ROUTE.CLIENT_MENU)} />
      <Button onPress={goBack} />
      <Button onPress={goHome} />
    </>
  )
}
```

### 3. Sidebar Routes

File `routes.ts` định nghĩa các routes cho sidebar navigation với permissions:

```tsx
import { sidebarRoutes } from '@/router/routes'

// Lấy routes có permission
const allowedRoutes = sidebarRoutes.filter(route => 
  permissions.includes(route.permission)
)
```

## Lưu ý

- Expo Router tự động code splitting, không cần `React.lazy()`
- Paths trong `ROUTE` constants có thể dùng trực tiếp với `router.push()`
- Với dynamic routes, sử dụng `[param]` trong tên file: `app/movie/[id].tsx`
- Groups sử dụng `(groupName)`: `app/(tabs)/home.tsx`

## Migration từ Web Router

Các file sau đã được xóa vì không cần thiết với Expo Router:
- ❌ `router/index.tsx` - Không cần `createBrowserRouter`
- ❌ `router/loadable.tsx` - Expo Router tự động code splitting

