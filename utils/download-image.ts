import i18n from '@/i18n'
import { File, Paths } from 'expo-file-system'
import * as MediaLibrary from 'expo-media-library'
import { Alert, Linking, Platform } from 'react-native'
import { showToast } from './toast'

/**
 * Request media library permission
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    // Request write-only permission to avoid requesting audio permission
    // writeOnly: true means we only need permission to save photos, not read them
    const { status } = await MediaLibrary.requestPermissionsAsync(true)
    
    if (status === 'granted') {
      return true
    }
    
    if (status === 'denied') {
      Alert.alert(
        i18n.t('common.photoLibraryPermissionDenied', { ns: 'common', defaultValue: 'Quyền truy cập bị từ chối' }),
        i18n.t('common.photoLibraryPermissionMessage', { ns: 'common', defaultValue: 'Vui lòng cấp quyền truy cập thư viện ảnh trong cài đặt để lưu ảnh.' }),
        [
          { text: i18n.t('common.cancel', { ns: 'common', defaultValue: 'Hủy' }), style: 'cancel' },
          {
            text: i18n.t('common.openSettings', { ns: 'common', defaultValue: 'Mở cài đặt' }),
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
    // Check write-only permission to avoid checking audio permission
    // writeOnly: true means we only need permission to save photos, not read them
    const { status } = await MediaLibrary.getPermissionsAsync(true)
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
      showToast(i18n.t('common.invalidImageURL', { ns: 'common', defaultValue: 'URL ảnh không hợp lệ' }))
      return false
    }

    // Ensure URL is absolute
    let finalImageUrl = imageUrl.trim()
    if (!finalImageUrl.startsWith('http://') && !finalImageUrl.startsWith('https://')) {
      // If relative URL, try to prepend publicFileURL
      const { publicFileURL } = await import('@/constants')
      if (!publicFileURL) {
        showToast(i18n.t('common.invalidURLConfig', { ns: 'common', defaultValue: 'Cấu hình URL không hợp lệ' }))
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
      showToast(i18n.t('common.invalidImageURL', { ns: 'common', defaultValue: 'URL ảnh không hợp lệ' }))
      return false
    }

    // Log URL for debugging
    // eslint-disable-next-line no-console
    console.log('Downloading image from URL:', finalImageUrl)

    // Check permission first
    const hasPermission = await checkMediaLibraryPermission()
    
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission()
      if (!granted) {
        showToast(i18n.t('common.noPhotoLibraryPermission', { ns: 'common', defaultValue: 'Không có quyền truy cập thư viện ảnh' }))
        return false
      }
    }

    showToast(i18n.t('common.downloadingImage', { ns: 'common', defaultValue: 'Đang tải ảnh...' }))

    // Generate file name if not provided
    const timestamp = Date.now()
    const fileExtension = finalImageUrl.split('.').pop()?.split('?')[0]?.split('#')[0] || 'jpg'
    const finalFileName = fileName || `image_${timestamp}`
    
    // Use new File API
    const targetFile = new File(Paths.cache, `${finalFileName}.${fileExtension}`)

    // Download the image - check if URL is API endpoint that needs auth
    
    // Check if URL is API endpoint (needs authentication)
    const urlObj = new URL(finalImageUrl)
    const isApiEndpoint = urlObj.pathname.includes('/api/')
    
    let arrayBuffer: ArrayBuffer
    try {
      if (isApiEndpoint) {
        // For API endpoints, try with auth headers first
        const { useAuthStore } = await import('@/stores')
        const authStore = useAuthStore.getState()
        const token = authStore.token
        
        const headers: Record<string, string> = {
          'Accept': 'image/*',
        }
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`
        }
        
        const fetchResponse = await fetch(finalImageUrl, { headers })
        
        if (!fetchResponse.ok) {
          throw new Error(`Fetch failed with status ${fetchResponse.status}`)
        }
        
        const blob = await fetchResponse.blob()
        arrayBuffer = await blob.arrayBuffer()
      } else {
        // Use direct fetch for public image URLs
        const fetchResponse = await fetch(finalImageUrl, {
          headers: {
            'Accept': 'image/*',
          },
        })
        
        if (!fetchResponse.ok) {
          throw new Error(`Fetch failed with status ${fetchResponse.status}`)
        }
        
        const blob = await fetchResponse.blob()
        arrayBuffer = await blob.arrayBuffer()
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Download error:', error)
      
      // Handle errors
      if (error instanceof Error) {
        if (error.message.includes('status 400')) {
          // If 400 error, it might be a different issue (invalid URL format, etc.)
          showToast(i18n.t('common.errorDownloadImageAuth', { ns: 'common', defaultValue: 'Không thể tải ảnh. URL có thể không hợp lệ hoặc cần xác thực.' }))
        } else if (error.message.includes('timeout') || error.message.includes('ECONNABORTED')) {
          showToast(i18n.t('common.errorDownloadImageTimeout', { ns: 'common', defaultValue: 'Hết thời gian chờ khi tải ảnh' }))
        } else if (error.message.includes('status')) {
          showToast(`${i18n.t('common.errorDownloadingImage', { ns: 'common', defaultValue: 'Lỗi khi tải ảnh' })}: ${error.message}`)
        } else {
          showToast(i18n.t('common.errorDownloadImage', { ns: 'common', defaultValue: 'Không thể tải ảnh. Vui lòng kiểm tra kết nối mạng.' }))
        }
      } else {
        showToast(i18n.t('common.errorDownloadingImage', { ns: 'common', defaultValue: 'Lỗi khi tải ảnh' }))
      }
      return false
    }

    // Convert arrayBuffer to Uint8Array
    const uint8Array = new Uint8Array(arrayBuffer)
    
    const writer = targetFile.writableStream().getWriter()
    try {
      await writer.write(uint8Array)
      await writer.close()
    } catch (writeError) {
      await writer.abort()
      // eslint-disable-next-line no-console
      console.error('Error writing file:', writeError)
      showToast(i18n.t('common.errorSavingFile', { ns: 'common', defaultValue: 'Lỗi khi lưu file' }))
      return false
    }

    // Save to media library
    // File can be converted to string to get URI
    showToast(i18n.t('common.savingImage', { ns: 'common', defaultValue: 'Đang lưu ảnh...' }))
    const fileUri = String(targetFile)
    await MediaLibrary.createAssetAsync(fileUri)
    
    // Optionally add to album (you can create a custom album)
    // const asset = await MediaLibrary.createAssetAsync(downloadResult.uri)
    // await MediaLibrary.createAlbumAsync('YourAppName', asset, false)

    showToast(i18n.t('common.imageSavedSuccess', { ns: 'common', defaultValue: 'Đã lưu ảnh thành công' }))
    return true
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error downloading and saving image:', error)
    showToast(i18n.t('common.errorSavingImage', { ns: 'common', defaultValue: 'Lỗi khi lưu ảnh' }))
    return false
  }
}

/**
 * Download QR code image (for QR code components)
 * Note: This requires capturing the QR code view as an image first
 * You may need to use react-native-view-shot library for this
 * @param _qrCodeData - Data to encode in QR code (usually order slug)
 * @param _fileName - Optional custom file name
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function downloadQRCodeImage(
  _qrCodeData: string,
  _fileName?: string,
): Promise<boolean> {
  try {
    // Check permission first
    const hasPermission = await checkMediaLibraryPermission()
    
    if (!hasPermission) {
      const granted = await requestMediaLibraryPermission()
      if (!granted) {
        showToast(i18n.t('common.noPhotoLibraryPermission', { ns: 'common', defaultValue: 'Không có quyền truy cập thư viện ảnh' }))
        return false
      }
    }

    // For QR code, we need to capture it as an image first
    // This requires using react-native-view-shot or similar library
    // For now, we'll return false and suggest using downloadAndSaveImage with a QR code image URL
    showToast(i18n.t('common.useScreenshotForQRCode', { ns: 'common', defaultValue: 'Vui lòng sử dụng chức năng chụp màn hình để lưu QR code' }))
    return false
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error downloading QR code:', error)
    showToast(i18n.t('common.errorSavingQRCode', { ns: 'common', defaultValue: 'Lỗi khi lưu QR code' }))
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

