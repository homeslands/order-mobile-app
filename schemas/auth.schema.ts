import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  AuthRules,
  EMAIL_REGEX,
  NAME_REGEX,
  PASSWORD_REGEX,
  PHONE_NUMBER_REGEX,
} from '@/constants'

export const loginSchema = z.object({
  phonenumber: z.string(),
  password: z.string(),
})

export function useRegisterSchema() {
  const { t } = useTranslation('auth')
  return z
    .object({
      firstName: z
        .string()
        .max(100, t('register.firstNameTooLong', { count: 100 }))
        .refine(
          (val) => val === '' || NAME_REGEX.test(val),
          t('register.firstNameInvalid'),
        ),
      lastName: z
        .string()
        .max(100, t('register.lastNameTooLong', { count: 100 }))
        .refine(
          (val) => val === '' || NAME_REGEX.test(val),
          t('register.lastNameInvalid'),
        ),
      dob: z.preprocess(
        (val) => {
          const trimmed = typeof val === 'string' ? val.trim() : ''
          return trimmed === '' ? undefined : trimmed
        },
        z
          .string()
          .refine((val) => dayjs(val, 'DD/MM/YYYY', true).isValid(), {
            message: t('register.dobInvalid'),
          })
          .optional(),
      ),
      phonenumber: z
        .string()
        .min(10, t('register.phoneNumberRequired'))
        .max(10, t('register.phoneNumberMaxLength'))
        .regex(PHONE_NUMBER_REGEX, t('register.phoneNumberInvalid')),
      password: z
        .string()
        .min(AuthRules.MIN_LENGTH, {
          message: t('register.minLength', { count: AuthRules.MIN_LENGTH }),
        })
        .regex(PASSWORD_REGEX, t('register.passwordInvalid')),
      confirmPassword: z.string().min(1, t('register.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('register.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export function useForgotPasswordIdentitySchema() {
  const { t } = useTranslation('auth')
  return z.object({
    identity: z
      .string()
      .min(1, t('forgotPassword.identityRequired'))
      .refine(
        (val) => EMAIL_REGEX.test(val) || PHONE_NUMBER_REGEX.test(val),
        t('forgotPassword.identityInvalid'),
      ),
  })
}

export type TForgotPasswordIdentitySchema = z.infer<
  ReturnType<typeof useForgotPasswordIdentitySchema>
>

export function useResetPasswordSchema() {
  const { t } = useTranslation('auth')
  return z
    .object({
      newPassword: z
        .string()
        .min(AuthRules.MIN_LENGTH, {
          message: t('forgotPassword.passwordMin', {
            length: AuthRules.MIN_LENGTH,
          }),
        })
        .regex(PASSWORD_REGEX, t('forgotPassword.passwordInvalid')),
      confirmPassword: z
        .string()
        .min(1, t('forgotPassword.confirmPasswordRequired')),
      token: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('forgotPassword.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export const verifyEmailSchema = z.object({
  accessToken: z.string(),
  email: z.string().email(),
})

export function useRegisterPasswordSchema() {
  const { t } = useTranslation('auth')
  return z
    .object({
      password: z
        .string()
        .min(AuthRules.MIN_LENGTH, {
          message: t('register.minLength', { count: AuthRules.MIN_LENGTH }),
        })
        .regex(PASSWORD_REGEX, t('register.passwordInvalid')),
      confirmPassword: z.string().min(1, t('register.confirmPasswordRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('register.passwordNotMatch'),
      path: ['confirmPassword'],
    })
}

export type TRegisterSchema = z.infer<ReturnType<typeof useRegisterSchema>>
export type TLoginSchema = z.infer<typeof loginSchema>
export type TResetPasswordSchema = z.infer<
  ReturnType<typeof useResetPasswordSchema>
>
export type TRegisterPasswordSchema = z.infer<
  ReturnType<typeof useRegisterPasswordSchema>
>

export type TVerifyEmailSchema = z.infer<typeof verifyEmailSchema>
