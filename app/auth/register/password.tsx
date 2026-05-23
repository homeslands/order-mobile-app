import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import RegisterPasswordForm from '@/components/auth/register-password-form'

export default function RegisterPasswordScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const { phone, otp, expiresAt } = useLocalSearchParams<{
    phone: string
    otp: string
    expiresAt: string
  }>()

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
        >
          <RegisterPasswordForm
            phone={phone ?? ''}
            otp={otp ?? ''}
            otpExpiresAt={expiresAt}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
