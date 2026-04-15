// components/auth/OTPInput.tsx
import { colors } from '@/constants'
import { cn } from '@/lib/utils'
import React, { useCallback, useRef } from 'react'
import { NativeSyntheticEvent, TextInput, TextInputKeyPressEventData, TouchableOpacity, View, useColorScheme } from 'react-native'

interface OTPInputProps {
  value: string
  onChange: (val: string) => void
  length?: number
  disabled?: boolean
  characterSet?: 'numeric' | 'alphanumeric'
}

interface OTPInputFieldProps {
  index: number
  value: string
  primaryColor: string
  mutedBorderColor: string
  characterSet: 'numeric' | 'alphanumeric'
  disabled: boolean
  onChangeText: (text: string, index: number) => void
  onKeyPress: (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => void
  setRef: (ref: TextInput | null) => void
  onPress: () => void
}

// Memoized OTP Input Field Component
const OTPInputField = React.memo(({
  index,
  value,
  primaryColor,
  mutedBorderColor,
  characterSet,
  disabled,
  onChangeText,
  onKeyPress,
  setRef,
  onPress,
}: OTPInputFieldProps) => (
  <TouchableOpacity
    activeOpacity={1}
    onPress={onPress}
    className="flex-1"
  >
    <TextInput
      ref={setRef}
      className={cn(
        'h-14 rounded-lg border-2 text-center text-xl font-sans-semibold',
        'bg-card text-foreground',
        disabled && 'opacity-50'
      )}
      style={
        value
          ? { borderColor: primaryColor }
          : { borderColor: mutedBorderColor }
      }
      keyboardType={characterSet === 'numeric' ? 'number-pad' : 'default'}
      maxLength={1}
      value={value.toUpperCase()}
      onChangeText={(text) => onChangeText(text, index)}
      onKeyPress={(e) => onKeyPress(e, index)}
      editable={!disabled}
      selectTextOnFocus
      autoCapitalize={characterSet === 'alphanumeric' ? 'characters' : 'none'}
      autoCorrect={false}
    />
  </TouchableOpacity>
))

OTPInputField.displayName = 'OTPInputField'

export function OTPInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  characterSet = 'alphanumeric',
}: OTPInputProps) {
  const isDark = useColorScheme() === 'dark'
  const primaryColor = isDark ? colors.primary.dark : colors.primary.light
  const mutedBorderColor = isDark ? colors.gray[600] : colors.gray[300]
  const inputRefs = useRef<(TextInput | null)[]>([])

  // Stable per-index callbacks — created once and stored in refs
  const refSettersRef = useRef<((ref: TextInput | null) => void)[]>([])
  const pressHandlersRef = useRef<(() => void)[]>([])
  for (let i = 0; i < length; i++) {
    if (!refSettersRef.current[i]) {
      refSettersRef.current[i] = (ref) => { inputRefs.current[i] = ref }
      pressHandlersRef.current[i] = () => { inputRefs.current[i]?.focus() }
    }
  }

  // Memoize change handler
  const handleChange = useCallback((text: string, index: number) => {
    const normalizedText = text.toUpperCase()
    const filteredText =
      characterSet === 'numeric'
        ? normalizedText.replace(/\D/g, '')
        : normalizedText.replace(/[^A-Z0-9]/g, '')

    if (filteredText.length > 0) {
      const next = value.toUpperCase().split('')
      const chars = filteredText.slice(0, length - index).split('')
      chars.forEach((char, offset) => {
        next[index + offset] = char
      })
      const newValue = next.join('').slice(0, length)
      onChange(newValue)

      // Auto focus next input
      const nextIndex = index + chars.length
      if (nextIndex < length) {
        inputRefs.current[nextIndex]?.focus()
      }
    } else {
      // Delete character
      const next = value.split('')
      next[index] = ''
      onChange(next.join('').slice(0, length))
    }
  }, [value, length, characterSet, onChange])

  // Memoize keypress handler
  const handleKeyPress = useCallback((e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    // Handle backspace to focus previous input
    if (e.nativeEvent.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }, [value])

  return (
    <View className="flex-row justify-between gap-2">
      {Array.from({ length }).map((_, index) => (
        <OTPInputField
          key={index}
          index={index}
          value={value[index] ?? ''}
          primaryColor={primaryColor}
          mutedBorderColor={mutedBorderColor}
          characterSet={characterSet}
          disabled={disabled}
          onChangeText={handleChange}
          onKeyPress={handleKeyPress}
          setRef={refSettersRef.current[index]}
          onPress={pressHandlersRef.current[index]}
        />
      ))}
    </View>
  )
}
