import i18n from '@/i18n'
import * as LegacyFS from 'expo-file-system/legacy'
import * as MediaLibrary from 'expo-media-library'
import { Alert, Linking, Platform } from 'react-native'
import { showToast } from './toast'

/**
 * Request media library permission
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync()

    if (status === 'granted') {
      return true
    }

    if (status === 'denied') {
      Alert.alert(
        i18n.t('common.photoLibraryPermissionDenied', { ns: 'common' }),
        i18n.t('common.photoLibraryPermissionMessage', { ns: 'common' }),
        [
          { text: i18n.t('common.cancel', { ns: 'common' }), style: 'cancel' },
          {
            text: i18n.t('common.openSettings', { ns: 'common' }),
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:')
              } else {
                Linking.openSettings()
              }
            },
          },
        ],
      )
      return false
    }

    return false
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error requesting media library permission:', error)
    return false
  }
}

/**
 * Check if media library permission is granted
 */
export async function checkMediaLibraryPermission(): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.getPermissionsAsync()
    return status === 'granted'
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error checking media library permission:', error)
    return false
  }
}

/**
 * Download image from URL and save to device
 * @param imageUrl - URL of the image to download
 * @param fileName - Optional custom file name (without extension)
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function downloadAndSaveImage(
  imageUrl: string,
  fileName?: string,
): Promise<boolean> {
  try {
    if (!imageUrl || typeof imageUrl !== 'string') {
      showToast(i18n.t('common.invalidImageURL', { ns: 'common' }))
      return false
    }

    const isDataUri = imageUrl.startsWith('data:')
    let finalImageUrl = imageUrl.trim()

    if (!isDataUri) {
      if (
        !finalImageUrl.startsWith('http://') &&
        !finalImageUrl.startsWith('https://')
      ) {
        const { publicFileURL } = await import('@/constants')
        if (!publicFileURL) {
          showToast(i18n.t('common.invalidURLConfig', { ns: 'common' }))
          return false
        }
        finalImageUrl = `${publicFileURL}/${finalImageUrl.replace(/^\//, '')}`
      }

      try {
        new URL(finalImageUrl)
      } catch {
        showToast(i18n.t('common.invalidImageURL', { ns: 'common' }))
        return false
      }
    }

    const hasPermission = await checkMediaLibraryPermission()
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission()
      if (!granted) {
        showToast(i18n.t('common.noPhotoLibraryPermission', { ns: 'common' }))
        return false
      }
    }

    showToast(i18n.t('common.downloadingImage', { ns: 'common' }))

    const timestamp = Date.now()
    const finalFileName = fileName || `image_${timestamp}`

    let fileExtension: string
    let base64Data: string

    if (isDataUri) {
      // data:image/png;base64,<data>  — extract directly without network call
      const mimeMatch = finalImageUrl.match(/^data:image\/([^;]+);base64,/)
      const mime = mimeMatch?.[1] ?? 'png'
      fileExtension = mime === 'jpeg' ? 'jpg' : mime
      base64Data = finalImageUrl.replace(/^data:[^,]+,/, '')
    } else {
      fileExtension =
        finalImageUrl.split('.').pop()?.split('?')[0]?.split('#')[0] || 'jpg'

      // Use fetch() instead of LegacyFS.downloadAsync — LegacyFS uses OkHttp on
      // Android which behaves differently from ExpoImage (Glide) for certain URLs
      // (VietQR, external CDNs). fetch() uses the JS-native HTTP stack consistently
      // across both platforms.
      const urlObj = new URL(finalImageUrl)
      const isApiEndpoint = urlObj.pathname.includes('/api/')
      const headers: Record<string, string> = { Accept: 'image/*' }
      if (isApiEndpoint) {
        const { useAuthStore } = await import('@/stores')
        const token = useAuthStore.getState().token
        if (token) headers['Authorization'] = `Bearer ${token}`
      }

      let response: Response
      try {
        response = await fetch(finalImageUrl, { headers })
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('QR download fetch error:', error)
        const msg =
          error instanceof Error ? error.message : ''
        if (msg.includes('timeout') || msg.includes('ECONNABORTED')) {
          showToast(
            i18n.t('common.errorDownloadImageTimeout', { ns: 'common' }),
          )
        } else {
          showToast(i18n.t('common.errorDownloadImage', { ns: 'common' }))
        }
        return false
      }

      if (!response.ok) {
        showToast(
          `${i18n.t('common.errorDownloadingImage', { ns: 'common' })}: HTTP ${response.status}`,
        )
        return false
      }

      // fetch() returns an ArrayBuffer; convert to base64 via chunked Uint8Array
      // to avoid stack-overflow on large images with spread-operator approach.
      try {
        const buffer = await response.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        const chunk = 8192
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode(
            ...(bytes.subarray(i, i + chunk) as unknown as number[]),
          )
        }
        base64Data = btoa(binary)
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('QR base64 conversion error:', error)
        showToast(i18n.t('common.errorDownloadImage', { ns: 'common' }))
        return false
      }
    }

    const localUri = `${LegacyFS.cacheDirectory}${finalFileName}.${fileExtension}`

    showToast(i18n.t('common.savingImage', { ns: 'common' }))
    await LegacyFS.writeAsStringAsync(localUri, base64Data, {
      encoding: LegacyFS.EncodingType.Base64,
    })

    await MediaLibrary.createAssetAsync(localUri)
    LegacyFS.deleteAsync(localUri, { idempotent: true }).catch(() => {})

    showToast(i18n.t('common.imageSavedSuccess', { ns: 'common' }))
    return true
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error downloading and saving image:', error)
    showToast(i18n.t('common.errorSavingImage', { ns: 'common' }))
    return false
  }
}

/**
 * Save a QR code SVG capture to Photos.
 * Caller must capture the SVG ref via react-native-qrcode-svg's getRef +
 * toDataURL() before calling this — the base64PngData is the raw PNG bytes
 * returned by toDataURL (no data-URI prefix).
 */
export async function downloadQRCodeImage(
  base64PngData: string,
  fileName?: string,
): Promise<boolean> {
  try {
    const hasPermission = await checkMediaLibraryPermission()
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission()
      if (!granted) {
        showToast(i18n.t('common.noPhotoLibraryPermission', { ns: 'common' }))
        return false
      }
    }

    const finalFileName = fileName ?? `qr_${Date.now()}`
    const fileUri = `${LegacyFS.cacheDirectory}${finalFileName}.png`

    await LegacyFS.writeAsStringAsync(fileUri, base64PngData, {
      encoding: LegacyFS.EncodingType.Base64,
    })

    await MediaLibrary.createAssetAsync(fileUri)
    LegacyFS.deleteAsync(fileUri, { idempotent: true }).catch(() => {})

    showToast(i18n.t('common.imageSavedSuccess', { ns: 'common' }))
    return true
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error downloading QR code:', error)
    showToast(i18n.t('common.errorSavingQRCode', { ns: 'common' }))
    return false
  }
}

/**
 * Hook to use download image functionality
 * @deprecated Use useDownloadImage from '@/hooks' instead
 */
export function useDownloadImage() {
  // eslint-disable-next-line no-console
  console.warn(
    'useDownloadImage from utils is deprecated. Use useDownloadImage from @/hooks instead.',
  )
  const downloadImage = async (imageUrl: string, fileName?: string) => {
    return await downloadAndSaveImage(imageUrl, fileName)
  }

  const requestPermission = async () => {
    return await requestMediaLibraryPermission()
  }

  const checkPermission = async () => {
    return await checkMediaLibraryPermission()
  }

  return {
    downloadImage,
    requestPermission,
    checkPermission,
  }
}
