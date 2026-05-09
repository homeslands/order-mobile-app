import RNBlobUtil from 'react-native-blob-util'
import * as LegacyFS from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

/**
 * Write an ArrayBuffer as a PDF and deliver it to the user.
 * Throws on failure — caller is responsible for error handling and toasts.
 *
 * iOS     — share sheet → "Save to Files"
 * Android — saved directly to Downloads via MediaStore (no dialog)
 */
export async function downloadAndSavePDF(
  data: ArrayBuffer,
  fileName: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('PDF download not supported on web')
  }

  if (data.byteLength === 0) {
    throw new Error('PDF data is empty')
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_')

  const uint8Array = new Uint8Array(data)
  const CHUNK_SIZE = 8192
  let binary = ''
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + CHUNK_SIZE))
  }
  const base64 = btoa(binary)

  if (Platform.OS === 'android') {
    const tempPath = `${RNBlobUtil.fs.dirs.CacheDir}/${safeName}.pdf`
    await RNBlobUtil.fs.writeFile(tempPath, base64, 'base64')
    try {
      const savedUri = await RNBlobUtil.MediaCollection.copyToMediaStore(
        {
          name: `${safeName}.pdf`,
          parentFolder: '',
          mimeType: 'application/pdf',
        },
        'Download',
        tempPath,
      )
      if (!savedUri) {
        throw new Error(
          'MediaStore save failed — file not written to Downloads',
        )
      }
    } finally {
      await RNBlobUtil.fs.unlink(tempPath).catch(() => {})
    }
  } else {
    // iOS: write to document dir then share sheet → "Save to Files"
    if (!LegacyFS.documentDirectory) {
      throw new Error('documentDirectory is not available on this platform')
    }
    const fileUri = `${LegacyFS.documentDirectory}${safeName}.pdf`
    await LegacyFS.writeAsStringAsync(fileUri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    })
    try {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: safeName,
        UTI: 'com.adobe.pdf',
      })
    } finally {
      await LegacyFS.deleteAsync(fileUri, { idempotent: true }).catch(() => {})
    }
  }
}
