import { useEffect, useRef, useState } from 'react'

export interface UseMirroredFieldOptions {
  /** Value owned by the form (React Hook Form field value) */
  value: string | undefined
  /** Push a value into the form */
  onChange: (value: string) => void
  onBlur?: () => void
  /** Normalise the raw text before it is stored (e.g. strip non-digits) */
  transform?: (value: string) => string
}

export interface MirroredField {
  value: string
  onChangeText: (text: string) => void
  onBlur: () => void
}

/**
 * Keeps a TextInput's `value` prop equal to the text the native input just
 * reported, then pushes the same value into the form in the same event.
 *
 * Why: a fully controlled TextInput round-trips every keystroke through the
 * form (plus an async Zod resolver), so the value prop lands back a few frames
 * late. When it differs from the native text, RN rewrites the whole native
 * string — which cancels the OS `secureTextEntry` dot animation and re-lays out
 * the text, the jank users feel while typing.
 *
 * The push is synchronous (no debounce) so autofill from a password manager is
 * in the form the instant the user taps the submit button.
 */
export function useMirroredField({
  value,
  onChange,
  onBlur,
  transform,
}: UseMirroredFieldOptions): MirroredField {
  const [localValue, setLocalValue] = useState(value ?? '')
  // Last value handed to the form. The `value` prop echoes it back on the same
  // commit; without tracking it we'd mistake that echo for an external reset.
  const lastPushedRef = useRef<string>(value ?? '')

  // Sync when value changes externally (e.g. form reset)
  useEffect(() => {
    const next = value ?? ''
    if (next === lastPushedRef.current) return // echo of our own push
    lastPushedRef.current = next
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalValue(next)
  }, [value])

  const onChangeText = (text: string) => {
    const next = transform ? transform(text) : text

    // Set lastPushedRef before onChange: onChange re-renders synchronously.
    setLocalValue(next)
    lastPushedRef.current = next
    onChange(next)
  }

  const handleBlur = () => {
    onBlur?.()
  }

  return { value: localValue, onChangeText, onBlur: handleBlur }
}
