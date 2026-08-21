import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { z } from 'zod'

import { RegisterProgressBar } from './register-progress-bar'
import { FormInput } from '@/components/form'
import { DobExpandablePicker } from '@/components/profile'
import { NAME_REGEX } from '@/constants'
import { useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import dayjs from 'dayjs'
import { updateProfile } from '@/api/profile'
import { showToast } from '@/utils'
import { useUserStore } from '@/stores'
import { Text } from '@/components/ui/text'

function useRegisterProfileSchema() {
  const { t } = useTranslation('auth')
  return z.object({
    firstName: z
      .string()
      .min(1, t('register.firstNameRequired'))
      .max(100, t('register.firstNameTooLong', { count: 100 }))
      .refine((val) => NAME_REGEX.test(val), t('register.firstNameInvalid')),
    lastName: z
      .string()
      .min(1, t('register.lastNameRequired'))
      .max(100, t('register.lastNameTooLong', { count: 100 }))
      .refine((val) => NAME_REGEX.test(val), t('register.lastNameInvalid')),
  })
}

type TRegisterProfileSchema = z.infer<
  ReturnType<typeof useRegisterProfileSchema>
>

export interface RegisterProfileFormHandle {
  submit: () => void
}

interface Props {
  onLoadingChange?: (loading: boolean) => void
  onValidChange?: (valid: boolean) => void
}

const RegisterProfileForm = forwardRef<RegisterProfileFormHandle, Props>(
  function RegisterProfileForm({ onLoadingChange, onValidChange }, ref) {
    const { t } = useTranslation('auth')
    const setUserInfo = useUserStore((s) => s.setUserInfo)
    const [dob, setDob] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const schema = useRegisterProfileSchema()
    const {
      control,
      handleSubmit,
      formState: { isValid },
    } = useZodForm(schema, {
      defaultValues: { firstName: '', lastName: '' },
    })

    // Ngày sinh nằm ngoài react-hook-form (DobExpandablePicker không phải field
    // của RHF), nên tính hợp lệ phải cộng thêm nó bằng tay.
    const isFormValid = isValid && !!dob

    const goHome = () => navigateNative.replace('/(tabs)/home')

    const onSubmit = async (data: TRegisterProfileSchema) => {
      setIsLoading(true)
      try {
        const res = await updateProfile({
          firstName: data.firstName,
          lastName: data.lastName,
          dob: dayjs(dob, 'YYYY-MM-DD').format('DD/MM/YYYY'),
        })
        if (res?.result) setUserInfo(res.result)
        showToast('toast.updateProfileSuccess', 'success')
        goHome()
      } catch {
        showToast(t('register.profileUpdateFailed'), 'warning')
      } finally {
        setIsLoading(false)
      }
    }

    // Stable ref so the imperative handle doesn't need to update deps
    const submitFnRef = useRef<() => void>(() => {})
    submitFnRef.current = handleSubmit(onSubmit)

    useImperativeHandle(
      ref,
      () => ({
        submit: () => submitFnRef.current(),
      }),
      [],
    )

    useEffect(() => {
      onLoadingChange?.(isLoading)
    }, [isLoading, onLoadingChange])

    useEffect(() => {
      onValidChange?.(isFormValid)
    }, [isFormValid, onValidChange])

    return (
      <View className="px-6 pt-12">
        <RegisterProgressBar step={3} />

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
            placeholder={t('register.enterLastName')}
            autoCapitalize="words"
            autoComplete="name"
            disabled={isLoading}
          />

          <FormInput
            control={control}
            name="firstName"
            label={t('register.firstName')}
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
              disabled={isLoading}
            />
          </View>
        </View>
      </View>
    )
  },
)

export default RegisterProfileForm
