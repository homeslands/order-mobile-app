import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native'

import { ScreenContainer } from '@/components/layout'
import RegisterForm from '@/components/auth/register-form'

export default function RegisterScreen() {
  return (
    <ScreenContainer edges={['top']} className="flex-1 bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1 bg-background"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <RegisterForm />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
