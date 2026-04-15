import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { AuthRules } from '@/constants'

export interface PasswordRules {
  minLength: boolean
  hasLetter: boolean
  hasNumber: boolean
}

export interface PasswordRulesResult {
  rules: PasswordRules
  strength: string | null
  labels: {
    minLength: string
    hasLetter: string
    hasNumber: string
    strength: string
  }
}

export function usePasswordRules(value: string | undefined): PasswordRulesResult {
  const { t } = useTranslation('auth')

  const hasInput = value && value.length > 0

  // Tính toán rules trực tiếp từ value
  const rules = useMemo<PasswordRules>(() => {
    if (!hasInput || !value) {
      return {
        minLength: false,
        hasLetter: false,
        hasNumber: false,
      }
    }

    return {
      minLength: value.length >= AuthRules.MIN_LENGTH,
      hasLetter: /[A-Za-z]/.test(value),
      hasNumber: /\d/.test(value),
    }
  }, [value, hasInput])

  // Tính strength
  const strength = useMemo<string | null>(() => {
    const passed = Object.values(rules).filter(Boolean).length
    if (!hasInput) return null
    if (passed <= 1) return t('rule.weak')
    if (passed === 2 || passed === 3) return t('rule.medium')
    return t('rule.strong')
  }, [rules, hasInput, t])

  // Labels cho rules
  const labels = useMemo(
    () => ({
      minLength: t('rule.minLength', { count: AuthRules.MIN_LENGTH }),
      hasLetter: t('rule.hasLetter'),
      hasNumber: t('rule.hasNumber'),
      strength: t('rule.strength'),
    }),
    [t]
  )

  return {
    rules,
    strength,
    labels,
  }
}

