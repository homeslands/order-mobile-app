import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native'
import { z } from 'zod'

import { RegisterProgressBar } from './register-progress-bar'
import { FormInput } from '@/components/form'
import { DobExpandablePicker } from '@/components/profile'
import { NAME_REGEX } from '@/constants'
import { useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { updateProfile } from '@/api/profile'
import { showToast } from '@/utils'

function useRegisterProfileSchema() {
  const { t } = useTranslation('auth')
  return z.object({
    firstName: z
      .string()
      .max(100, t('register.firstNameTooLong', { count: 100 }))
      .refine(
        (val) => val === '' || NAME_REGEX.test(val),
        t('register.firstNameInvalid'),
      )
      .optional()
      .or(z.literal('')),
    lastName: z
      .string()
      .max(100, t('register.lastNameTooLong', { count: 100 }))
      .refine(
        (val) => val === '' || NAME_REGEX.test(val),
        t('register.lastNameInvalid'),
      )
      .optional()
      .or(z.literal('')),
  })
}

type TRegisterProfileSchema = z.infer<ReturnType<typeof useRegisterProfileSchema>>

export default function RegisterProfileForm() {
  const { t } = useTranslation('auth')
  const [dob, setDob] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const schema = useRegisterProfileSchema()
  const {
    control,
    handleSubmit,
  } = useZodForm(schema, {
    defaultValues: { firstName: '', lastName: '' },
  })

  const goHome = () => navigateNative.replace('/(tabs)/home')

  const onSubmit = async (data: TRegisterProfileSchema) => {
    setIsLoading(true)
    try {
      await updateProfile({
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        dob: dob || null,
      })
    } catch {
      showToast(t('register.profileUpdateFailed'), 'warning')
    } finally {
      setIsLoading(false)
      goHome()
    }
  }

  return (
    <View className="flex-1 px-6 pt-12">
      <RegisterProgressBar step={4} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.profileTitle')}
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.profileSubtitle')}
      </Text>

      <View className="gap-4">
        <FormInput
          control={control}
          name="lastName"
          label={t('register.lastName')}
          optional
          placeholder={t('register.enterLastName')}
          autoCapitalize="words"
          autoComplete="name"
          disabled={isLoading}
        />

        <FormInput
          control={control}
          name="firstName"
          label={t('register.firstName')}
          optional
          placeholder={t('register.enterFirstName')}
          autoCapitalize="words"
          autoComplete="name"
          disabled={isLoading}
        />

        <View>
          <Text className="mb-2 font-sans-medium text-sm text-gray-500 dark:text-gray-400">
            {t('register.dob')}
          </Text>
          <DobExpandablePicker
            value={dob}
            onSelect={setDob}
            placeholder={t('register.enterDob')}
          />
        </View>

        <TouchableOpacity
          className="mt-2 items-center justify-center rounded-lg bg-primary py-4"
          onPress={handleSubmit(onSubmit)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-sans-semibold text-base text-white">
              {t('register.complete')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="py-2"
          onPress={goHome}
          disabled={isLoading}
        >
          <Text className="text-center font-sans-medium text-sm text-amber-500 dark:text-amber-400">
            {t('register.skip')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
