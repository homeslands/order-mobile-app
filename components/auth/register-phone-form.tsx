import { useTranslation } from 'react-i18next'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import * as z from 'zod'

import { FormInput } from '@/components/form/form-input'
import { PHONE_NUMBER_REGEX } from '@/constants'
import { useInitiateRegistration, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { getSyncItem, setSyncItem } from '@/utils/storage'
import { showToast } from '@/utils'
import { showErrorToast } from '@/utils/toast'

import { RegisterProgressBar } from './register-progress-bar'
import { Text } from '@/components/ui/text'

type TPhoneSchema = { phonenumber: string }

export default function RegisterPhoneForm() {
  const { t } = useTranslation('auth')

  const phoneSchema = z.object({
    phonenumber: z
      .string()
      .min(1, t('register.phoneNumberRequired'))
      .min(10, t('register.phoneNumberMaxLength'))
      .max(10, t('register.phoneNumberMaxLength'))
      .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid')),
  })

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useZodForm(phoneSchema, {
    defaultValues: { phonenumber: '' },
  })

  const { mutate: initiate, isPending } = useInitiateRegistration()

  const onSubmit = (data: TPhoneSchema) => {
    initiate(data.phonenumber, {
      onSuccess: (res) => {
        if (res.result?.isRegistered === true) {
          showToast(t('register.phoneAlreadyRegistered'), 'warning')
          navigateNative.replace('/auth/login')
        } else {
          showToast(
            t('register.otpSentSuccess', { phone: data.phonenumber }),
            'success',
          )
          const expiresAt = res.result?.expiresAt
          if (expiresAt) {
            setSyncItem(`register:otp:${data.phonenumber}`, expiresAt)
          }
          navigateNative.push(
            `/auth/register/otp?phone=${encodeURIComponent(data.phonenumber)}${expiresAt ? `&expiresAt=${encodeURIComponent(expiresAt)}` : ''}`,
          )
        }
      },
      onError: (err) => {
        const e = err as {
          response?: { status?: number; data?: { statusCode?: number } }
        }
        const serverCode =
          e?.response?.data?.statusCode ?? e?.response?.status
        if (serverCode === 119046) {
          showToast(
            t('register.otpAlreadySent', { phone: data.phonenumber }),
            'warning',
          )
          const cachedExpiresAt = getSyncItem(
            `register:otp:${data.phonenumber}`,
          )
          navigateNative.push(
            `/auth/register/otp?phone=${encodeURIComponent(data.phonenumber)}${cachedExpiresAt ? `&expiresAt=${encodeURIComponent(cachedExpiresAt)}` : ''}`,
          )
          return
        }
        if (serverCode === 119041) {
          showToast(t('register.phoneAlreadyRegistered'), 'warning')
          navigateNative.replace('/auth/login')
          return
        }
        if (serverCode) {
          showErrorToast(serverCode)
        } else {
          showToast(t('register.profileUpdateFailed'), 'warning')
        }
      },
    })
  }

  const isLoading = isPending || isSubmitting

  return (
    <View className="flex-1 px-6 pt-12">
      <RegisterProgressBar step={1} />

      <Text className="mb-2 font-sans-bold text-3xl text-gray-900 dark:text-white">
        {t('register.title')}
      </Text>
      <Text className="mb-8 font-sans text-base text-gray-500 dark:text-gray-400">
        {t('register.subtitle')}
      </Text>

      <FormInput
        control={control}
        name="phonenumber"
        label={t('register.phoneNumber')}
        placeholder={t('register.enterPhoneNumber')}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoComplete="tel"
        disabled={isLoading}
        useTextInput
        transformOnChange={(v) => v.replace(/\D/g, '').slice(0, 10)}
        labelClassName="text-md font-sans-medium text-gray-500 dark:text-gray-400"
      />

      <TouchableOpacity
        className="items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-white">
            {t('register.next')}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-6 items-center"
        onPress={() => navigateNative.replace('/auth/login')}
        disabled={isLoading}
      >
        <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
          {t('register.haveAccount')}{' '}
          <Text className="font-sans-semibold text-amber-500 dark:text-amber-400">
            {t('register.login')}
          </Text>
        </Text>
      </TouchableOpacity>
    </View>
  )
}
