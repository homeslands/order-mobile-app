import { Eye, EyeOff } from 'lucide-react-native'
import { useState } from 'react'
import { Text, TextInput, TouchableOpacity, View, useColorScheme } from 'react-native'

import { colors } from '@/constants'
import { cn } from '@/lib/utils'

export interface PasswordInputFieldProps {
  value: string | undefined
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  error?: string
}

export function PasswordInputField({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  error,
}: PasswordInputFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  return (
    <View>
      <View className="relative">
        <TextInput
          className={cn(
            'h-10 rounded-lg border bg-white dark:bg-gray-800 px-3 py-2 pr-10 text-base',
            'text-gray-900 dark:text-white',
            error
              ? 'border-red-500 dark:border-red-500'
              : 'border-gray-200 dark:border-gray-700',
            disabled && 'opacity-50',
          )}
          style={{ fontFamily: 'BeVietnamPro_400Regular' }}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? colors.mutedForeground.dark : colors.mutedForeground.light
          }
          value={value ?? ''}
          onChangeText={onChange}
          onBlur={onBlur}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          editable={!disabled}
        />
        <TouchableOpacity
          className="absolute bottom-0 right-3 top-0 justify-center"
          onPress={() => setShowPassword((v) => !v)}
          disabled={disabled}
          hitSlop={8}
        >
          {showPassword ? (
            <EyeOff
              size={20}
              color={isDark ? '#9ca3af' : '#6b7280'}
            />
          ) : (
            <Eye
              size={20}
              color={isDark ? '#9ca3af' : '#6b7280'}
            />
          )}
        </TouchableOpacity>
      </View>
      {!!error && (
        <Text className="mt-1 text-xs text-destructive">{error}</Text>
      )}
    </View>
  )
}
