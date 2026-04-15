// /**
//  * Navigation helpers for Expo Router
//  * 
//  * Các helper functions để navigate với Expo Router
//  */

// import { ROUTE } from '@/constants'
// import { useRouter } from 'expo-router'
// import { sidebarRoutes } from './routes'

// /**
//  * Convert ROUTE constant path sang Expo Router path
//  * Expo Router sử dụng file-based routing, nên paths cần match với cấu trúc file trong app/
//  */
// export const getExpoRouterPath = (routePath: string): string => {
//   // Bỏ dấu / ở đầu nếu có (Expo Router có thể dùng relative paths)
//   // Hoặc giữ nguyên nếu muốn dùng absolute paths
//   return routePath.startsWith('/') ? routePath.slice(1) : routePath
// }

// /**
//  * Navigate đến một route
//  */
// export const useNavigation = () => {
//   const router = useRouter()

//   return {
//     /**
//      * Navigate đến route
//      */
//     navigate: (path: string, options?: { replace?: boolean }) => {
//       const expoPath = getExpoRouterPath(path)
//       if (options?.replace) {
//         router.replace(expoPath as Parameters<typeof router.replace>[0])
//       } else {
//         router.push(expoPath as Parameters<typeof router.push>[0])
//       }
//     },

//     /**
//      * Navigate đến route từ sidebar routes
//      */
//     navigateToSidebarRoute: (routePath: string, options?: { replace?: boolean }) => {
//       const route = sidebarRoutes.find((r) => r.path === routePath)
//       if (route) {
//         const expoPath = getExpoRouterPath(route.path)
//         if (options?.replace) {
//           router.replace(expoPath as Parameters<typeof router.replace>[0])
//         } else {
//           router.push(expoPath as Parameters<typeof router.push>[0])
//         }
//       }
//     },

//     /**
//      * Go back
//      */
//     goBack: () => {
//       router.back()
//     },

//     /**
//      * Navigate về home
//      */
//     goHome: () => {
//       router.push(ROUTE.CLIENT_HOME as Parameters<typeof router.push>[0])
//     },
//   }
// }

// /**
//  * Hook để check xem route hiện tại có match với route nào không
//  * 
//  * Note: Expo Router không có pathname như web router
//  * Cần sử dụng useSegments() hoặc usePathname() từ expo-router nếu cần
//  */
// export const useCurrentRoute = () => {
//   // Với Expo Router, có thể dùng useSegments() để lấy segments hiện tại
//   // import { useSegments } from 'expo-router'
//   // const segments = useSegments()
  
//   return {
//     /**
//      * Check xem route có active không
//      * Cần truyền currentPath từ component
//      */
//     isActive: (routePath: string, currentPath?: string) => {
//       if (!currentPath) return false
//       return currentPath.includes(routePath)
//     },
    
//     /**
//      * Tìm route từ path
//      */
//     findRoute: (currentPath?: string) => {
//       if (!currentPath) return null
//       return sidebarRoutes.find((route) => currentPath.includes(route.path))
//     },
//   }
// }

