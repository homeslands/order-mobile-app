// // src/utils/getNativeFcmToken.ts
// /* eslint-disable no-console */
// import { PushNotifications } from '@capacitor/push-notifications'
// import { Capacitor } from '@capacitor/core'

// function getPlatformName(): 'ios' | 'android' {
//   const platform = Capacitor.getPlatform()
//   return platform === 'ios' ? 'ios' : 'android'
// }

// export async function getNativeFcmToken(): Promise<string | null> {
//   // Check platform first
//   if (!Capacitor.isNativePlatform()) {
//     console.error('[getNativeFcmToken] ❌ Not a native platform')
//     return null
//   }

//   const platform = getPlatformName()

//   try {
//     // 1. Request permissions
//     const permission = await PushNotifications.requestPermissions()
    
//     if (permission.receive !== 'granted') {
//       console.error(`[getNativeFcmToken] ❌ Push notification permission not granted for ${platform}:`, permission)
//       return null
//     }

//     // 2. Register with FCM
//     await PushNotifications.register()

//     // 3. Wait for token via listener
//     return new Promise((resolve, reject) => {
//       const timeout = setTimeout(() => {
//         console.error(`[getNativeFcmToken] ❌ Token registration timeout for ${platform}`)
//         reject(new Error('Token registration timeout'))
//       }, 10000) // 10s timeout

//       // Setup listeners (async operations)
//       const setupListeners = async () => {
//         // Store listener references to cleanup properly
//         const registrationListener = await PushNotifications.addListener('registration', (token) => {
//           clearTimeout(timeout)
          
//           const tokenValue = token.value
          
//           // Cleanup ONLY listeners of this function
//           registrationListener.remove()
//           errorListener.remove()
          
//           resolve(tokenValue)
//         })

//         const errorListener = await PushNotifications.addListener('registrationError', (error) => {
//           clearTimeout(timeout)
          
//           console.error(`[getNativeFcmToken] ❌ Registration error for ${platform}:`, {
//             error: error,
//             errorString: String(error),
//             platform,
//           })
          
    //           // Cleanup listeners
//           registrationListener.remove()
//           errorListener.remove()
          
//           reject(error)
//         })
//       }
      
//       // Start listener setup
//       setupListeners().catch((err) => {
//         clearTimeout(timeout)
//         console.error(`[getNativeFcmToken] ❌ Error setting up listeners for ${platform}:`, err)
//         reject(err)
//       })
//     })
//   } catch (error) {
//     console.error(`[getNativeFcmToken] ❌ Error getting FCM token for ${platform}:`, {
//       error: error instanceof Error ? error.message : String(error),
//       platform,
//     })
//     return null
//   }
// }