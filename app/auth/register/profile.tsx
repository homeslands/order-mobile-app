import { KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native'
import { ScreenContainer } from '@/components/layout'
import { colors } from '@/constants'
import RegisterProfileForm from '@/components/auth/register-profile-form'

export default function RegisterProfileScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
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
          <RegisterProfileForm />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
