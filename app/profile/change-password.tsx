import { changePassword } from '@/api/profile'
import { Button } from '@/components/ui'
import { ScreenContainer } from '@/components/layout'
import { PasswordInputField, PasswordRulesInput } from '@/components/input'
import { colors } from '@/constants'
import { navigateNative } from '@/lib/navigation'
import { showToast } from '@/utils'
import { ArrowLeft } from 'lucide-react-native'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Text, View, useColorScheme } from 'react-native'

function ChangePasswordScreen() {
  const { t } = useTranslation('profile')
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast(t('changePassword.fillRequired'))
      return
    }

    if (newPassword !== confirmPassword) {
      showToast(t('changePassword.passwordMismatch'))
      return
    }

    setIsSubmitting(true)
    changePassword({ oldPassword, newPassword })
      .then(() => {
        showToast(t('changePassword.success'))
        navigateNative.back()
      })
      .catch(() => {
        showToast(t('changePassword.error'))
      })
      .finally(() => {
        setIsSubmitting(false)
      })
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
          {t('changePassword.title')}
        </Text>
      </View>

      <View className="flex-1 px-4 py-6">
        <View className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {/* Mật khẩu cũ */}
          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('oldPassword')}
            </Text>
            <PasswordInputField
              value={oldPassword}
              onChange={setOldPassword}
              placeholder={t('enterOldPassword')}
              disabled={isSubmitting}
            />
          </View>

          {/* Mật khẩu mới — có strength bar + rules */}
          <View className="mb-4">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('newPassword')}
            </Text>
            <PasswordRulesInput
              value={newPassword}
              onChange={setNewPassword}
              placeholder={t('enterNewPassword')}
              disabled={isSubmitting}
            />
          </View>

          {/* Xác nhận mật khẩu */}
          <View className="mb-2">
            <Text className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              {t('confirmPassword')}
            </Text>
            <PasswordInputField
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder={t('enterConfirmPassword')}
              disabled={isSubmitting}
            />
          </View>

          <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {t('changePassword.passwordHint')}
          </Text>
        </View>

        <View className="mt-6">
          <Button
            className="h-11 w-full rounded-lg"
            style={{ backgroundColor: primaryColor }}
            disabled={isSubmitting}
            onPress={handleSubmit}
          >
            <Text className="text-sm font-semibold text-white">
              {isSubmitting
                ? t('changePassword.updating')
                : t('changePassword.save')}
            </Text>
          </Button>
        </View>
      </View>
    </ScreenContainer>
  )
}

ChangePasswordScreen.displayName = 'ChangePasswordScreen'
export default React.memo(ChangePasswordScreen)
