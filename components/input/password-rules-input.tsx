import { Eye, EyeOff } from 'lucide-react-native'
import { memo, useState } from 'react'
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'

import { colors } from '@/constants'
import { usePasswordRules, type PasswordRules } from '@/hooks'
import { cn } from '@/lib/utils'

export interface PasswordRulesInputProps {
  value: string | undefined
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  rules?: PasswordRules
  strength?: string | null
  labels?: {
    minLength: string
    hasLetter: string
    hasNumber: string
    strength: string
  }
  showRules?: boolean
}

function segmentColor(index: number, metCount: number): string {
  if (index >= metCount) return 'bg-gray-200 dark:bg-gray-700'
  if (metCount === 1) return 'bg-red-500'
  if (metCount === 2) return 'bg-amber-500'
  return 'bg-green-500'
}

function strengthLabelColor(metCount: number): string {
  if (metCount === 0) return 'text-gray-400 dark:text-gray-500'
  if (metCount === 1) return 'text-red-500'
  if (metCount === 2) return 'text-amber-500'
  return 'text-green-600 dark:text-green-400'
}

const RuleTag = memo(function RuleTag({
  met,
  label,
}: {
  met: boolean
  label: string
}) {
  return (
    <View
      className={cn(
        'rounded-full px-2 py-0.5',
        met
          ? 'bg-green-100 dark:bg-green-900/40'
          : 'bg-gray-100 dark:bg-gray-800',
      )}
    >
      <Text
        className={cn(
          'text-xs font-medium',
          met
            ? 'text-green-700 dark:text-green-400'
            : 'text-gray-400 dark:text-gray-500',
        )}
      >
        {met ? '✓ ' : '✗ '}
        {label}
      </Text>
    </View>
  )
})

export function PasswordRulesInput({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  rules: rulesProp,
  strength: strengthProp,
  labels: labelsProp,
  showRules = true,
}: PasswordRulesInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  const hookResult = usePasswordRules(value)
  const rules = rulesProp ?? hookResult.rules
  const strength = strengthProp ?? hookResult.strength
  const labels = labelsProp ?? hookResult.labels

  const metCount = [rules.minLength, rules.hasLetter, rules.hasNumber].filter(
    Boolean,
  ).length

  return (
    <View className="gap-2">
      {/* Input + toggle */}
      <View className="relative">
        <TextInput
          className={cn(
            'rounded-lg border bg-white px-4 py-3 pr-12 text-base text-gray-900 dark:bg-gray-800 dark:text-white',
            'border-gray-300 dark:border-gray-700',
            disabled && 'opacity-50',
          )}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? colors.mutedForeground.dark : colors.mutedForeground.light
          }
          value={value}
          onChangeText={(text) => {
            onChange(text)
            if (!touched) setTouched(true)
          }}
          onBlur={() => {
            setTouched(true)
            onBlur?.()
          }}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!disabled}
          style={{ fontFamily: 'BeVietnamPro_400Regular' }}
        />
        <TouchableOpacity
          className="absolute bottom-0 right-4 top-0 justify-center"
          onPress={() => setShowPassword(!showPassword)}
          disabled={disabled}
          hitSlop={8}
        >
          {showPassword ? (
            <EyeOff
              size={20}
              color={
                isDark
                  ? colors.mutedForeground.dark
                  : colors.mutedForeground.light
              }
            />
          ) : (
            <Eye
              size={20}
              color={
                isDark
                  ? colors.mutedForeground.dark
                  : colors.mutedForeground.light
              }
            />
          )}
        </TouchableOpacity>
      </View>

      {/* Strength bar + rule tags — only shown after touched */}
      {showRules && touched && (
        <View className="gap-2">
          {/* Strength bar + label on same row */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1 flex-row gap-1">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full',
                    segmentColor(i, metCount),
                  )}
                />
              ))}
            </View>
            {strength !== null && (
              <Text
                className={cn(
                  'text-xs font-semibold',
                  strengthLabelColor(metCount),
                )}
              >
                {strength}
              </Text>
            )}
          </View>

          {/* Rule tags */}
          <View className="flex-row flex-wrap gap-1.5">
            <RuleTag met={rules.minLength} label={labels.minLength} />
            <RuleTag met={rules.hasLetter} label={labels.hasLetter} />
            <RuleTag met={rules.hasNumber} label={labels.hasNumber} />
          </View>
        </View>
      )}
    </View>
  )
}
