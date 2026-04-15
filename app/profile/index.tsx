import { FlashList, type ListRenderItem } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import { Gift, History, Settings, User, Wallet } from 'lucide-react-native'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated'

import { LoginForm } from '@/components/auth'
import { ScreenContainer } from '@/components/layout'
import { AnimatedProfileHeader } from '@/components/profile/animated-profile-header'
import { colors } from '@/constants'
import { PROFILE_SETTINGS_ITEM_HEIGHT } from '@/constants/list-item-sizes'
import { useLoyaltyPoints, useRunAfterTransition } from '@/hooks'
import { useAuthStore, useUserStore } from '@/stores'
import {
  ProfileItem,
  type ProfileItemProps,
} from '../(tabs)/profile/profile-item'

interface ProfileSettingItem {
  key: string
  label: string
  icon: ProfileItemProps['icon']
}

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList<ProfileSettingItem>,
)

const SETTINGS_ITEM_ICONS = {
  'general-info': User,
  'points': History,
  'coins': Wallet,
  'orders-history': History,
  'account-settings': Settings,
  'gift-cards': Gift,
} as const

// type SettingsItemKey = keyof typeof SETTINGS_ITEM_ICONS

const HEADER_HEIGHT = 160

export default function ProfilePlaceholderScreen() {
  const router = useRouter()
  const { t } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'
  const needsUserInfo = useAuthStore((state) => state.needsUserInfo())
  const userInfo = useUserStore((state) => state.userInfo)
  const setLogout = useAuthStore((state) => state.setLogout)
  const removeUserInfo = useUserStore((state) => state.removeUserInfo)

  const settingsItems = useMemo<ProfileSettingItem[]>(() => [
    { key: 'general-info', label: t('generalInfoLabel'), icon: SETTINGS_ITEM_ICONS['general-info'] },
    { key: 'points', label: t('points.title'), icon: SETTINGS_ITEM_ICONS['points'] },
    { key: 'coins', label: t('myCoins'), icon: SETTINGS_ITEM_ICONS['coins'] },
    { key: 'orders-history', label: t('orderHistory.title'), icon: SETTINGS_ITEM_ICONS['orders-history'] },
    { key: 'gift-cards', label: 'Thẻ quà tặng', icon: SETTINGS_ITEM_ICONS['gift-cards'] },
    { key: 'account-settings', label: t('accountSettings'), icon: SETTINGS_ITEM_ICONS['account-settings'] },
  ], [t])

  const scrollY = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet'
      scrollY.value = e.contentOffset.y
    },
  })
  const [allowFetch, setAllowFetch] = useState(false)
  useRunAfterTransition(() => setAllowFetch(true), [])

  const initials = useMemo(() => {
    if (!userInfo) return ''
    const first = userInfo.firstName?.charAt(0) || ''
    const last = userInfo.lastName?.charAt(0) || ''
    return `${first}${last}`.toUpperCase()
  }, [userInfo])

  const { totalPoints } = useLoyaltyPoints(userInfo?.slug, allowFetch)

  const handleEditProfile = useCallback(() => {
    router.push('/profile/info' as never)
  }, [router])

  const handleQRCode = useCallback(() => {
    // console.log('QR Code pressed')
  }, [])

  const handlePress = useCallback(
    (itemKey: string) => {
      switch (itemKey) {
        case 'general-info':
          router.push('/profile/info' as never)
          break
        case 'points':
          router.push('/profile/loyalty-point' as never)
          break
        case 'coins':
          router.push('/profile/coins-placeholder' as never)
          break
        case 'orders-history':
          router.push('/profile/history' as never)
          break
        case 'gift-cards':
          router.push('/profile/gift-cards' as never)
          break
        case 'account-settings':
          router.push('/profile/change-password' as never)
          break
        default:
          break
      }
    },
    [router],
  )

  const handleLogout = useCallback(() => {
    setLogout()
    removeUserInfo()
    router.replace('/(tabs)/home' as never)
  }, [router, removeUserInfo, setLogout])

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }) => { layout.size = PROFILE_SETTINGS_ITEM_HEIGHT },
    [],
  )

  const renderItem: ListRenderItem<ProfileSettingItem> = useCallback(
    ({ item, index }) => {
      const extraLabel =
        item.key === 'points' ? ` — ${totalPoints} ${t('points.point')}` : undefined

      return (
        <ProfileItem
          label={extraLabel ? `${item.label}${extraLabel}` : item.label}
          icon={item.icon}
          onPress={() => handlePress(item.key)}
          index={index}
        />
      )
    },
    [handlePress, totalPoints, t],
  )

  const ListHeader = useMemo(
    () => (
      <View style={{ height: HEADER_HEIGHT + 24 }}>
        <Text
          style={[
            styles.subtitle,
            {
              color: isDark ? colors.gray[300] : colors.gray[500],
              marginTop: 16,
            },
          ]}
        >
          {t('subtitle')}
        </Text>
      </View>
    ),
    [isDark, t],
  )

  const ListFooter = useMemo(
    () => (
      <View style={{ paddingVertical: 24 }}>
        <TouchableOpacity
          style={[
            styles.logoutButton,
            {
              backgroundColor: isDark ? '#7f1d1d' : '#fee2e2',
            },
          ]}
          onPress={handleLogout}
        >
          <Text
            style={[
              styles.logoutText,
              {
                color: isDark ? '#fca5a5' : '#b91c1c',
              },
            ]}
          >
            {t('logout.title')}
          </Text>
        </TouchableOpacity>
      </View>
    ),
    [isDark, t, handleLogout],
  )

  if (needsUserInfo || !userInfo) {
    return (
      <ScreenContainer edges={['top']} className="flex-1">
        <LoginForm />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer edges={['top']} className="flex-1">
      <View style={styles.root}>
        {/* Scrollable List (beneath header) */}
        <AnimatedFlashList
          data={settingsItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          overrideItemLayout={overrideItemLayout}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={scrollHandler}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
        />

        {/* Floating Animated Header (absolutely positioned) */}
        <AnimatedProfileHeader
          firstName={userInfo.firstName || ''}
          lastName={userInfo.lastName || ''}
          phoneNumber={userInfo.phonenumber || ''}
          initials={initials}
          scrollY={scrollY}
          onEditPress={handleEditProfile}
          onQRPress={handleQRCode}
        />
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  logoutButton: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
