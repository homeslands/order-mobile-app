import { LinearGradient } from 'expo-linear-gradient'
import {
  ChevronLeft,
  Mail,
  MapPin,
  Phone,
  Shield,
  SquarePen,
  User as UserIcon,
} from 'lucide-react-native'
import { Image } from 'expo-image'
import React, { useEffect, useMemo } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui'
import { ROUTE, colors } from '@/constants'
import { STATIC_TOP_INSET } from '@/constants/status-bar'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import { useTranslation } from 'react-i18next'

function InfoHeader({
  title,
  onBack,
  onEdit,
  isDark,
}: {
  title: string
  onBack: () => void
  onEdit: () => void
  isDark: boolean
}) {
  const pageBg = isDark ? colors.background.dark : colors.background.light
  const gradientColors = useMemo(
    () => [`${pageBg}F0`, `${pageBg}AA`, `${pageBg}00`] as const,
    [pageBg],
  )

  return (
    <View style={phStyles.container} pointerEvents="box-none">

      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[phStyles.row, { paddingTop: STATIC_TOP_INSET + 10 }]}
        pointerEvents="auto"
      >
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={[
            phStyles.circleBtn,
            { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
            phStyles.shadow,
          ]}
        >
          <ChevronLeft
            size={20}
            color={isDark ? colors.gray[50] : colors.gray[900]}
          />
        </Pressable>

        <Text
          style={[
            phStyles.title,
            { color: isDark ? colors.gray[50] : colors.gray[900] },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>

        <Pressable
          onPress={onEdit}
          hitSlop={8}
          style={[
            phStyles.circleBtn,
            { backgroundColor: isDark ? colors.gray[800] : colors.white.light },
            phStyles.shadow,
          ]}
        >
          <SquarePen
            size={20}
            color={isDark ? colors.gray[50] : colors.gray[900]}
          />
        </Pressable>
      </View>
    </View>
  )
}

const phStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
})

function ProfileInfoScreen() {
  const { t } = useTranslation('profile')
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const insets = useSafeAreaInsets()

  const userInfo = useUserStore((state) => state.userInfo)

  const initials = useMemo(() => {
    if (!userInfo) return ''
    const first = userInfo.firstName?.charAt(0) || ''
    const last = userInfo.lastName?.charAt(0) || ''
    return `${first}${last}`.toUpperCase()
  }, [userInfo])

  useEffect(() => {
    if (!userInfo) navigateNative.back()
  }, [userInfo])

  if (!userInfo) return null

  const isVerified = userInfo.isVerifiedEmail && userInfo.isVerifiedPhonenumber
  const successColor = isDark ? colors.success.dark : colors.success.light

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? colors.background.dark : colors.background.light }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: 16,
          paddingTop: STATIC_TOP_INSET + 76,
          paddingBottom: insets.bottom + 32,
        }}
      >
        {/* Thông tin cơ bản */}
        <View className="mb-6 flex-row items-center rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {/* Avatar */}
          {userInfo.image ? (
            <Image
              source={{ uri: userInfo.image }}
              className="mr-3 h-16 w-16 rounded-full bg-gray-200 dark:bg-gray-700"
            />
          ) : (
            <View className="mr-3 h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <Text className="text-2xl font-bold text-red-600 dark:text-red-400">
                {initials || 'U'}
              </Text>
            </View>
          )}

          {/* Tên và Email */}
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {userInfo.firstName} {userInfo.lastName}
              </Text>
              {isVerified && (
                <Shield size={16} color={successColor} fill={successColor} />
              )}
            </View>
            <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {userInfo.email || t('profile.contactInfo.noEmail')}
            </Text>
          </View>

          {/* Icon chỉnh sửa */}
          <Button
            variant="ghost"
            className="h-10 min-h-0 w-10 items-center justify-center rounded-full px-0"
            onPress={() => navigateNative.push(ROUTE.CLIENT_PROFILE_EDIT)}
          >
            <SquarePen size={18} color={isDark ? colors.gray[400] : colors.gray[500]} />
          </Button>
        </View>

        {/* Thông tin chi tiết */}
        <View className="mb-4 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <Text className="mb-6 text-sm font-semibold text-gray-700 dark:text-gray-200">
            {t('profile.contactInfo.title')}
          </Text>

          <View className="gap-6">
            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <UserIcon size={18} color={isDark ? colors.gray[200] : colors.gray[600]} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {t('profile.contactInfo.name')}
                </Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  {userInfo.firstName} {userInfo.lastName}
                </Text>
              </View>
            </View>

            <View className="flex-row items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <Phone size={18} color={isDark ? colors.gray[200] : colors.gray[600]} />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {t('profile.contactInfo.phone')}
                  </Text>
                  {userInfo.isVerifiedPhonenumber && (
                    <Shield
                      size={12}
                      color={successColor}
                      fill={successColor}
                    />
                  )}
                  {!userInfo.isVerifiedPhonenumber && (
                    <Text className="text-xs text-yellow-600 dark:text-yellow-400">
                      • {t('profile.contactInfo.notVerified')}
                    </Text>
                  )}
                </View>
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  {userInfo.phonenumber}
                </Text>
              </View>
              {!userInfo.isVerifiedPhonenumber && (
                <Button
                  variant="outline"
                  className="h-8 rounded-md border border-primary px-3"
                  onPress={() =>
                    navigateNative.push(
                      ROUTE.CLIENT_PROFILE_VERIFY_PHONE_NUMBER,
                    )
                  }
                >
                  <Text className="text-xs font-sans-semibold text-primary">
                    {t('profile.contactInfo.verify')}
                  </Text>
                </Button>
              )}
            </View>

            <View className="flex-row items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <Mail size={18} color={isDark ? colors.gray[200] : colors.gray[600]} />
              </View>

              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs text-gray-500 dark:text-gray-400">
                    {t('profile.contactInfo.email')}
                  </Text>
                  {userInfo.isVerifiedEmail && (
                    <Shield size={12} color={successColor} fill={successColor} />
                  )}
                  {!userInfo.isVerifiedEmail && (
                    <Text className="text-xs text-yellow-600 dark:text-yellow-400">
                      • {t('profile.contactInfo.notVerified')}
                    </Text>
                  )}
                </View>

                <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  {userInfo.email || t('profile.contactInfo.notUpdated')}
                </Text>
              </View>

              {!userInfo.isVerifiedEmail && (
                <Button
                  variant="outline"
                  className="h-8 rounded-md border border-primary px-3"
                  onPress={() =>
                    navigateNative.push(ROUTE.CLIENT_PROFILE_VERIFY_EMAIL)
                  }
                >
                  <Text className="text-xs font-sans-semibold text-primary">
                    {t('profile.contactInfo.verify')}
                  </Text>
                </Button>
              )}
            </View>

            <View className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                <MapPin size={18} color={isDark ? colors.gray[200] : colors.gray[600]} />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 dark:text-gray-400">
                  {t('profile.contactInfo.address')}
                </Text>
                <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  {userInfo.address || t('profile.contactInfo.notUpdated')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Chi nhánh yêu thích */}
        {userInfo.branch && (
          <View className="mb-4 rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <Text className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
              {t('profile.contactInfo.branch')}
            </Text>
            <Text className="text-sm font-medium text-gray-900 dark:text-gray-50">
              {userInfo.branch.name}
            </Text>
            <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {userInfo.branch.address}
            </Text>
          </View>
        )}
      </ScrollView>

      <InfoHeader
        title={t('profile.generalInfo.title')}
        onBack={() => navigateNative.back()}
        onEdit={() => navigateNative.push(ROUTE.CLIENT_PROFILE_EDIT)}
        isDark={isDark}
      />
    </View>
  )
}

ProfileInfoScreen.displayName = 'ProfileInfoScreen'
export default React.memo(ProfileInfoScreen)
