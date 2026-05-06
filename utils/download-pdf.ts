import * as LegacyFS from 'expo-file-system/legacy'
import { Platform } from 'react-native'

/**
 * Write an ArrayBuffer as a PDF to the app's document directory.
 * Throws on failure — caller is responsible for error handling and toasts.
 *
 * Saved to:
 *   iOS  — Files app > On My iPhone > [app name]
 *   Android — app internal storage (Android/data/[package]/files)
 */
export async function downloadAndSavePDF(
  data: ArrayBuffer,
  fileName: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('PDF download not supported on web')
  }

  const fileUri = `${LegacyFS.documentDirectory}${fileName}.pdf`

  const uint8Array = new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  const base64 = btoa(binary)

  await LegacyFS.writeAsStringAsync(fileUri, base64, {
    encoding: LegacyFS.EncodingType.Base64,
  })
}
