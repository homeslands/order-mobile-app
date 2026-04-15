import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'

import { Button } from '@/components/ui'
import { ROUTE } from '@/constants'
import { useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import {
  type TForgotPasswordIdentitySchema,
  useForgotPasswordIdentitySchema,
} from '@/schemas'

import { FormInput } from './form-input'

interface ForgotPasswordIdentityFormProps {
  onSubmit: (value: TForgotPasswordIdentitySchema) => void
  isLoading?: boolean
}

export const ForgotPasswordIdentityForm = React.memo(
  function ForgotPasswordIdentityForm({
    onSubmit,
    isLoading = false,
  }: ForgotPasswordIdentityFormProps) {
    const { t } = useTranslation('auth')

    const schema = useForgotPasswordIdentitySchema()
    const { control, handleSubmit } = useZodForm(schema, {
      defaultValues: { identity: '' },
    })

    return (
      <View className="gap-4">
        <FormInput
          control={control}
          name="identity"
          label={t('forgotPassword.identityPlaceholder')}
          placeholder={t('forgotPassword.identityPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          disabled={isLoading}
          useTextInput
        />

        <Button
          variant="primary"
          className="mt-2 h-11 rounded-lg"
          disabled={isLoading}
          onPress={handleSubmit(onSubmit)}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-sm font-sans-semibold text-primary-foreground">
              {t('forgotPassword.sendCode')}
            </Text>
          )}
        </Button>

        <TouchableOpacity
          onPress={() => navigateNative.replace(ROUTE.LOGIN)}
          disabled={isLoading}
        >
          <Text className="text-center text-sm font-sans-medium text-primary">
            {t('forgotPassword.backToLogin')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  },
)
