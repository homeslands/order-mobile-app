import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import RegisterOtpStep from '@/components/auth/register-otp-step'

export default function RegisterOtpScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const { phone, expiresAt } = useLocalSearchParams<{
    phone: string
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
          <RegisterOtpStep phone={phone ?? ''} serverOtpExpiresAt={expiresAt} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
