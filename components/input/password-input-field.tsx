import { Eye, EyeOff } from 'lucide-react-native'
import { useState } from 'react'
import {
  Platform,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import * as Haptics from 'expo-haptics'

import { colors } from '@/constants'
import { useMirroredField } from '@/hooks/use-mirrored-field'
import { cn } from '@/lib/utils'
import { Text } from '@/components/ui/text'
import { useFontScale } from '@/providers/font-scale-provider'

export interface PasswordInputFieldProps {
  value: string | undefined
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  error?: string
  invalid?: boolean
}

export function PasswordInputField({
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  error,
  invalid,
}: PasswordInputFieldProps) {
  const [showPassword, setShowPassword] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const scale = useFontScale()
  const field = useMirroredField({ value, onChange, onBlur })

  const handleToggleVisibility = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setShowPassword((v) => !v)
  }

  const showError = invalid ?? !!error

  return (
    <View>
      <View className="relative">
        <TextInput
          className={cn(
            'rounded-lg border bg-white px-3 pr-10 text-base dark:bg-[#121212]',
            'text-gray-900 dark:text-white',
            showError
              ? 'border-destructive dark:border-destructive'
              : 'border-gray-200 dark:border-[#2e2e2e]',
            disabled && 'opacity-50',
          )}
          style={{
            fontFamily: 'BeVietnamPro_400Regular',
            fontSize: 16 * scale,
            height: 48,
            paddingVertical: Platform.OS === 'ios' ? 0 : 12,
          }}
          allowFontScaling={false}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? colors.mutedForeground.dark : colors.mutedForeground.light
          }
          value={field.value}
          onChangeText={field.onChangeText}
          onBlur={field.onBlur}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textContentType="password"
          autoComplete="password"
          importantForAutofill="yes"
          editable={!disabled}
        />
        <TouchableOpacity
          testID="password-visibility-toggle"
          className="absolute bottom-0 right-3 top-0 justify-center"
          onPress={handleToggleVisibility}
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
      {!!error && (
        <Text className="mt-1 text-xs text-red-500 dark:text-red-400">
          {error}
        </Text>
      )}
    </View>
  )
}
