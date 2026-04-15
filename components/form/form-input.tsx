import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form'
import { Text, TextInput, View } from 'react-native'
import { useRef, useEffect, useState } from 'react'

import { Input } from '@/components/ui'
import { cn } from '@/lib/utils'

interface FormInputProps<T extends FieldValues> {
  control: Control<T>
  name: Path<T>
  label?: string
  required?: boolean
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?: 'off' | 'email' | 'tel' | 'password' | 'name' | 'username' | undefined
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
  placeholder?: string
  keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoComplete?: 'off' | 'email' | 'tel' | 'password' | 'name' | 'username' | undefined
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
  const [localValue, setLocalValue] = useState(value ?? '')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevValueRef = useRef<string | undefined>(value)

  // Sync when value changes externally (e.g. form reset)
  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalValue(value ?? '')
    }
  }, [value])

  const handleChangeText = (text: string) => {
    const transformedValue = transformOnChange ? transformOnChange(text) : text

    // Update local state immediately for UI responsiveness
    setLocalValue(transformedValue)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce validation by 300ms
    debounceTimerRef.current = setTimeout(() => {
      onChange(transformedValue)
    }, 300)
  }

  // Flush pending value on blur so form always has latest value
  const handleBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    onChange(localValue)
    onBlur()
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const showError = !!error
  const showHelper = !!helperText && !showError

  return (
    <View className={cn('mb-4', containerClassName)}>
      {label && (
        <Text
          className={cn(
            'mb-1 text-xs text-muted-foreground',
            labelClassName
          )}
        >
          {label}
          {required && <Text className="text-red-500"> *</Text>}
        </Text>
      )}
      {useTextInput ? (
        <TextInput
          className={cn(
            'bg-card text-foreground rounded-lg px-4 py-3 text-base border font-sans',
            showError ? 'border-destructive' : 'border-border',
            disabled && 'opacity-50',
            className
          )}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={localValue}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
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
            'mt-1 text-xs text-red-500',
            errorClassName
          )}
        >
          {error}
        </Text>
      )}

      {showHelper && (
        <Text className="mt-1 text-xs text-muted-foreground">
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
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <FormInputField
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          error={error?.message}
          label={label}
          required={required}
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
