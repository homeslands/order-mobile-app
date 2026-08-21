import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack } from 'expo-router'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import { useLogout } from '@/hooks/use-logout'
import { useLogoutSheetStore } from '@/stores/logout-sheet.store'
import RegisterProfileForm, {
  type RegisterProfileFormHandle,
} from '@/components/auth/register-profile-form'
import { Text } from '@/components/ui/text'

export default function RegisterProfileScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const { bottom } = useSafeAreaInsets()
  const { t } = useTranslation('auth')

  const formRef = useRef<RegisterProfileFormHandle>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isValid, setIsValid] = useState(false)

  const logout = useLogout()
  const openLogoutSheet = useLogoutSheetStore((s) => s.open)
  const handleLogoutPress = useCallback(
    () => openLogoutSheet(logout),
    [openLogoutSheet, logout],
  )

  // Block Android hardware back button
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => sub.remove()
  }, [])

  const footerHeight = bottom + 140
  const canSubmit = isValid && !isLoading

  return (
    <>
      {/* Disable swipe-back gesture on iOS */}
      <Stack.Screen options={{ gestureEnabled: false }} />

      <ScreenContainer
        edges={['top']}
        className="flex-1"
        style={{ backgroundColor: bgColor }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={{ backgroundColor: bgColor }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: footerHeight }}
          >
            <RegisterProfileForm
              ref={formRef}
              onLoadingChange={setIsLoading}
              onValidChange={setIsValid}
            />
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: bottom + 16,
              backgroundColor: bgColor,
              borderTopColor: isDark ? colors.border.dark : colors.border.light,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.completeBtn, { opacity: canSubmit ? 1 : 0.5 }]}
            onPress={() => formRef.current?.submit()}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeBtnText}>
                {t('register.complete')}
              </Text>
            )}
          </TouchableOpacity>

          {/* Lối ra duy nhất của màn này: back cứng và vuốt-về đều bị chặn, và
              cổng ở app/index.tsx sẽ đưa về đây mỗi lần mở app khi hồ sơ còn
              thiếu. Không có nút này thì người dùng không thể rời đi. */}
          <TouchableOpacity
            style={[
              styles.logoutBtn,
              {
                borderColor: isDark ? colors.border.dark : colors.border.light,
                opacity: isLoading ? 0.5 : 1,
              },
            ]}
            onPress={handleLogoutPress}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.logoutBtnText,
                {
                  color: isDark
                    ? colors.mutedForeground.dark
                    : colors.mutedForeground.light,
                },
              ]}
            >
              {t('logout.logout')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    </>
  )
}

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  completeBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 15,
    color: '#ffffff',
  },
  logoutBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 15,
  },
})
