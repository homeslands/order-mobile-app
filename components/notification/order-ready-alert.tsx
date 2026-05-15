import { ShoppingBag } from 'lucide-react-native'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { Button } from '@/components/ui'
import { colors, SPRING_CONFIGS } from '@/constants'

interface OrderReadyAlertProps {
  visible: boolean
  orderSlug: string
  branchName: string
  referenceNumber: string
  isDark: boolean
  onViewOrder: () => void
  onClose: () => void
}

export function OrderReadyAlert({
  visible,
  orderSlug,
  branchName,
  referenceNumber,
  isDark,
  onViewOrder,
  onClose,
}: OrderReadyAlertProps) {
  const { t } = useTranslation('notification')

  const scale = useSharedValue(0.92)
  const opacity = useSharedValue(0)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, SPRING_CONFIGS.modal)
      opacity.value = withTiming(1, { duration: 200 })
      backdropOpacity.value = withTiming(1, { duration: 200 })
    } else {
      scale.value = withSpring(0.92, SPRING_CONFIGS.modal)
      opacity.value = withTiming(0, { duration: 150 })
      backdropOpacity.value = withTiming(0, { duration: 150 })
    }
  }, [visible, scale, opacity, backdropOpacity])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  const ref = referenceNumber !== ''
    ? `#${referenceNumber}`
    : orderSlug !== ''
      ? `#${orderSlug}`
      : ''
  const body = branchName
    ? t('alertOrderReadyBody', { ref, branch: branchName })
    : t('alertOrderReadyBodyNoBranch', { ref })

  const iconColor = isDark ? colors.primary.dark : colors.primary.light
  const bodyColor = isDark ? colors.gray[200] : colors.gray[700]
  const titleColor = isDark ? colors.foreground.dark : colors.foreground.light
  const cardBg = isDark ? colors.card.dark : colors.card.light

  return (
    // RN Modal renders in a native layer above everything — no Portal context needed.
    // animationType="none" so Reanimated handles the animation on the UI thread.
    // statusBarTranslucent ensures full-screen coverage on Android.
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        {/* Backdrop — decorative only, never intercepts touches */}
        <Animated.View
          style={[StyleSheet.absoluteFill, s.backdrop, backdropStyle]}
          pointerEvents="none"
        />
        {/* Card container — box-none so the container itself passes touches
            through to the card children below */}
        <View
          style={[StyleSheet.absoluteFill, s.center]}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[s.card, { backgroundColor: cardBg }, cardStyle]}
          >
            <View style={s.header}>
              <ShoppingBag size={20} color={iconColor} />
              <Text style={[s.title, { color: titleColor }]}>
                {t('alertOrderReadyTitle')}
              </Text>
            </View>
            <Text style={[s.body, { color: bodyColor }]}>{body}</Text>
            <View style={s.footer}>
              <Button variant="outline" onPress={onClose}>
                {t('alertOrderReadyClose')}
              </Button>
              {orderSlug !== '' ? (
                <Button variant="default" onPress={onViewOrder}>
                  {t('alertOrderReadyViewOrder')}
                </Button>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 352,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
})
