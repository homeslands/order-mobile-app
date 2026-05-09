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
    // Validate URL
    if (!imageUrl || typeof imageUrl !== 'string') {
      showToast(i18n.t('common.invalidImageURL', { ns: 'common' }))
      return false
    }

    // Ensure URL is absolute
    let finalImageUrl = imageUrl.trim()
    if (
      !finalImageUrl.startsWith('http://') &&
      !finalImageUrl.startsWith('https://')
    ) {
      // If relative URL, try to prepend publicFileURL
      const { publicFileURL } = await import('@/constants')
      if (!publicFileURL) {
        showToast(i18n.t('common.invalidURLConfig', { ns: 'common' }))
        return false
      }
      finalImageUrl = `${publicFileURL}/${finalImageUrl.replace(/^\//, '')}`
    }

    // Validate URL format
    try {
      new URL(finalImageUrl)
    } catch {
      // eslint-disable-next-line no-console
      console.error('Invalid URL format:', finalImageUrl)
      showToast(i18n.t('common.invalidImageURL', { ns: 'common' }))
      return false
    }

    // Check permission first
    const hasPermission = await checkMediaLibraryPermission()

    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission()
      if (!granted) {
        showToast(i18n.t('common.noPhotoLibraryPermission', { ns: 'common' }))
        return false
      }
    }

    showToast(i18n.t('common.downloadingImage', { ns: 'common' }))

    // Generate file name if not provided
    const timestamp = Date.now()
    const fileExtension =
      finalImageUrl.split('.').pop()?.split('?')[0]?.split('#')[0] || 'jpg'
    const finalFileName = fileName || `image_${timestamp}`

    const localUri = `${LegacyFS.cacheDirectory}${finalFileName}.${fileExtension}`

    // Check if URL is API endpoint (needs authentication)
    const urlObj = new URL(finalImageUrl)
    const isApiEndpoint = urlObj.pathname.includes('/api/')

    const headers: Record<string, string> = { Accept: 'image/*' }
    if (isApiEndpoint) {
      const { useAuthStore } = await import('@/stores')
      const token = useAuthStore.getState().token
      if (token) headers['Authorization'] = `Bearer ${token}`
    }

    let downloadResult: Awaited<ReturnType<typeof LegacyFS.downloadAsync>>
    try {
      downloadResult = await LegacyFS.downloadAsync(finalImageUrl, localUri, {
        headers,
      })
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Download error:', error)
      if (error instanceof Error) {
        if (
          error.message.includes('timeout') ||
          error.message.includes('ECONNABORTED')
        ) {
          showToast(
            i18n.t('common.errorDownloadImageTimeout', { ns: 'common' }),
          )
        } else {
          showToast(i18n.t('common.errorDownloadImage', { ns: 'common' }))
        }
      } else {
        showToast(i18n.t('common.errorDownloadingImage', { ns: 'common' }))
      }
      return false
    }

    if (downloadResult.status !== 200) {
      showToast(
        `${i18n.t('common.errorDownloadingImage', { ns: 'common' })}: HTTP ${downloadResult.status}`,
      )
      return false
    }

    showToast(i18n.t('common.savingImage', { ns: 'common' }))
    await MediaLibrary.createAssetAsync(downloadResult.uri)
    LegacyFS.deleteAsync(downloadResult.uri, { idempotent: true }).catch(
      () => {},
    )

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
