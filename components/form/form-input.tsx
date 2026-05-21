import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form'
import { Platform, Text, TextInput, View, useColorScheme } from 'react-native'
import { useRef, useEffect, useState } from 'react'

import { Input } from '@/components/ui'
import { colors } from '@/constants'
import { cn } from '@/lib/utils'

interface FormInputProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  required?: boolean
  optional?: boolean
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?:
    | 'off'
    | 'email'
    | 'tel'
    | 'password'
    | 'name'
    | 'username'
    | undefined
  disabled?: boolean
  secureTextEntry?: boolean
  useTextInput?: boolean // Use TextInput instead of Input component for custom styling
  className?: string
  containerClassName?: string
  labelClassName?: string
  errorClassName?: string
  helperText?: string
  transformOnChange?: (value: string) => string // Transform value before onChange
}

interface FormInputFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  error?: string
  label?: string
  required?: boolean
  optional?: boolean
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?:
    | 'off'
    | 'email'
    | 'tel'
    | 'password'
    | 'name'
    | 'username'
    | undefined
  disabled?: boolean
  secureTextEntry?: boolean
  useTextInput?: boolean
  className?: string
  containerClassName?: string
  labelClassName?: string
  errorClassName?: string
  helperText?: string
  transformOnChange?: (value: string) => string
}

function FormInputField({
  value,
  onChange,
  onBlur,
  error,
  label,
  required,
  optional,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  disabled,
  secureTextEntry,
  useTextInput = false,
  className,
  containerClassName,
  labelClassName,
  errorClassName,
  helperText,
  transformOnChange,
}: FormInputFieldProps) {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const [localValue, setLocalValue] = useState(value ?? '')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingValueRef = useRef<string>(value ?? '')
  const prevValueRef = useRef<string | undefined>(value)

  // Sync when value changes externally (e.g. form reset)
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value
      const next = value ?? ''
      pendingValueRef.current = next
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue(next)
    }
  }, [value])

  const handleChangeText = (text: string) => {
    const next = transformOnChange ? transformOnChange(text) : text

    // Sync prevValueRef before setLocalValue so the useEffect that watches
    // the RHF `value` prop skips calling setLocalValue again when the
    // debounced onChange fires 300ms later (value === prevValueRef → no-op).
    prevValueRef.current = next
    pendingValueRef.current = next
    setLocalValue(next)

    // Debounce RHF update to avoid Zod validation on every keystroke
    // (mode: 'onTouched' triggers validation after first blur)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      onChange(pendingValueRef.current)
    }, 300)
  }

  // Flush on blur so RHF always has latest value before validation
  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    onChange(pendingValueRef.current)
    onBlur()
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  const showError = !!error
  const showHelper = !!helperText && !showError

  return (
    <View className={cn('mb-4', containerClassName)}>
      {label && (
        <Text
          className={cn(
            'mb-1 text-xs text-gray-500 dark:text-gray-400',
            labelClassName,
          )}
        >
          {label}
          {required && (
            <Text className="text-red-500 dark:text-red-400"> *</Text>
          )}
          {optional && (
            <Text className="text-gray-400 dark:text-gray-500">
              {' '}
              (Không bắt buộc)
            </Text>
          )}
        </Text>
      )}
      {useTextInput ? (
        <TextInput
          className={cn(
            'rounded-lg border bg-white px-4 font-sans text-base text-gray-900 dark:bg-[#121212] dark:text-white',
            showError
              ? 'border-red-500 dark:border-red-400'
              : 'border-gray-200 dark:border-[#2e2e2e]',
            disabled && 'opacity-50',
            className,
          )}
          style={{
            height: 48,
            paddingVertical: Platform.OS === 'ios' ? 0 : 12,
          }}
          placeholder={placeholder}
          placeholderTextColor={
            isDark ? colors.mutedForeground.dark : colors.mutedForeground.light
          }
          value={localValue}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          spellCheck={false}
          secureTextEntry={secureTextEntry}
          editable={!disabled}
        />
      ) : (
        <Input
          value={localValue}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          error={showError}
          className={className}
        />
      )}

      {showError && (
        <Text
          className={cn(
            'mt-1 text-xs text-red-500 dark:text-red-400',
            errorClassName,
          )}
        >
          {error}
        </Text>
      )}

      {showHelper && (
        <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {helperText}
        </Text>
      )}
    </View>
  )
}

export function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  required,
  optional,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoComplete,
  disabled,
  secureTextEntry,
  useTextInput = false,
  className,
  containerClassName,
  labelClassName,
  errorClassName,
  helperText,
  transformOnChange,
}: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error },
      }) => (
        <FormInputField
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          error={error?.message}
          label={label}
          required={required}
          optional={optional}
          placeholder={placeholder}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          disabled={disabled}
          secureTextEntry={secureTextEntry}
          useTextInput={useTextInput}
          className={className}
          containerClassName={containerClassName}
          labelClassName={labelClassName}
          errorClassName={errorClassName}
          helperText={helperText}
          transformOnChange={transformOnChange}
        />
      )}
    />
  )
}
