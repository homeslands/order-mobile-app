import { useTranslation } from 'react-i18next'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'
import * as z from 'zod'

import { FormInput } from '@/components/form/form-input'
import { PHONE_NUMBER_REGEX } from '@/constants'
import { useInitiateRegistration, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { getSyncItem, setSyncItem } from '@/utils/storage'
import { showToast } from '@/utils'

import { RegisterProgressBar } from './register-progress-bar'
import { Text } from '@/components/ui/text'

const phoneSchema = z.object({
  phonenumber: z.string().min(10).max(10).regex(PHONE_NUMBER_REGEX),
})

type TPhoneSchema = z.infer<typeof phoneSchema>

export default function RegisterPhoneForm() {
  const { t } = useTranslation('auth')

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useZodForm(phoneSchema, {
    defaultValues: { phonenumber: '' },
  })

  const { mutate: initiate, isPending } = useInitiateRegistration()

  const onSubmit = (data: TPhoneSchema) => {
    console.log('[initiateRegistration] REQUEST:', data.phonenumber)
    initiate(data.phonenumber, {
      onSuccess: (res) => {
        console.log(
          '[initiateRegistration] RESPONSE:',
          JSON.stringify(res, null, 2),
        )
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
        console.log(
          '[initiateRegistration] ERROR status:',
          (err as any)?.response?.status,
        )
        console.log(
          '[initiateRegistration] ERROR data:',
          JSON.stringify((err as any)?.response?.data, null, 2),
        )
        const serverCode = (err as any)?.response?.data?.statusCode
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
        // Global error handler (QueryCache) sẽ show toast cho các lỗi khác
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
