import { ArrowLeft } from 'lucide-react-native'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, Text, View, useColorScheme } from 'react-native'
import { ScreenContainer } from '@/components/layout'

import { Button, Input } from '@/components/ui'
import { colors } from '@/constants'
import { navigateNative } from '@/lib/navigation'
import { useUserStore } from '@/stores'
import { showToast } from '@/utils'

function EditProfileScreen() {
  const { t } = useTranslation('profile')
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const userInfo = useUserStore((state) => state.userInfo)

  const [firstName, setFirstName] = useState(userInfo?.firstName ?? '')
  const [lastName, setLastName] = useState(userInfo?.lastName ?? '')
  const [address, setAddress] = useState(userInfo?.address ?? '')

  if (!userInfo) {
    navigateNative.back()
    return null
  }

  const handleSave = () => {
    // TODO: Gọi API cập nhật profile và sync lại store
    showToast('Cập nhật thông tin cá nhân (demo). Vui lòng nối API backend.')
    navigateNative.back()
  }

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      className="flex-1 bg-gray-50 dark:bg-gray-900"
    >
      {/* Header */}
      <View className="flex-row items-center border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
        <Button
          variant="ghost"
          className="mr-2 h-10 min-h-0 w-10 items-center justify-center rounded-full px-0"
          onPress={() => navigateNative.back()}
        >
          <ArrowLeft
            size={22}
            color={
              isDark
                ? colors.mutedForeground.dark
                : colors.mutedForeground.light
            }
          />
        </Button>
        <Text className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {t('contactInfo.edit')}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <View className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('lastName')}
            </Text>
            <Input
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('enterLastName')}
              autoCapitalize="words"
            />
          </View>

          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('firstName')}
            </Text>
            <Input
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('enterFirstName')}
              autoCapitalize="words"
            />
          </View>

          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('address')}
            </Text>
            <Input
              value={address}
              onChangeText={setAddress}
              placeholder={t('enterAddress')}
            />
          </View>

          {/* Email / số điện thoại có thể để readonly vì liên quan xác minh & đăng nhập */}
          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('phoneNoEdit')}
            </Text>
            <Input
              value={userInfo.phonenumber}
              editable={false}
              className="bg-gray-100 dark:bg-gray-700"
            />
          </View>

          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('emailNoEdit')}
            </Text>
            <Input
              value={userInfo.email}
              editable={false}
              className="bg-gray-100 dark:bg-gray-700"
            />
          </View>
        </View>

        <View className="mt-6">
          <Button
            className="h-11 w-full rounded-lg"
            style={{ backgroundColor: primaryColor }}
            onPress={handleSave}
          >
            <Text className="text-sm font-semibold text-white">
              {t('saveChanges')}
            </Text>
          </Button>
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}

EditProfileScreen.displayName = 'EditProfileScreen'
export default React.memo(EditProfileScreen)
