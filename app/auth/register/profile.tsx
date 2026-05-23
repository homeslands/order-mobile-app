import { useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import { navigateNative } from '@/lib/navigation'
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

  const footerHeight = bottom + 140

  return (
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
          <RegisterProfileForm ref={formRef} onLoadingChange={setIsLoading} />
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
          style={[styles.completeBtn]}
          onPress={() => formRef.current?.submit()}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.completeBtnText}>{t('register.complete')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.skipBtn,
            {
              borderColor: isDark ? '#d97706' : '#f59e0b',
              opacity: isLoading ? 0.5 : 1,
            },
          ]}
          onPress={() => navigateNative.replace('/(tabs)/home')}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.skipBtnText,
              { color: isDark ? '#d97706' : '#f59e0b' },
            ]}
          >
            {t('register.skip')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
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
  skipBtn: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtnText: {
    fontFamily: 'BeVietnamPro_600SemiBold',
    fontSize: 15,
  },
})
