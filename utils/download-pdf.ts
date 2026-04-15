import i18n from '@/i18n'
import { useDownloadStore } from '@/stores'
import { File, Paths } from 'expo-file-system'
import { Alert, Linking, Platform } from 'react-native'
import { showToast } from './toast'
// Note: PDF files are saved to app document directory (expo-file-system)
// - Android: app storage (trình quản lý file > Android/data/[app]/files)
// - iOS: Files app > On My iPhone > [app]

/**
 * Download PDF Blob and save to device
 * @param blob - PDF Blob data (can be Blob, ArrayBuffer, or Uint8Array in React Native)
 * @param fileName - File name (without extension)
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export async function downloadAndSavePDF(
  blob: Blob | ArrayBuffer | Uint8Array,
  fileName: string,
): Promise<boolean> {
  try {
    // Convert to Uint8Array - handle different input types
    showToast(
      i18n.t('common.savingPDF', {
        ns: 'common',
        defaultValue: 'Đang lưu file PDF...',
      }),
    )
    let uint8Array: Uint8Array

    // Check if already Uint8Array
    if (blob instanceof Uint8Array) {
      uint8Array = blob
    }
    // Check if ArrayBuffer
    else if (blob instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(blob)
    }
    // Check if Web Blob API (has arrayBuffer method)
    else if (
      blob &&
      typeof blob === 'object' &&
      'arrayBuffer' in blob &&
      typeof (blob as { arrayBuffer?: unknown }).arrayBuffer === 'function'
    ) {
      const arrayBuffer = await (
        blob as { arrayBuffer: () => Promise<ArrayBuffer> }
      ).arrayBuffer()
      uint8Array = new Uint8Array(arrayBuffer)
    }
    // Check if React Native axios response (has .data property)
    else if (blob && typeof blob === 'object' && 'data' in blob) {
      const data = (blob as { data: unknown }).data
      if (data instanceof Uint8Array) {
        uint8Array = data
      } else if (data instanceof ArrayBuffer) {
        uint8Array = new Uint8Array(data)
      } else {
        // eslint-disable-next-line no-console
        console.error('Unexpected blob data format:', typeof data, data)
        throw new Error('Unsupported blob data format')
      }
    }
    // Fallback: check if it's an ArrayBuffer-like object
    else if (blob && typeof blob === 'object' && 'byteLength' in blob) {
      // Try to convert using Uint8Array constructor
      try {
        uint8Array = new Uint8Array(blob as unknown as ArrayBufferLike)
      } catch {
        throw new Error('Cannot convert blob to Uint8Array')
      }
    }
    // Unknown format
    else {
      // eslint-disable-next-line no-console
      console.error('Unknown blob format:', typeof blob, blob)
      throw new Error('Unsupported blob format')
    }

    // Update download store for UI progress
    // Don't reset progress here - keep progress from API download
    const {
      setIsDownloading,
      setProgress,
      progress: currentProgress,
    } = useDownloadStore.getState()
    setIsDownloading(true)
    // Only set initial progress if not already set (from API download)
    if (currentProgress === 0) {
      setProgress(20) // 20% - starting to save
    }

    // expo-file-system: document directory không cần storage permission
    if (Platform.OS === 'web') {
      setIsDownloading(false)
      showToast(
        i18n.t('common.errorSavingPDF', {
          ns: 'common',
          defaultValue: 'Lỗi khi lưu file PDF',
        }),
      )
      // eslint-disable-next-line no-console
      console.warn('PDF download is not supported on web platform')
      return false
    }

    const { progress: progressAfterPermission } = useDownloadStore.getState()
    setProgress(Math.max(progressAfterPermission, 40)) // 40% - preparing to save

    const fileNameWithExt = `${fileName}.pdf`
    const targetFile = new File(Paths.document, fileNameWithExt)

    const { progress: progressAfterPath } = useDownloadStore.getState()
    setProgress(Math.max(progressAfterPath, 60)) // 60% - path determined, writing file

    try {
      const { progress: progressBeforeWrite } = useDownloadStore.getState()
      setProgress(Math.max(progressBeforeWrite, 80)) // 80% - starting to write

      const writer = targetFile.writableStream().getWriter()
      try {
        await writer.write(uint8Array)
        await writer.close()
      } catch (writeErr) {
        await writer.abort()
        throw writeErr
      }

      const { progress: progressAfterWrite } = useDownloadStore.getState()
      setProgress(Math.max(progressAfterWrite, 90)) // 90% - file written

      if (!targetFile.exists) {
        throw new Error('File was not created successfully')
      }

      setProgress(100) // 100% - complete
      setIsDownloading(false)

      setTimeout(() => {
        const { reset } = useDownloadStore.getState()
        reset()
      }, 1000)

      showToast(
        i18n.t('common.fileSavedToFilesApp', {
          ns: 'common',
          defaultValue: 'Đã lưu PDF. Mở Files app để xem',
        }),
      )

      // eslint-disable-next-line no-console
      console.log('PDF saved to:', String(targetFile))

      return true
    } catch (writeError) {
      setIsDownloading(false)
      // eslint-disable-next-line no-console
      console.error('Error writing PDF file:', writeError)

      const errorMessage =
        writeError instanceof Error ? writeError.message : String(writeError)

      // Handle specific errors
      if (
        errorMessage.includes('permission') ||
        errorMessage.includes('Permission')
      ) {
        showToast(
          i18n.t('common.noPermissionToSave', {
            ns: 'common',
            defaultValue:
              'Không có quyền lưu file. Vui lòng cấp quyền trong cài đặt',
          }),
        )
        Alert.alert(
          i18n.t('common.permissionDenied', {
            ns: 'common',
            defaultValue: 'Quyền bị từ chối',
          }),
          i18n.t('common.permissionRequired', {
            ns: 'common',
            defaultValue:
              'Cần quyền lưu file để tải PDF. Vui lòng cấp quyền trong cài đặt.',
          }),
          [
            {
              text: i18n.t('common.cancel', {
                ns: 'common',
                defaultValue: 'Hủy',
              }),
              style: 'cancel',
            },
            {
              text: i18n.t('common.openSettings', {
                ns: 'common',
                defaultValue: 'Mở cài đặt',
              }),
              onPress: () => Linking.openSettings(),
            },
          ],
        )
      } else {
        showToast(
          i18n.t('common.errorSavingPDF', {
            ns: 'common',
            defaultValue: 'Lỗi khi lưu file PDF',
          }),
        )
      }

      return false
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error downloading and saving PDF:', error)
    showToast(
      i18n.t('common.errorSavingPDF', {
        ns: 'common',
        defaultValue: 'Lỗi khi lưu file PDF',
      }),
    )
    return false
  }
}
