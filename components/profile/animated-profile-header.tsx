import { BlurView } from 'expo-blur'
import { Edit, QrCode } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'

import { colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'

interface AnimatedProfileHeaderProps {
  firstName: string
  lastName: string
  phoneNumber: string
  initials: string
  scrollY: SharedValue<number>
  onEditPress: () => void
  onQRPress: () => void
}

const AVATAR_INITIAL_SIZE = 72
const HEADER_HEIGHT = 56
const INITIAL_HEADER_HEIGHT = 160 // Avatar + name + phone section
const COLLAPSE_TRIGGER = 100 // Scroll distance to trigger collapse

export const AnimatedProfileHeader = ({
  firstName,
  lastName,
  phoneNumber,
  initials,
  scrollY,
  onEditPress,
  onQRPress,
}: AnimatedProfileHeaderProps) => {
  const isDark = useColorScheme() === 'dark'
  const topInset = STATIC_TOP_INSET

  const headerBackgroundStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: interpolate(
        scrollY.value,
        [0, COLLAPSE_TRIGGER / 2],
        [0, 0.7],
        Extrapolation.CLAMP,
      ),
    }
  })

  const profileSectionStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, COLLAPSE_TRIGGER],
            [0, -100],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  const avatarContainerStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        {
          scale: interpolate(
            scrollY.value,
            [0, COLLAPSE_TRIGGER],
            [1, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
      opacity: interpolate(
        scrollY.value,
        [0, COLLAPSE_TRIGGER - 20],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    }
  })

  const textContainerStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [0, COLLAPSE_TRIGGER],
            [0, -(INITIAL_HEADER_HEIGHT - HEADER_HEIGHT) / 2],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            scrollY.value,
            [0, COLLAPSE_TRIGGER],
            [1, 0.9],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  const phoneStyle = useAnimatedStyle(() => {
    'worklet'
    return {
      opacity: interpolate(
        scrollY.value,
        [0, COLLAPSE_TRIGGER - 30],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    }
  })

  const buttonColor = isDark ? colors.primary.dark : colors.primary.light
  const primaryBg = isDark ? 'rgba(220, 38, 38, 0.1)' : 'rgba(239, 68, 68, 0.1)'
  const primaryFg = isDark ? colors.destructive.dark : colors.destructive.light

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      {/* Animated Header Background */}
      <Animated.View
        style={[
          styles.headerBackground,
          headerBackgroundStyle,
          {
            height: HEADER_HEIGHT + topInset,
            paddingTop: topInset,
          },
        ]}
      >
        <BlurView intensity={80} style={StyleSheet.absoluteFill}>
          <View
            style={{
              flex: 1,
              backgroundColor: isDark
                ? 'rgba(17, 24, 39, 0.5)'
                : 'rgba(255, 255, 255, 0.5)',
            }}
          />
        </BlurView>

        {/* Gradient fade bottom edge */}
        <View
          style={[
            styles.gradientFade,
            {
              backgroundColor: isDark
                ? 'rgba(17, 24, 39, 0.3)'
                : 'rgba(255, 255, 255, 0.3)',
            },
          ]}
        />
      </Animated.View>

      {/* Avatar + Info Section (scrolls up) */}
      <Animated.View style={[styles.profileSection, profileSectionStyle]}>
        {/* Avatar */}
        <Animated.View style={[styles.avatarContainer, avatarContainerStyle]}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: primaryBg,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color: primaryFg,
                },
              ]}
            >
              {initials || 'U'}
            </Text>
          </View>
        </Animated.View>

        {/* Name + Phone Section */}
        <Animated.View style={[styles.textContainer, textContainerStyle]}>
          <Text
            style={[
              styles.name,
              {
                color: isDark ? colors.gray[100] : colors.gray[900],
              },
            ]}
            numberOfLines={1}
          >
            {firstName} {lastName}
          </Text>

          <Animated.Text
            style={[
              styles.phone,
              phoneStyle,
              {
                color: isDark ? colors.gray[300] : colors.gray[500],
              },
            ]}
            numberOfLines={1}
          >
            {phoneNumber || 'Chưa cập nhật'}
          </Animated.Text>
        </Animated.View>
      </Animated.View>

      {/* Fixed Buttons (always visible) */}
      <View style={[styles.buttonsRow, { paddingTop: topInset }]}>
        <Pressable
          style={[styles.iconButton, { backgroundColor: buttonColor }]}
          onPress={onQRPress}
        >
          <QrCode size={20} color="#fff" />
        </Pressable>

        <Pressable
          style={[styles.iconButton, { backgroundColor: buttonColor }]}
          onPress={onEditPress}
        >
          <Edit size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  gradientFade: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    height: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  avatarContainer: {
    overflow: 'hidden',
  },
  avatar: {
    width: AVATAR_INITIAL_SIZE,
    height: AVATAR_INITIAL_SIZE,
    borderRadius: AVATAR_INITIAL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
  },
  buttonsRow: {
    position: 'absolute',
    right: 16,
    top: 0,
    flexDirection: 'row',
    gap: 8,
    zIndex: 11,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
})
