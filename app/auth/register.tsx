import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useColorScheme,
} from 'react-native'

import { ScreenContainer } from '@/components/layout'
import RegisterForm from '@/components/auth/register-form'
import { colors } from '@/constants'

export default function RegisterScreen() {
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.gray[900] : '#ffffff'

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
          <RegisterForm />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
