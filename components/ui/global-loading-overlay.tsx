/**
 * GlobalLoadingOverlay — Logo + vòng xoay, nền trắng, không che bottom bar.
 * Hiện trong lúc transition + một chút sau để bù khoảng delay skeleton.
 */
import React from 'react'
import { Image } from 'expo-image'
import {
  ActivityIndicator,
  StyleSheet,
  View,
  useColorScheme,
} from 'react-native'

import { Images } from '@/assets/images'
import { colors } from '@/constants'

interface GlobalLoadingOverlayProps {
  visible: boolean
}

// const BOTTOM_BAR_HEIGHT = 120

export function GlobalLoadingOverlay({ visible }: GlobalLoadingOverlayProps) {
  const isDark = useColorScheme() === 'dark'

  if (!visible) return null

  return (
    <View
      style={[
        styles.overlay,
        {
          backgroundColor: isDark
            ? colors.background.dark
            : colors.background.light,
          bottom: 0, // Full-screen overlay, không còn hở phần xám bên dưới
        },
      ]}
    >
      <View style={styles.content}>
        <Image
          source={Images.Brand.Logo}
          style={styles.logo}
          contentFit="contain"
        />
        <ActivityIndicator
          size="large"
          color={isDark ? colors.primary.dark : colors.primary.light}
          style={styles.spinner}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    height: 48,
    width: 168,
  },
  spinner: {
    marginTop: 24,
  },
})
