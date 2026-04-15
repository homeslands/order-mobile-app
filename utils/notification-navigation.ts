// import { Capacitor } from '@capacitor/core'
// import { deepLinkHandler } from '@/services/deep-link-handler'

// /**
//  * Parse notification URL - OPTIMIZED for mobile app
//  * Chỉ extract path, không cần check origin/hostname
//  */
// export function parseNotificationUrl(url: string): {
//   path: string
//   fullUrl: string
// } {
//   if (!url) {
//     return { path: '/', fullUrl: '/' }
//   }
  
//   try {
//     // Parse URL để extract path + query + hash
//     const urlObj = new URL(url)
//     const path = urlObj.pathname + urlObj.search + urlObj.hash
    
//     return { path, fullUrl: url }
//   } catch {
//     // Fallback: relative path
//     const path = url.startsWith('/') ? url : `/${url}`
//     return { path, fullUrl: url }
//   }
// }

// /**
//  * Navigate to notification URL - OPTIMIZED
//  * Dùng Deep Link Handler để xử lý thống nhất
//  * 
//  * @param url - URL from notification data (support both full URL and relative path)
//  * @param navigate - React Router navigate function
//  */
// export async function navigateToNotificationUrl(
//   url: string,
//   navigate: (path: string) => void
// ): Promise<void> {
//   if (!url) {
//     // eslint-disable-next-line no-console
//     console.warn('🔗 [Navigation] Empty URL, skipping')
//     return
//   }

//   // Use Deep Link Handler to handle navigation
//   if (Capacitor.isNativePlatform()) {
//     // Register callback nếu chưa có
//     deepLinkHandler.registerNavigationCallback(navigate)
//     // Navigate through handler
//     deepLinkHandler.navigate(url)
//   } else {
//     // Web: Simple navigation
//     const parsed = parseNotificationUrl(url)
//     navigate(parsed.path)
//   }
// }