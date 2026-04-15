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
import type { TextProps } from 'react-native'
import { Text } from 'react-native'

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
      const defaultProps: Partial<TextProps> = {
        style: { fontFamily: FONT_REGULAR },
      }
      const RNText = Text as typeof Text & { defaultProps?: Partial<TextProps> }
      RNText.defaultProps = defaultProps
    }
  }, [loaded, error])

  return [loaded, error]
}
