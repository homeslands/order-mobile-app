import * as LegacyFS from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

/**
 * Write an ArrayBuffer as a PDF and deliver it to the user.
 * Throws on failure — caller is responsible for error handling and toasts.
 *
 * iOS  — share sheet → user taps "Save to Files"
 * Android — SAF folder picker → user choses location (e.g. Downloads)
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

  // Compute base64 once — shared by both platforms
  const uint8Array = new Uint8Array(data)
  const CHUNK_SIZE = 8192
  let binary = ''
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(
      null,
      uint8Array.subarray(i, i + CHUNK_SIZE) as unknown as number[],
    )
  }
  const base64 = btoa(binary)

  if (Platform.OS === 'android') {
    // SAF: open folder picker so user picks where to save (e.g. Downloads)
    const permissions =
      await LegacyFS.StorageAccessFramework.requestDirectoryPermissionsAsync()
    if (!permissions.granted) {
      throw new Error('Storage permission denied')
    }
    const destUri =
      await LegacyFS.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        `${safeName}.pdf`,
        'application/pdf',
      )
    await LegacyFS.StorageAccessFramework.writeAsStringAsync(
      destUri,
      base64,
      { encoding: LegacyFS.EncodingType.Base64 },
    )
  } else {
    // iOS: write to document dir then open share sheet ("Save to Files")
    if (!LegacyFS.documentDirectory) {
      throw new Error('documentDirectory is not available on this platform')
    }
    const fileUri = `${LegacyFS.documentDirectory}${safeName}.pdf`
    await LegacyFS.writeAsStringAsync(fileUri, base64, {
      encoding: LegacyFS.EncodingType.Base64,
    })
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: safeName,
      UTI: 'com.adobe.pdf',
    })
  }
}
