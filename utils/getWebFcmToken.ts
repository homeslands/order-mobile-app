// // src/utils/getWebFcmToken.ts
// /* eslint-disable no-console */
// import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging'
// import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
// import { getFirebaseConfig, getVapidKey } from '@/lib/firebase-config'
// import { Capacitor } from '@capacitor/core'

// interface FirebaseMessagePayload {
//   notification?: {
//     title?: string
//     body?: string
//   }
//   data?: Record<string, string>
//   messageId?: string
//   fcmMessageId?: string
//   [key: string]: unknown // Allow other properties
// }

// let messagingInstance: Messaging | null = null
// let firebaseApp: FirebaseApp | null = null

// /**
//  * Reset Firebase instances (for testing or when config changes)
//  */
// export function resetFirebaseInstances(): void {
//   messagingInstance = null
//   firebaseApp = null
// }

// /**
//  * Check và log Firebase Project ID từ tất cả các nguồn
//  * Dùng để debug khi có conflict project ID
//  * 
//  * Gọi function này trong browser console để debug:
//  * import { checkFirebaseProjectId } from '@/utils/getWebFcmToken'
//  * checkFirebaseProjectId()
//  */
// export function checkFirebaseProjectId(): void {
//   const config = getFirebaseConfig()
//   const existingApps = getApps()
  
//   console.group('🔍 [Firebase Project ID Check]')
  
//   // 1. Env Var
//   const envVar = import.meta.env.VITE_FIREBASE_PROJECT_ID || ''
  
//   // Check conflicts
//   const allProjectIds = [
//     envVar,
//     config.projectId,
//     ...existingApps.map((app) => app.options?.projectId).filter(Boolean),
//     firebaseApp?.options?.projectId,
//     messagingInstance?.app?.options?.projectId,
//   ].filter(Boolean) as string[]
  
//   const uniqueIds = new Set(allProjectIds)
  
//   console.groupEnd()
  
//   if (uniqueIds.size > 1) {
//     console.error('❌ CONFLICT DETECTED! Multiple project IDs found:', Array.from(uniqueIds))
//   }
// }

// /**
//  * Initialize Firebase app (singleton)
//  */
// function initializeFirebaseApp(): FirebaseApp | null {
//   if (firebaseApp) {
//     return firebaseApp
//   }

//   const config = getFirebaseConfig()

//   // Check if config is valid
//   if (!config.apiKey || !config.projectId) {
//     console.error('[getWebFcmToken] Firebase config is missing or invalid')
//     return null
//   }
  
//   // Check appId format for web
//   if (config.appId && (config.appId.includes(':android:') || config.appId.includes(':ios:'))) {
//     console.error('[getWebFcmToken] ❌ Invalid appId format for web platform:', {
//       appId: config.appId,
//       detectedType: config.appId.includes(':android:') ? 'Android' : 'iOS',
//       solution: 'Check VITE_FIREBASE_APP_ID_WEB env var is set correctly',
//     })
//     return null
//   }

//   // Check if Firebase is already initialized
//   const existingApps = getApps()
//   if (existingApps.length > 0) {
//     const existingApp = existingApps[0]
    
//     // ⚠️ Check nếu app không có projectId
//     if (!existingApp.options?.projectId) {
      
//       // Reset to force reinitialize
//       if (messagingInstance) {
//         console.warn('[getWebFcmToken] Resetting messaging instance due to missing projectId')
//         messagingInstance = null
//       }
      
//       // Cannot use app without projectId
//       // Firebase không cho phép delete default app, và không thể tạo app mới nếu đã có default app
//       // Return null to caller to know they need to reset
//       console.error(
//         '[getWebFcmToken] ❌ Cannot proceed: Existing app has no projectId. Please reset and reload.',
//       )
//       firebaseApp = null
//       return null
//     }
//     // ⚠️ QUAN TRỌNG: Kiểm tra xem app đã tồn tại có cùng project ID không
//     else if (existingApp.options.projectId !== config.projectId) {
//       console.error(
//         `[getWebFcmToken] ⚠️⚠️⚠️ CRITICAL CONFLICT: Firebase app đã được khởi tạo với project ID khác!`,
//         {
//           existingProjectId: existingApp.options.projectId,
//           expectedProjectId: config.projectId,
//           warning: 'Token có thể bị sai hoặc không hoạt động!',
//           solution: 'Kiểm tra env vars (VITE_FIREBASE_PROJECT_ID) hoặc clear browser cache và reload page.',
//         },
//       )
      
//       // Reset messaging instance to force reinitialize with current app
//       if (messagingInstance) {
//         console.warn('[getWebFcmToken] Resetting messaging instance due to project ID conflict')
//         messagingInstance = null
//       }
      
//       // Still using current app because Firebase doesn't allow deleting app
//       // Nhưng cảnh báo rõ ràng rằng token có thể không hoạt động
//       console.warn(
//         '[getWebFcmToken] ⚠️ Using existing app with different project ID. Token may not work correctly.',
//       )
//       firebaseApp = existingApp
//       return firebaseApp
//     } else {
//       firebaseApp = existingApp
//       return firebaseApp
//     }
//   }

//   try {
//     // Log config before initialize to debug
//     firebaseApp = initializeApp(config)
    
//     if (!firebaseApp.options?.projectId || firebaseApp.options.projectId !== config.projectId) {
//       console.error('[getWebFcmToken] ❌ Firebase app initialized but projectId mismatch:', {
//         appProjectId: firebaseApp.options?.projectId,
//         configProjectId: config.projectId,
//         fullOptions: firebaseApp.options,
//       })
//       firebaseApp = null
//       return null
//     }
    
//     return firebaseApp
//   } catch (error) {
//     console.error('[getWebFcmToken] ❌ Error initializing Firebase app:', error)
//     firebaseApp = null
//     return null
//   }
// }

// /**
//  * Get Firebase Messaging instance (singleton)
//  */
// function getMessagingInstance(): Messaging | null {
//   const config = getFirebaseConfig()
  
//   if (messagingInstance) {
//     // Validate bằng firebaseApp (singleton) thay vì messaging.app
//     // vì messaging.app có thể không có options.projectId
//     if (!firebaseApp?.options?.projectId || firebaseApp.options.projectId !== config.projectId) {
//       messagingInstance = null
//       firebaseApp = null
//     } else {
//       return messagingInstance
//     }
//   }

//   const app = initializeFirebaseApp()
//   if (!app) {
//     console.error('[getWebFcmToken] ❌ Failed to initialize Firebase app')
//     return null
//   }

//   // ⚠️ QUAN TRỌNG: Đảm bảo firebaseApp (singleton) được set
//   // vì initializeFirebaseApp() đã set firebaseApp, nhưng cần đảm bảo nó không bị reset
//   if (firebaseApp !== app) {
//     console.warn('[getWebFcmToken] ⚠️ firebaseApp singleton mismatch, fixing...', {
//       firebaseAppName: firebaseApp?.name,
//       appName: app.name,
//     })
//     firebaseApp = app
//   }

//   // Validate app có projectId
//   if (!app.options?.projectId) {
//     console.error('[getWebFcmToken] ❌ App has no projectId in options:', {
//       appName: app.name,
//       options: app.options,
//       optionsKeys: app.options ? Object.keys(app.options) : [],
//     })
//     return null
//   }

//   if (app.options.projectId !== config.projectId) {
//     console.error('[getWebFcmToken] ❌ App projectId mismatch:', {
//       appProjectId: app.options.projectId,
//       configProjectId: config.projectId,
//     })
//     return null
//   }

//   try {
//     messagingInstance = getMessaging(app)
//     return messagingInstance
//   } catch (error) {
//     console.error('[getWebFcmToken] ❌ Error creating messaging instance:', error)
//     return null
//   }
// }

// /**
//  * Request notification permission for web
//  */
// async function requestNotificationPermission(): Promise<NotificationPermission> {
//   if (!('Notification' in window)) {
//     return 'denied'
//   }

//   // Check current permission
//   if (Notification.permission === 'granted') {
//     return 'granted'
//   }

//   if (Notification.permission === 'denied') {
//     return 'denied'
//   }

//   // Request permission
//   try {
//     const permission = await Notification.requestPermission()
//     return permission
//   } catch (error) {
//     console.error('[getWebFcmToken] Error requesting notification permission:', error)
//     return 'denied'
//   }
// }

// /**
//  * Check if service worker is supported and registered
//  */
// async function checkServiceWorker(): Promise<ServiceWorkerRegistration | null> {
//   if (!('serviceWorker' in navigator)) {
//     return null
//   }

//   try {
//     // Try to get existing registration
//     let registration = await navigator.serviceWorker.getRegistration()

//     // If no registration, register the service worker
//     if (!registration) {
//       registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
//         scope: '/',
//       })
//     }

//     // Wait for service worker to be ready
//     await navigator.serviceWorker.ready

//     return registration
//   } catch (error) {
//     console.error('[getWebFcmToken] Service Worker registration error:', error)
//     return null
//   }
// }

// /**
//  * Get FCM token for web platform
//  * @returns Promise<string | null> FCM token or null if failed
//  */
// export async function getWebFcmToken(): Promise<string | null> {
//   // Check platform first - only for web
//   if (Capacitor.isNativePlatform()) {
//     console.error('[getWebFcmToken] ❌ Not a web platform')
//     return null
//   }

//   // Check if browser supports required APIs
//   if (typeof window === 'undefined') {
//     console.error('[getWebFcmToken] ❌ window is undefined')
//     return null
//   }

//   try {
//     // 1. Request notification permission
//     const permission = await requestNotificationPermission()
//     if (permission !== 'granted') {
//       console.error('[getWebFcmToken] ❌ Notification permission not granted:', permission)
//       return null
//     }

//     // 2. Check and register service worker
//     const registration = await checkServiceWorker()
//     if (!registration) {
//       console.error('[getWebFcmToken] ❌ Service Worker not available')
//       return null
//     }

//     // 2.5. Send Firebase config to service worker
//     const config = getFirebaseConfig()
//     await navigator.serviceWorker.ready
    
//     const sendConfigToSW = async (target: ServiceWorker | null) => {
//       if (!target) return
//       try {
//         target.postMessage({
//           type: 'FIREBASE_CONFIG',
//           config,
//         })
//         await new Promise((resolve) => setTimeout(resolve, 100))
//       } catch {
//         // Ignore
//       }
//     }
    
//     if (registration.active) {
//       await sendConfigToSW(registration.active)
//     } else if (registration.installing) {
//       registration.installing.addEventListener('statechange', async () => {
//         if (registration.installing?.state === 'activated' && registration.active) {
//           await sendConfigToSW(registration.active)
//         }
//       })
//     } else if (registration.waiting) {
//       await sendConfigToSW(registration.waiting)
//     }

//     await new Promise((resolve) => setTimeout(resolve, 500))

//     // 3. Get messaging instance
//     const messaging = getMessagingInstance()
//     if (!messaging) {
//       console.error('[getWebFcmToken] ❌ Messaging instance not available')
//       return null
//     }

//     // 4. Get VAPID key
//     const vapidKey = getVapidKey()
//     if (!vapidKey) {
//       console.error('[getWebFcmToken] ❌ VAPID key is missing', {
//         envVar: 'VITE_FIREBASE_VAPID_KEY',
//         hasValue: !!import.meta.env.VITE_FIREBASE_VAPID_KEY,
//         valueLength: import.meta.env.VITE_FIREBASE_VAPID_KEY?.length || 0,
//       })
//       return null
//     }
    
//     // Validate VAPID key format
//     if (vapidKey.length < 80) {
//       console.error('[getWebFcmToken] ❌ VAPID key seems too short:', {
//         length: vapidKey.length,
//         expectedMinLength: 80,
//         preview: vapidKey.substring(0, 20) + '...',
//       })
//     }
    
//     // Validate messaging instance project ID
//     // Dùng firebaseApp (singleton) thay vì messaging.app để validate
//     // vì messaging.app có thể không có options.projectId
//     if (!firebaseApp?.options?.projectId || firebaseApp.options.projectId !== config.projectId) {
//       console.error('[getWebFcmToken] ❌ Firebase app project ID mismatch:', {
//         appProjectId: firebaseApp?.options?.projectId,
//         messagingAppProjectId: messaging.app?.options?.projectId,
//         configProjectId: config.projectId,
//         appName: firebaseApp?.name,
//         messagingAppName: messaging.app?.name,
//       })
//       messagingInstance = null
//       firebaseApp = null
//       return null
//     }

//     // 5. Get FCM token
//     let token: string | null = null
//     try {
//       // Đợi service worker active nếu chưa ready
//       if (registration?.installing) {
//         await new Promise((resolve) => {
//           const checkState = () => {
//             if (registration.active) {
//               resolve(undefined)
//             } else {
//               setTimeout(checkState, 100)
//             }
//           }
//           checkState()
//         })
//       }
      
//       if (!registration?.active) {
//         console.error('[getWebFcmToken] ❌ Service worker is not active:', {
//           active: registration?.active?.state,
//           installing: registration?.installing?.state,
//           waiting: registration?.waiting?.state,
//         })
//         return null
//       }
      
//       // ⚠️ QUAN TRỌNG: Validate token được lấy từ đúng Firebase project
//       // Token phải được lấy từ cùng project với config
//       if (firebaseApp?.options?.projectId !== config.projectId) {
//         console.error('[getWebFcmToken] ❌ CRITICAL: Firebase app project ID mismatch before getToken:', {
//           appProjectId: firebaseApp?.options?.projectId,
//           configProjectId: config.projectId,
//           warning: 'Token sẽ bị invalid vì được lấy từ project khác!',
//         })
//         return null
//       }
      
//       token = await getToken(messaging, {
//         vapidKey,
//         serviceWorkerRegistration: registration,
//       })
      
//       // ⚠️ Validate token sau khi lấy
//       if (token && firebaseApp?.options?.projectId !== config.projectId) {
//         console.error('[getWebFcmToken] ❌ CRITICAL: Token được lấy từ project khác!', {
//           appProjectId: firebaseApp?.options?.projectId,
//           configProjectId: config.projectId,
//           tokenPreview: token,
//           warning: 'Token này sẽ bị invalid khi backend gửi notification!',
//         })
//         return null
//       }
      
//     } catch (error) {
//       console.error('[getWebFcmToken] ❌ Error getting FCM token:', error instanceof Error ? error.message : String(error))
//       return null
//     }

//     if (!token) {
//       console.error('[getWebFcmToken] ❌ getToken() returned null')
//       return null
//     }

//     return token
//   } catch {
//     return null
//   }
// }

// /**
//  * Setup foreground message listener for web
//  * This will be called when app is in foreground and receives a notification
//  */
// export function setupWebMessageListener(
//   onMessageCallback: (payload: FirebaseMessagePayload) => void,
// ): (() => void) | null {
//   if (Capacitor.isNativePlatform()) {
//     return null
//   }

//   const messaging = getMessagingInstance()
//   if (!messaging) {
//     return null
//   }

//   try {
//     const unsubscribe = onMessage(messaging, (payload) => {
//       const firebasePayload: FirebaseMessagePayload = {
//         notification: payload.notification,
//         data: payload.data as Record<string, string>,
//         messageId: payload.messageId,
//         fcmMessageId: (payload as { fcmMessageId?: string }).fcmMessageId,
//       }
      
//       onMessageCallback(firebasePayload)
//     })

//     return unsubscribe
//   } catch (error) {
//     console.error('[getWebFcmToken] ❌ Error setting up message listener:', error)
//     return null
//   }
// }

