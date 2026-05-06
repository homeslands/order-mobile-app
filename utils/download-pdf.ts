import * as LegacyFS from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { Platform } from 'react-native'

/**
 * Write an ArrayBuffer as a PDF and open the native share sheet.
 * Throws on failure — caller is responsible for error handling and toasts.
 *
 * iOS  — share sheet → "Save to Files"
 * Android — share sheet → Files by Google / PDF reader / ...
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

  if (!LegacyFS.documentDirectory) {
    throw new Error('documentDirectory is not available on this platform')
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileUri = `${LegacyFS.documentDirectory}${safeName}.pdf`

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

  await LegacyFS.writeAsStringAsync(fileUri, base64, {
    encoding: LegacyFS.EncodingType.Base64,
  })

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/pdf',
    dialogTitle: safeName,
    UTI: 'com.adobe.pdf',
  })
}
