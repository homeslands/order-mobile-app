/**
 * Load Be Vietnam Pro và áp font mặc định cho toàn app.
 * Font được set qua Text.defaultProps khi load xong.
 */
import {
  useFonts,
  BeVietnamPro_400Regular,
  BeVietnamPro_500Medium,
  BeVietnamPro_600SemiBold,
  BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro'
import { useEffect } from 'react'
import type { TextInputProps, TextProps } from 'react-native'
import { Text, TextInput } from 'react-native'

const FONT_REGULAR = 'BeVietnamPro_400Regular'

export function useBeVietnamProFont() {
  const [loaded, error] = useFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_500Medium,
    BeVietnamPro_600SemiBold,
    BeVietnamPro_700Bold,
  })

  useEffect(() => {
    if (loaded && !error) {
      const RNText = Text as typeof Text & { defaultProps?: Partial<TextProps> }
      RNText.defaultProps = {
        ...(RNText.defaultProps ?? {}),
        style: { fontFamily: FONT_REGULAR },
        maxFontSizeMultiplier: 1.0,
      }

      const RNTextInput = TextInput as typeof TextInput & {
        defaultProps?: Partial<TextInputProps>
      }
      RNTextInput.defaultProps = {
        ...(RNTextInput.defaultProps ?? {}),
        maxFontSizeMultiplier: 1.0,
      }
    }
  }, [loaded, error])

  return [loaded, error]
}
