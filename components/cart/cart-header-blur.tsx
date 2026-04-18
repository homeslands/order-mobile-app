/**
 * CartHeaderBlur — Header trong mờ, nội dung cuộn phía sau bị blur.
 * BlurView + nút back, title, nút xoá hết. BG trùng với nền giỏ.
 */
import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { ChevronLeft, Trash2 } from 'lucide-react-native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'

export type CartHeaderBlurProps = {
  onBack: () => void
  onClearCart?: () => void
  orderCount: number
  isDark?: boolean
}

export const CART_HEADER_CONTENT_HEIGHT = 60

export function CartHeaderBlur({
  onBack,
  onClearCart,
  orderCount,
  isDark = false,
}: CartHeaderBlurProps) {
  const { t } = useTranslation('menu')
  const iconColor = isDark
    ? colors.mutedForeground.dark
    : colors.mutedForeground.light

  return (
    <View
      pointerEvents="box-none"
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: STATIC_TOP_INSET + CART_HEADER_CONTENT_HEIGHT,
          zIndex: 10,
          elevation: 10,
          overflow: 'hidden',
        },
      ]}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 60 : 80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          styles.content,
          {
            paddingTop: STATIC_TOP_INSET,
            paddingBottom: 12,
          },
        ]}
      >
        <View className="flex-row items-center px-4">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
            <TouchableOpacity onPress={onBack} className="p-1" hitSlop={8}>
              <ChevronLeft size={24} color={iconColor} />
            </TouchableOpacity>
          </View>

          <Text
            className="flex-1 text-center text-base font-semibold text-gray-900 dark:text-white"
            numberOfLines={1}
          >
            {t('tabs.cart', 'Giỏ hàng')} ({orderCount})
          </Text>

          <View className="w-12 items-end">
            {onClearCart ? (
              <TouchableOpacity
                onPress={onClearCart}
                activeOpacity={0.9}
                className="h-12 w-12 flex-row items-center justify-center rounded-full bg-destructive/10 dark:bg-destructive/20"
              >
                <Trash2 size={14} color={colors.destructive.light} />
              </TouchableOpacity>
            ) : (
              <View className="h-12 w-12 items-center justify-center rounded-full bg-black/5 dark:bg-white/5">
                <Trash2 size={14} color={iconColor} />
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

export function useCartHeaderHeight() {
  return STATIC_TOP_INSET + CART_HEADER_CONTENT_HEIGHT
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'flex-end',
  },
})
