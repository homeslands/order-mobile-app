import { Eye, EyeOff } from 'lucide-react-native'
import { useState } from 'react'
import { Text, TextInput, TouchableOpacity, View } from 'react-native'

import { usePasswordRules, type PasswordRules } from '@/hooks'
import { cn } from '@/lib/utils'

export interface PasswordRulesInputProps {
  value: string | undefined
  onChange: (value: string) => void
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

export function PasswordRulesInput({
  value,
  onChange,
  placeholder,
  disabled,
  rules: rulesProp,
  strength: strengthProp,
  labels: labelsProp,
  showRules = true,
}: PasswordRulesInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)

  // Nếu không có props từ bên ngoài, dùng hook (backward compatibility)
  const hookResult = usePasswordRules(value)
  const rules = rulesProp || hookResult.rules
  const strength = strengthProp ?? hookResult.strength
  const labels = labelsProp || hookResult.labels

  return (
    <View className="gap-2">
      <View className="relative">
        <TextInput
          className={cn(
            'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg px-4 py-3 pr-12 text-base border',
            'border-gray-300 dark:border-gray-700',
            disabled && 'opacity-50'
          )}
          placeholder={placeholder}
          placeholderTextColor="#999"
          value={value}
          onChangeText={(text) => {
            onChange(text)
            if (!touched) setTouched(true)
          }}
          onBlur={() => setTouched(true)}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!disabled}
          style={{ fontFamily: 'BeVietnamPro_400Regular' }}
        />
        <TouchableOpacity
          className="absolute right-4 top-0 bottom-0 justify-center"
          onPress={() => setShowPassword(!showPassword)}
          disabled={disabled}
        >
          {showPassword ? <EyeOff size={20} color="#999" /> : <Eye size={20} color="#999" />}
        </TouchableOpacity>
      </View>

      {showRules && touched && (
        <View className="gap-1">
          <Text
            className={cn(
              'text-xs',
              rules.minLength ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            • {labels.minLength}
          </Text>
          <Text
            className={cn(
              'text-xs',
              rules.hasLetter ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            • {labels.hasLetter}
          </Text>
          <Text
            className={cn(
              'text-xs',
              rules.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'
            )}
          >
            • {labels.hasNumber}
          </Text>

          {strength && (
            <Text
              className={cn(
                'text-xs font-medium mt-1',
                // So sánh strength string để xác định màu (weak/medium/strong)
                strength.toLowerCase().includes('weak') && 'text-red-600 dark:text-red-400',
                strength.toLowerCase().includes('medium') && 'text-yellow-600 dark:text-yellow-400',
                strength.toLowerCase().includes('strong') && 'text-green-600 dark:text-green-400'
              )}
            >
              {labels.strength}: {strength}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}

