# Login Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng lại màn đăng nhập theo spec `docs/superpowers/specs/2026-07-29-login-screen-redesign-design.md` — thêm nhận diện thương hiệu, sửa bố cục và cụm link, thêm phản hồi lỗi bằng animation + haptic, hỗ trợ trình quản lý mật khẩu.

**Architecture:** Tách `LoginForm` xuống còn thuần form (2 ô nhập + link quên mật khẩu + nút submit); phần chrome (nút thoát, logo, tiêu đề, footer) chuyển lên `app/auth/login.tsx` và `login-sheet-portal.tsx` tự lo phần của mình. Bỏ debounce trong `useMirroredField` để autofill hoạt động đúng. Animation lắc dùng Reanimated trên UI thread với preset trong `constants/motion.ts`.

**Tech Stack:** React Native 0.8x + Expo 54, expo-router, React Hook Form + Zod, Reanimated 4.1, NativeWind 4.2, expo-haptics 15, expo-image, jest + @testing-library/react-native 13.3.3.

## Global Constraints

- TypeScript strict. Không semicolon, nháy đơn, trailing comma, print width 80.
- React 19 — không cần `import React`.
- NativeWind `className`, không dùng `StyleSheet` cho style tĩnh.
- Không hardcode `damping`/`stiffness`/`duration` tại chỗ dùng — mọi thông số animation phải nằm trong `constants/motion.ts` (quy ước `CLAUDE.md`).
- Animation chạy bằng `react-native-reanimated`, không dùng `Animated` của react-native.
- Zustand selector phải chọn lát cắt cụ thể, không spread cả store.
- Hook `stop-typecheck` tự chạy `npm run typecheck` sau mỗi lượt sửa file TS.
- Hook `pre-bash-commit-quality` chặn commit nếu file TS/JS staged còn `console.log`.
- Hook `pre-bash-block-no-verify` chặn `--no-verify`.
- Màu lỗi dùng token `border-destructive`, không dùng `red-500` hardcode.
- Chạy test bằng `npx jest <path>`. Toàn bộ suite: `npx jest`.

### Sai lệch có chủ ý so với spec

Spec ghi khoảng cách 9px và 22px. Plan này làm tròn về lưới Tailwind: **9 → `mt-2` (8px)**, **22 → `mt-6` (24px)**. Lệch 1–2px, không nhìn ra được, đổi lại không phải chèn `style` inline phá quy ước className.

---

## Cấu trúc file

| File | Trách nhiệm | Thao tác |
|---|---|---|
| `hooks/use-mirrored-field.ts` | Mirror text native ↔ form, chống tiếng vọng | Sửa — bỏ debounce |
| `constants/motion.ts` | Preset animation dùng chung | Sửa — thêm `SHAKE` |
| `components/form/form-input.tsx` | Ô nhập gắn React Hook Form | Sửa — viền đỏ theo `invalid`, props autofill |
| `components/input/password-input-field.tsx` | Ô mật khẩu + nút ẩn/hiện | Sửa — haptic, autofill, `autoCorrect`/`spellCheck` |
| `components/auth/login-form.tsx` | Thuần form đăng nhập + lắc báo lỗi | Sửa — bỏ chrome, dời link, thêm lắc |
| `app/auth/login.tsx` | Khung màn: X, logo, tiêu đề, footer | Sửa — dựng lại |
| `components/auth/login-sheet-portal.tsx` | Bù tiêu đề + footer cho bottom sheet | Sửa |
| `i18n/vi/auth.json`, `i18n/en/auth.json` | Chuỗi dịch | Sửa — thêm `login.registerNow` |
| `__tests__/hooks/use-mirrored-field.test.tsx` | Test hook | Tạo |
| `__tests__/components/auth/login-form.test.tsx` | Test lắc + trạng thái lỗi | Tạo |
| `__tests__/screens/login-screen.test.tsx` | Test nút X | Tạo |
| `__tests__/components/form/form-input.test.tsx` | Test hiện có | Sửa |
| `__tests__/components/input/password-input-field.test.tsx` | Test hiện có | Sửa |

---

### Task 1: Bỏ debounce trong useMirroredField

Autofill bơm text vào cả 2 ô rồi người dùng bấm Đăng nhập ngay — với debounce 300ms giá trị chưa kịp vào form nên submit rỗng. Bỏ debounce thì không còn khoảng lệch.

**Files:**
- Modify: `hooks/use-mirrored-field.ts`
- Create: `__tests__/hooks/use-mirrored-field.test.tsx`
- Modify: `__tests__/components/form/form-input.test.tsx`
- Modify: `__tests__/components/input/password-input-field.test.tsx`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces: `useMirroredField({ value, onChange, onBlur?, transform? }) => { value: string, onChangeText: (text: string) => void, onBlur: () => void }`. Tham số `delay` **bị xoá** — mọi nơi truyền `delay` sẽ lỗi biên dịch.

- [ ] **Step 1: Viết test thất bại cho hook**

Tạo `__tests__/hooks/use-mirrored-field.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react-native'

import { useMirroredField } from '@/hooks/use-mirrored-field'

describe('useMirroredField', () => {
  it('đẩy giá trị vào form ngay, không chờ debounce', () => {
    const onChange = jest.fn()
    const { result } = renderHook(
      ({ value }) => useMirroredField({ value, onChange }),
      { initialProps: { value: '' } },
    )

    act(() => result.current.onChangeText('0901234567'))

    expect(onChange).toHaveBeenCalledWith('0901234567')
    expect(result.current.value).toBe('0901234567')
  })

  it('bỏ qua tiếng vọng của chính lần đẩy vừa rồi', () => {
    const onChange = jest.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useMirroredField({ value, onChange }),
      { initialProps: { value: '' } },
    )

    act(() => result.current.onChangeText('090'))
    rerender({ value: '090' })

    expect(result.current.value).toBe('090')
  })

  it('đồng bộ khi form đổi giá trị từ bên ngoài', () => {
    const onChange = jest.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useMirroredField({ value, onChange }),
      { initialProps: { value: '' } },
    )

    act(() => result.current.onChangeText('0901'))
    rerender({ value: '' })

    expect(result.current.value).toBe('')
  })

  it('áp dụng transform trước khi đẩy vào form', () => {
    const onChange = jest.fn()
    const { result } = renderHook(() =>
      useMirroredField({
        value: '',
        onChange,
        transform: (v) => v.replace(/\D/g, ''),
      }),
    )

    act(() => result.current.onChangeText('090 123 4567'))

    expect(onChange).toHaveBeenCalledWith('0901234567')
    expect(result.current.value).toBe('0901234567')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx jest __tests__/hooks/use-mirrored-field.test.tsx`
Expected: FAIL ở test đầu — `onChange` chưa được gọi vì còn debounce 300ms.

- [ ] **Step 3: Viết lại hook, bỏ debounce**

Thay toàn bộ nội dung `hooks/use-mirrored-field.ts`:

```ts
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
```

- [ ] **Step 4: Chạy test hook, xác nhận pass**

Run: `npx jest __tests__/hooks/use-mirrored-field.test.tsx`
Expected: PASS 4/4

- [ ] **Step 5: Sửa test FormInput hiện có**

Trong `__tests__/components/form/form-input.test.tsx`, xoá `beforeEach`/`afterEach` fake timers và thay test interleave. Test cũ mô phỏng phím rơi vào giữa lúc timer debounce bắn — kịch bản đó không còn tồn tại vì việc đẩy vào form nay nằm cùng một native event với `setLocalValue`, React gộp chung một commit.

Thay khối `describe` bằng:

```tsx
describe('FormInput', () => {
  it('đưa giá trị vào form ngay khi gõ', async () => {
    const { getByPlaceholderText } = render(<Harness />)
    const input = getByPlaceholderText('phone')

    await act(async () => {
      input.props.onChangeText('0')
      input.props.onChangeText('09')
      input.props.onChangeText('090')
    })

    expect(getByPlaceholderText('phone').props.value).toBe('090')
  })

  it('vẫn đồng bộ khi form bị reset từ bên ngoài', async () => {
    const { getByPlaceholderText, getByTestId } = render(<Harness />)
    const input = getByPlaceholderText('phone')

    await act(async () => {
      input.props.onChangeText('0901')
    })
    expect(input.props.value).toBe('0901')

    await act(async () => {
      fireEvent.press(getByTestId('reset'))
    })

    expect(getByPlaceholderText('phone').props.value).toBe('')
  })
})
```

- [ ] **Step 6: Sửa test PasswordInputField hiện có**

Trong `__tests__/components/input/password-input-field.test.tsx`, xoá fake timers và bỏ mọi `jest.advanceTimersByTime`. Thay 3 test bằng:

```tsx
describe('PasswordInputField', () => {
  it('không ghi đè text native khi gõ', async () => {
    const { getByPlaceholderText } = render(<Harness />)
    const input = getByPlaceholderText('password')

    const typed = ['a', 'ab', 'abc', 'abc1', 'abc12', 'abc123']
    for (const text of typed) {
      await act(async () => {
        input.props.onChangeText(text)
      })
      expect(getByPlaceholderText('password').props.value).toBe(text)
    }
  })

  it('đưa chuỗi autofill vào form ngay lập tức', async () => {
    const onChange = jest.fn()
    const { getByPlaceholderText } = render(
      <PasswordInputField
        value=""
        onChange={onChange}
        placeholder="password"
      />,
    )

    await act(async () => {
      getByPlaceholderText('password').props.onChangeText('secret123')
    })

    expect(onChange).toHaveBeenCalledWith('secret123')
  })

  it('chuyển tiếp onBlur ra ngoài', async () => {
    const onBlur = jest.fn()
    const { getByPlaceholderText } = render(
      <PasswordInputField
        value=""
        onChange={jest.fn()}
        onBlur={onBlur}
        placeholder="password"
      />,
    )

    await act(async () => {
      getByPlaceholderText('password').props.onBlur()
    })

    expect(onBlur).toHaveBeenCalled()
  })
})
```

- [ ] **Step 7: Chạy toàn bộ suite**

Run: `npx jest`
Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add hooks/use-mirrored-field.ts hooks/index.ts components/form/form-input.tsx \
  components/input/password-input-field.tsx components/input/password-rules-input.tsx \
  __tests__/hooks/use-mirrored-field.test.tsx \
  __tests__/components/form/form-input.test.tsx \
  __tests__/components/input/password-input-field.test.tsx
git commit -m "fix(input): mirror native text without debounce

Debounce 300ms làm autofill từ trình quản lý mật khẩu chưa kịp vào form
khi người dùng bấm submit ngay. Lớp chống tiếng vọng (lastPushedRef) giữ
nguyên vì đó mới là thứ chống mất ký tự và chống giật, độc lập với debounce."
```

Lưu ý: commit này kéo theo cả phần `useMirroredField` đang nằm trong working tree chưa commit (hook mới tách ra từ `FormInput`, cùng 2 file test). Đó là chủ ý — chúng chưa từng được commit.

---

### Task 2: FormInput — viền đỏ theo invalid + props autofill

Màn login cần viền đỏ **không kèm chữ lỗi** (chữ lỗi làm đổi chiều cao, phá yêu cầu chống nhảy layout). Hiện `FormInput` quyết định viền bằng `!!error?.message` nên `setError` với message rỗng sẽ không đổi viền.

**Files:**
- Modify: `components/form/form-input.tsx`
- Modify: `__tests__/components/form/form-input.test.tsx`

**Interfaces:**
- Consumes: `useMirroredField` từ Task 1
- Produces: `FormInput` nhận thêm `textContentType?: TextInputProps['textContentType']` và `importantForAutofill?: TextInputProps['importantForAutofill']`; viền đỏ bật theo `fieldState.invalid`, chữ lỗi chỉ hiện khi `error.message` khác rỗng.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `__tests__/components/form/form-input.test.tsx`. Trước hết sửa `Harness` để lộ nút set lỗi rỗng — thay khối `Harness` hiện có:

```tsx
function Harness() {
  const { control, reset, setError } = useZodForm(schema, {
    defaultValues: { phonenumber: '' },
  })

  return (
    <View>
      <FormInput
        control={control}
        name="phonenumber"
        placeholder="phone"
        keyboardType="number-pad"
        useTextInput
        transformOnChange={(v) => v.replace(/\D/g, '')}
      />
      <Pressable testID="reset" onPress={() => reset({ phonenumber: '' })} />
      <Pressable
        testID="set-empty-error"
        onPress={() => setError('phonenumber', { type: 'server', message: '' })}
      />
    </View>
  )
}
```

Thêm test:

```tsx
  it('bật viền destructive khi field invalid dù không có chữ lỗi', async () => {
    const { getByPlaceholderText, getByTestId, queryByText } = render(
      <Harness />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('set-empty-error'))
    })

    const input = getByPlaceholderText('phone')
    expect(input.props.className).toContain('border-destructive')
    expect(queryByText('')).toBeNull()
  })
```

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx jest __tests__/components/form/form-input.test.tsx -t "viền destructive"`
Expected: FAIL — className vẫn là `border-gray-200 dark:border-[#2e2e2e]`.

- [ ] **Step 3: Sửa FormInput**

Trong `components/form/form-input.tsx`:

Thêm import type:

```ts
import type { TextInputProps } from 'react-native'
```

Thêm vào cả `FormInputProps<T>` và `FormInputFieldProps`:

```ts
  textContentType?: TextInputProps['textContentType']
  importantForAutofill?: TextInputProps['importantForAutofill']
```

Riêng `FormInputFieldProps` thêm:

```ts
  invalid?: boolean
```

Trong `FormInputField`, nhận thêm 3 tham số `invalid`, `textContentType`, `importantForAutofill`, rồi thay 2 dòng quyết định hiển thị:

```ts
  const showError = invalid ?? !!error
  const showMessage = !!error
  const showHelper = !!helperText && !showError
```

Đổi class viền lỗi từ `red-500` sang token:

```ts
            showError
              ? 'border-destructive dark:border-destructive'
              : 'border-gray-200 dark:border-[#2e2e2e]',
```

Truyền props mới xuống `TextInput`:

```tsx
          textContentType={textContentType}
          importantForAutofill={importantForAutofill}
```

Đổi điều kiện render chữ lỗi từ `showError` sang `showMessage`:

```tsx
      {showMessage && (
        <Text
          className={cn(
            'mt-1 text-xs text-red-500 dark:text-red-400',
            errorClassName,
          )}
        >
          {error}
        </Text>
      )}
```

Trong `FormInput`, lấy thêm `invalid` từ `fieldState` và truyền xuống cùng 2 prop mới:

```tsx
      render={({
        field: { value, onChange, onBlur },
        fieldState: { error, invalid },
      }) => (
        <FormInputField
          ...
          invalid={invalid}
          textContentType={textContentType}
          importantForAutofill={importantForAutofill}
        />
      )}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx jest __tests__/components/form/form-input.test.tsx`
Expected: PASS toàn bộ file.

- [ ] **Step 5: Commit**

```bash
git add components/form/form-input.tsx __tests__/components/form/form-input.test.tsx
git commit -m "feat(form): viền lỗi theo fieldState.invalid, thêm props autofill

Màn login cần viền đỏ không kèm chữ lỗi để chiều cao không đổi khi bàn phím
mở. Đổi luôn red-500 sang token destructive."
```

---

### Task 3: PasswordInputField — haptic, autofill, tắt sửa từ

**Files:**
- Modify: `components/input/password-input-field.tsx`
- Modify: `__tests__/components/input/password-input-field.test.tsx`

**Interfaces:**
- Consumes: `useMirroredField` từ Task 1
- Produces: nút ẩn/hiện có `testID="password-visibility-toggle"` và phát haptic light mỗi lần bấm.

- [ ] **Step 1: Viết test thất bại**

Thêm mock haptics lên đầu `__tests__/components/input/password-input-field.test.tsx`, đặt **trước** các import:

```tsx
const mockImpactAsync = jest.fn(() => Promise.resolve())
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))
```

Thêm test:

```tsx
  it('phát haptic light khi bấm nút ẩn/hiện mật khẩu', async () => {
    const { getByTestId } = render(
      <PasswordInputField
        value=""
        onChange={jest.fn()}
        placeholder="password"
      />,
    )

    await act(async () => {
      fireEvent.press(getByTestId('password-visibility-toggle'))
    })

    expect(mockImpactAsync).toHaveBeenCalledWith('light')
  })

  it('khai báo thuộc tính autofill cho trình quản lý mật khẩu', () => {
    const { getByPlaceholderText } = render(
      <PasswordInputField
        value=""
        onChange={jest.fn()}
        placeholder="password"
      />,
    )
    const input = getByPlaceholderText('password')

    expect(input.props.textContentType).toBe('password')
    expect(input.props.autoComplete).toBe('password')
    expect(input.props.importantForAutofill).toBe('yes')
    expect(input.props.autoCorrect).toBe(false)
    expect(input.props.spellCheck).toBe(false)
  })
```

Thêm `fireEvent` vào import từ `@testing-library/react-native`.

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx jest __tests__/components/input/password-input-field.test.tsx`
Expected: FAIL — không tìm thấy testID, và các prop autofill là `undefined`.

- [ ] **Step 3: Sửa PasswordInputField**

Thêm import:

```ts
import * as Haptics from 'expo-haptics'
```

Thêm handler bên trong component, ngay sau `const field = useMirroredField(...)`:

```ts
  const handleToggleVisibility = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setShowPassword((v) => !v)
  }
```

Thêm props vào `TextInput`, ngay dưới `autoCapitalize="none"`:

```tsx
          autoCorrect={false}
          spellCheck={false}
          textContentType="password"
          autoComplete="password"
          importantForAutofill="yes"
```

Sửa `TouchableOpacity` của nút mắt:

```tsx
        <TouchableOpacity
          testID="password-visibility-toggle"
          className="absolute bottom-0 right-3 top-0 justify-center"
          onPress={handleToggleVisibility}
          disabled={disabled}
          hitSlop={8}
        >
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `npx jest __tests__/components/input/password-input-field.test.tsx`
Expected: PASS toàn bộ file.

- [ ] **Step 5: Commit**

```bash
git add components/input/password-input-field.tsx \
  __tests__/components/input/password-input-field.test.tsx
git commit -m "feat(input): haptic + autofill cho ô mật khẩu

Light impact khi bấm ẩn/hiện. Khai textContentType/autoComplete để iCloud
Keychain và Google Password Manager nhận diện. Bổ sung autoCorrect và
spellCheck vốn đang thiếu so với FormInput."
```

---

### Task 4: LoginForm — thu hẹp còn thuần form, dời link quên mật khẩu

**Files:**
- Modify: `components/auth/login-form.tsx`

**Interfaces:**
- Consumes: `FormInput` (Task 2), `PasswordInputField` (Task 3)
- Produces: `LoginForm` chỉ render 2 ô nhập + link "Quên mật khẩu" + nút submit. Props giữ nguyên: `{ onLoginSuccess?: () => void, onBeforeNavigate?: () => void }`. **Không còn** tiêu đề, mô tả, link đăng ký, link về trang chủ — nơi gọi phải tự render.

Task này cố tình làm màn login và bottom sheet **tạm thời thiếu tiêu đề/footer**. Task 6 và 7 bù lại. Đây là ranh giới hợp lý: reviewer có thể duyệt riêng phần thu hẹp form mà chưa cần thấy chrome mới.

- [ ] **Step 1: Viết lại LoginForm**

Thay toàn bộ nội dung `components/auth/login-form.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Controller } from 'react-hook-form'
import { ActivityIndicator, TouchableOpacity, View } from 'react-native'

import { FormInput } from '@/components/form/form-input'
import { PasswordInputField } from '@/components/input'
import { Text } from '@/components/ui/text'
import { ROUTE } from '@/constants'
import { useLogin, usePostAuthActions, useZodForm } from '@/hooks'
import { navigateNative } from '@/lib/navigation'
import { loginSchema, TLoginSchema } from '@/schemas'
import type { ILoginResponse } from '@/types'
import { showErrorToastMessage } from '@/utils'

interface LoginFormProps {
  onLoginSuccess?: () => void
  onBeforeNavigate?: () => void
}

export default function LoginForm({
  onLoginSuccess,
  onBeforeNavigate,
}: LoginFormProps) {
  const { t } = useTranslation('auth')

  const {
    control,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useZodForm(loginSchema, {
    defaultValues: { phonenumber: '', password: '' },
  })

  const { mutate: loginMutation, isPending } = useLogin()
  const { handleAuthSuccess } = usePostAuthActions()

  const onSubmit = (data: TLoginSchema) => {
    loginMutation(
      { phonenumber: data.phonenumber, password: data.password },
      {
        onSuccess: async (response: ILoginResponse) => {
          try {
            await handleAuthSuccess(response.result, onLoginSuccess)
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Unknown error'
            showErrorToastMessage(message)
          }
        },
        onError: () => {
          // Global error handler (QueryCache) sẽ show toast
        },
      },
    )
  }

  const isLoading = isPending || isSubmitting

  return (
    <View>
      <FormInput
        control={control}
        name="phonenumber"
        label={t('login.phoneNumber')}
        placeholder={t('login.enterPhoneNumber')}
        keyboardType="number-pad"
        autoCapitalize="none"
        autoComplete="tel"
        textContentType="username"
        importantForAutofill="yes"
        disabled={isLoading}
        useTextInput
        transformOnChange={(v) => v.replace(/\D/g, '')}
        labelClassName="text-md font-sans-medium text-gray-500 dark:text-gray-400"
        containerClassName="mb-4"
      />

      <View>
        <Text className="mb-1 text-md font-sans-medium text-gray-500 dark:text-gray-400">
          {t('login.password')}
        </Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <PasswordInputField
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={t('login.enterPassword')}
              disabled={isLoading}
              error={errors.password?.message}
            />
          )}
        />
      </View>

      <TouchableOpacity
        className="mt-2 self-start"
        onPress={() => {
          onBeforeNavigate?.()
          navigateNative.push(ROUTE.FORGOT_PASSWORD)
        }}
        disabled={isLoading}
        hitSlop={8}
      >
        <Text className="font-sans-semibold text-sm text-primary">
          {t('login.forgotPassword')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-6 items-center justify-center rounded-lg bg-primary py-4"
        onPress={handleSubmit(onSubmit)}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="font-sans-semibold text-base text-white">
            {t('login.login')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}
```

Ba thay đổi so với bản cũ: link "Quên mật khẩu" rời khỏi hàng label xuống dưới ô mật khẩu và căn trái (`self-start`); màu đổi từ `amber-500` hardcode sang token `text-primary`; toàn bộ tiêu đề/mô tả/link đăng ký/link về trang chủ bị xoá.

- [ ] **Step 2: Chạy typecheck**

Run: `npm run typecheck`
Expected: PASS. Nếu báo lỗi thiếu `textContentType` trên `FormInput` nghĩa là Task 2 chưa xong.

- [ ] **Step 3: Chạy toàn bộ suite**

Run: `npx jest`
Expected: PASS — chưa có test nào phụ thuộc phần bị xoá.

- [ ] **Step 4: Commit**

```bash
git add components/auth/login-form.tsx
git commit -m "refactor(auth): LoginForm còn thuần form

Tiêu đề, link đăng ký và link về trang chủ chuyển sang nơi gọi, vì LoginForm
được render ở cả full screen lẫn bottom sheet 90% với nhu cầu chrome khác
nhau. Link quên mật khẩu xuống dưới ô mật khẩu, căn trái, dùng token primary."
```

---

### Task 5: Lắc + viền đỏ + haptic khi sai thông tin

**Files:**
- Modify: `constants/motion.ts`
- Modify: `components/auth/login-form.tsx`
- Create: `__tests__/components/auth/login-form.test.tsx`

**Interfaces:**
- Consumes: `LoginForm` từ Task 4, `FormInput` invalid từ Task 2
- Produces: `SHAKE` export từ `constants/motion.ts` với shape `{ offset: number, segmentMs: number }`.

- [ ] **Step 1: Viết test thất bại**

Tạo `__tests__/components/auth/login-form.test.tsx`:

```tsx
const mockImpactAsync = jest.fn(() => Promise.resolve())
jest.mock('expo-haptics', () => ({
  impactAsync: (...args: unknown[]) => mockImpactAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

const mockMutate = jest.fn()
jest.mock('@/hooks', () => ({
  useLogin: () => ({ mutate: mockMutate, isPending: false }),
  usePostAuthActions: () => ({ handleAuthSuccess: jest.fn() }),
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-member-access
  useZodForm: require('@/hooks/use-zod-form').useZodForm,
}))

jest.mock('@/lib/navigation', () => ({
  navigateNative: { push: jest.fn(), replace: jest.fn() },
}))

jest.mock('@/utils', () => ({ showErrorToastMessage: jest.fn() }))

import { act, fireEvent, render } from '@testing-library/react-native'

import LoginForm from '@/components/auth/login-form'

describe('LoginForm — sai thông tin đăng nhập', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    mockImpactAsync.mockReset()
  })

  const fillAndSubmit = async (utils: ReturnType<typeof render>) => {
    await act(async () => {
      utils.getByPlaceholderText('login.enterPhoneNumber').props.onChangeText(
        '0901234567',
      )
      utils.getByPlaceholderText('login.enterPassword').props.onChangeText(
        'wrongpass1',
      )
    })
    await act(async () => {
      fireEvent.press(utils.getByText('login.login'))
    })
  }

  it('bật viền đỏ cả 2 ô và phát haptic khi server báo lỗi', async () => {
    mockMutate.mockImplementation(
      (_vars: unknown, opts: { onError: () => void }) => opts.onError(),
    )
    const utils = render(<LoginForm />)

    await fillAndSubmit(utils)

    expect(
      utils.getByPlaceholderText('login.enterPhoneNumber').props.className,
    ).toContain('border-destructive')
    expect(
      utils.getByPlaceholderText('login.enterPassword').props.className,
    ).toContain('border-destructive')
    expect(mockImpactAsync).toHaveBeenCalledWith('light')
  })

  it('xoá viền đỏ khi người dùng sửa lại ô', async () => {
    mockMutate.mockImplementation(
      (_vars: unknown, opts: { onError: () => void }) => opts.onError(),
    )
    const utils = render(<LoginForm />)
    await fillAndSubmit(utils)

    await act(async () => {
      utils.getByPlaceholderText('login.enterPhoneNumber').props.onChangeText(
        '0901234568',
      )
    })

    expect(
      utils.getByPlaceholderText('login.enterPhoneNumber').props.className,
    ).not.toContain('border-destructive')
  })
})
```

Ghi chú: `react-i18next` trong môi trường test trả về chính key, nên `t('login.login')` cho ra chuỗi `"login.login"` — đó là lý do query bằng key.

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npx jest __tests__/components/auth/login-form.test.tsx`
Expected: FAIL — chưa có `setError` nên className không chứa `border-destructive`.

- [ ] **Step 3: Thêm preset SHAKE**

Thêm vào cuối `constants/motion.ts`, ngay sau `TIMING_CONFIGS`:

```ts
/**
 * SHAKE — lắc ngang báo lỗi cho khối input.
 * 4 nhịp biên độ giảm dần rồi về 0. Dùng với withSequence + withTiming.
 */
export const SHAKE = {
  /** Biên độ nhịp đầu (px). Nhịp 3–4 dùng một nửa. */
  offset: 8,
  /** Thời lượng mỗi nhịp (ms). */
  segmentMs: 50,
} as const
```

- [ ] **Step 4: Thêm lắc + trạng thái lỗi vào LoginForm**

Trong `components/auth/login-form.tsx`, thêm import:

```ts
import * as Haptics from 'expo-haptics'
import { useCallback } from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { SHAKE } from '@/constants/motion'
```

Lấy thêm `setError` từ `useZodForm`:

```ts
  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useZodForm(loginSchema, {
    defaultValues: { phonenumber: '', password: '' },
  })
```

Thêm shared value + handler, đặt ngay trên `onSubmit`:

```ts
  const shakeX = useSharedValue(0)
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }))

  const triggerErrorFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    setError('phonenumber', { type: 'server', message: '' })
    setError('password', { type: 'server', message: '' })
    shakeX.value = withSequence(
      withTiming(-SHAKE.offset, { duration: SHAKE.segmentMs }),
      withTiming(SHAKE.offset, { duration: SHAKE.segmentMs }),
      withTiming(-SHAKE.offset / 2, { duration: SHAKE.segmentMs }),
      withTiming(SHAKE.offset / 2, { duration: SHAKE.segmentMs }),
      withTiming(0, { duration: SHAKE.segmentMs }),
    )
  }, [setError, shakeX])
```

Đổi `onError` trong `loginMutation`:

```ts
        onError: () => {
          // Toast do global error handler (QueryCache) đảm nhiệm.
          // Ở đây chỉ lo phản hồi tại chỗ: viền đỏ + lắc + haptic.
          triggerErrorFeedback()
        },
```

Bọc 2 ô nhập trong `Animated.View`. Khối lắc gồm ô SĐT và cả nhãn + ô mật khẩu; link "Quên mật khẩu" và nút submit nằm ngoài:

```tsx
      <Animated.View style={shakeStyle}>
        <FormInput
          control={control}
          name="phonenumber"
          label={t('login.phoneNumber')}
          placeholder={t('login.enterPhoneNumber')}
          keyboardType="number-pad"
          autoCapitalize="none"
          autoComplete="tel"
          textContentType="username"
          importantForAutofill="yes"
          disabled={isLoading}
          useTextInput
          transformOnChange={(v) => v.replace(/\D/g, '')}
          labelClassName="text-md font-sans-medium text-gray-500 dark:text-gray-400"
          containerClassName="mb-4"
        />

        <View>
          <Text className="mb-1 text-md font-sans-medium text-gray-500 dark:text-gray-400">
            {t('login.password')}
          </Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <PasswordInputField
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={t('login.enterPassword')}
                disabled={isLoading}
                error={errors.password?.message}
              />
            )}
          />
        </View>
      </Animated.View>
```

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx jest __tests__/components/auth/login-form.test.tsx`
Expected: PASS 2/2

- [ ] **Step 6: Chạy toàn bộ suite + typecheck**

Run: `npx jest && npm run typecheck`
Expected: PASS cả hai.

- [ ] **Step 7: Commit**

```bash
git add constants/motion.ts components/auth/login-form.tsx \
  __tests__/components/auth/login-form.test.tsx
git commit -m "feat(auth): lắc + viền đỏ + haptic khi đăng nhập sai

Hai ô lắc chung một Animated.View để đọc ra như một khối báo lỗi có chủ ý.
Không render chữ lỗi dưới ô vì sẽ đổi chiều cao khi bàn phím đang mở."
```

---

### Task 6: Dựng lại màn đăng nhập

**Files:**
- Modify: `app/auth/login.tsx`
- Modify: `i18n/vi/auth.json`, `i18n/en/auth.json`
- Create: `__tests__/screens/login-screen.test.tsx`

**Interfaces:**
- Consumes: `LoginForm` từ Task 4/5
- Produces: màn login có `testID="login-close"` cho nút X.

- [ ] **Step 1: Thêm chuỗi dịch**

Trong `i18n/vi/auth.json`, khối `login`, thêm sau `"register"`:

```json
    "registerNow": "Đăng ký ngay",
```

Trong `i18n/en/auth.json`, khối `login`, thêm sau `"register"`:

```json
    "registerNow": "Register now",
```

- [ ] **Step 2: Viết test thất bại cho nút X**

Tạo `__tests__/screens/login-screen.test.tsx`:

```tsx
const mockCanGoBack = jest.fn()
const mockBack = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: mockCanGoBack,
    back: mockBack,
    replace: mockReplace,
  }),
  Redirect: () => null,
}))

jest.mock('@/components/auth', () => ({ LoginForm: () => null }))
jest.mock('expo-image', () => ({ Image: () => null }))
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ getQueryData: () => undefined }),
}))
jest.mock('@/lib/navigation', () => ({
  navigateWhenUnlocked: { replace: jest.fn() },
}))
jest.mock('@/lib/navigation/master-transition-provider', () => ({
  useMasterTransitionOptional: () => null,
}))
jest.mock('@/stores', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ isAuthenticated: () => false, _hasHydrated: true }),
}))

import { fireEvent, render } from '@testing-library/react-native'

import LoginScreen from '@/app/auth/login'

describe('LoginScreen — nút thoát', () => {
  beforeEach(() => {
    mockCanGoBack.mockReset()
    mockBack.mockReset()
    mockReplace.mockReset()
  })

  it('quay lại khi còn back stack', () => {
    mockCanGoBack.mockReturnValue(true)
    const { getByTestId } = render(<LoginScreen />)

    fireEvent.press(getByTestId('login-close'))

    expect(mockBack).toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('về trang chủ khi không có back stack', () => {
    mockCanGoBack.mockReturnValue(false)
    const { getByTestId } = render(<LoginScreen />)

    fireEvent.press(getByTestId('login-close'))

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home')
    expect(mockBack).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận thất bại**

Run: `npx jest __tests__/screens/login-screen.test.tsx`
Expected: FAIL — không tìm thấy `testID="login-close"`.

- [ ] **Step 4: Viết lại màn login**

Thay toàn bộ nội dung `app/auth/login.tsx`:

```tsx
import { Images } from '@/assets/images'
import { useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import { Redirect, useRouter } from 'expo-router'
import { X } from 'lucide-react-native'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'

import { LoginForm } from '@/components/auth'
import { ScreenContainer } from '@/components/layout'
import { Text } from '@/components/ui/text'
import { BannerPage, colors } from '@/constants'
import { navigateWhenUnlocked } from '@/lib/navigation'
import { useMasterTransitionOptional } from '@/lib/navigation/master-transition-provider'
import { useAuthStore } from '@/stores'

const LOGO_WIDTH = 120
const LOGO_HEIGHT = 32

export default function LoginScreen() {
  const { t } = useTranslation('auth')
  const isDark = useColorScheme() === 'dark'
  const bgColor = isDark ? colors.background.dark : '#ffffff'
  const iconColor = isDark ? colors.gray[200] : colors.gray[700]
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated())
  const hasHydrated = useAuthStore((state) => state._hasHydrated)
  const masterTransition = useMasterTransitionOptional()
  const queryClient = useQueryClient()
  const router = useRouter()

  const handleLoginSuccess = useCallback(() => {
    const homeCached = !!queryClient.getQueryData(['banners', BannerPage.HOME])
    const overlayMs = homeCached ? 100 : 250
    masterTransition?.showLoadingFor(overlayMs)
    // navigateWhenUnlocked: retry nếu navigation lock đang active (vd: bottom sheet
    // đang đóng khi user tap Login) thay vì silent drop như navigateNative.replace.
    navigateWhenUnlocked.replace('/(tabs)/home')
  }, [masterTransition, queryClient])

  // Login mở bằng cả push (gift-card, product detail, order detail) lẫn replace
  // (onboarding, register, forgot-password). Nút back thuần sẽ chết ở nhóm sau,
  // nên nút này luôn có đường thoát: back nếu có stack, không thì về trang chủ.
  const handleClose = useCallback(() => {
    if (router.canGoBack()) router.back()
    else router.replace('/(tabs)/home')
  }, [router])

  const handleRegister = useCallback(() => {
    router.replace('/auth/register')
  }, [router])

  if (!hasHydrated) {
    return null // render nothing while store hydrates (50–200ms)
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/home" />
  }

  return (
    <ScreenContainer
      edges={['top', 'bottom']}
      className="flex-1"
      style={{ backgroundColor: bgColor }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        // Android đã ở adjustResize mặc định của Expo — dùng thêm
        // behavior="height" sẽ xử lý hai lần và gây giật layout.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={{ backgroundColor: bgColor }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 px-6">
            <TouchableOpacity
              testID="login-close"
              onPress={handleClose}
              hitSlop={8}
              className="h-9 w-9 items-center justify-center rounded-full"
            >
              <X size={22} color={iconColor} />
            </TouchableOpacity>

            <Image
              source={isDark ? Images.Brand.LogoWhite : Images.Brand.Logo}
              style={{
                width: LOGO_WIDTH,
                height: LOGO_HEIGHT,
                marginTop: 24,
              }}
              contentFit="contain"
              cachePolicy="memory"
            />

            <Text className="mt-6 font-sans-bold text-3xl text-gray-900 dark:text-white">
              {t('login.title')}
            </Text>
            <Text className="mt-2 font-sans text-base text-gray-500 dark:text-gray-400">
              {t('login.description')}
            </Text>

            <View className="mt-7">
              <LoginForm onLoginSuccess={handleLoginSuccess} />
            </View>

            <View className="flex-1" />

            <TouchableOpacity
              className="mt-6 items-center"
              onPress={handleRegister}
              hitSlop={8}
            >
              <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
                {t('login.noAccount')}{' '}
                <Text className="font-sans-semibold text-primary">
                  {t('login.registerNow')}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}
```

Thang khoảng cách: X → logo `24` (`marginTop` trên Image), logo → tiêu đề `mt-6` (24), tiêu đề → mô tả `mt-2` (8), mô tả → form `mt-7` (28), spacer `flex-1`, footer `mt-6` (24).

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npx jest __tests__/screens/login-screen.test.tsx`
Expected: PASS 2/2

- [ ] **Step 6: Chạy typecheck + toàn bộ suite**

Run: `npm run typecheck && npx jest`
Expected: PASS cả hai.

- [ ] **Step 7: Commit**

```bash
git add app/auth/login.tsx i18n/vi/auth.json i18n/en/auth.json \
  __tests__/screens/login-screen.test.tsx
git commit -m "feat(auth): dựng lại màn đăng nhập

Logo thương hiệu, nút X thích ứng canGoBack thay 3 link chữ, thang khoảng
cách thay số đặt tay, flexGrow + spacer xoá vùng trống chết. Bỏ
behavior='height' trên Android vì trùng với adjustResize."
```

---

### Task 7: Bù tiêu đề và footer cho bottom sheet

`LoginForm` không còn tiêu đề và link đăng ký sau Task 4, nên sheet đang thiếu. Sheet **không** có nút X (đã có pan-down-to-close) và **không** có logo (không đủ chỗ ở 90%).

**Files:**
- Modify: `components/auth/login-sheet-portal.tsx`

**Interfaces:**
- Consumes: `LoginForm` từ Task 4/5, key `login.registerNow` từ Task 6

- [ ] **Step 1: Sửa nội dung sheet**

Trong `components/auth/login-sheet-portal.tsx`, thêm import:

```ts
import { useTranslation } from 'react-i18next'
import { TouchableOpacity, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { navigateNative } from '@/lib/navigation'
```

Thêm vào trong component, sau `const isDark = ...`:

```ts
  const { t } = useTranslation('auth')

  const handleRegister = useCallback(() => {
    close()
    navigateNative.replace('/auth/register')
  }, [close])
```

Thay nội dung `BottomSheetScrollView`:

```tsx
      <BottomSheetScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="px-6 pt-2">
          <Text className="font-sans-bold text-2xl text-gray-900 dark:text-white">
            {t('login.title')}
          </Text>
          <Text className="mt-2 font-sans text-base text-gray-500 dark:text-gray-400">
            {t('login.description')}
          </Text>

          <View className="mt-7">
            <LoginForm
              onLoginSuccess={handleLoginSuccess}
              onBeforeNavigate={close}
            />
          </View>

          <TouchableOpacity
            className="mt-6 items-center"
            onPress={handleRegister}
            hitSlop={8}
          >
            <Text className="font-sans text-sm text-gray-500 dark:text-gray-400">
              {t('login.noAccount')}{' '}
              <Text className="font-sans-semibold text-primary">
                {t('login.registerNow')}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
```

Tiêu đề trong sheet dùng `text-2xl` (nhỏ hơn `text-3xl` của màn full) vì sheet chỉ cao 90% và đã có thanh kéo phía trên.

- [ ] **Step 2: Chạy typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Chạy toàn bộ suite**

Run: `npx jest`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/auth/login-sheet-portal.tsx
git commit -m "feat(auth): sheet đăng nhập tự lo tiêu đề và link đăng ký

Bù lại phần chrome bị lấy khỏi LoginForm. Sheet không cần nút X vì đã có
pan-down-to-close, không cần logo vì chiều cao 90% không đủ chỗ."
```

---

### Task 8: Kiểm chứng cuối

**Files:** không sửa file nào — chỉ chạy và ghi nhận.

- [ ] **Step 1: Chạy đủ bộ kiểm tra tự động**

Run: `npm run typecheck && npm run lint && npx jest && npm run check-circular`
Expected: typecheck sạch, lint 0 error, toàn bộ test pass, không có circular dependency mới.

- [ ] **Step 2: Kiểm tra bằng mắt trên máy thật**

Những thứ jest không kiểm được. Chạy `npx expo run:ios` và `npx expo run:android`, đi qua danh sách:

- [ ] Gõ SĐT nhanh — không mất số, không giật
- [ ] Gõ mật khẩu nhanh — chấm hiện mượt, không khựng
- [ ] Bấm nút mắt — có haptic, chữ hiện/ẩn tức thì
- [ ] Nhập sai mật khẩu — 2 ô lắc cùng nhau, viền đỏ, có haptic, toast hiện
- [ ] Sửa lại một ô — viền đỏ tắt
- [ ] Mở bàn phím — layout không giật, footer trôi ra ngoài vùng cuộn
- [ ] Paste SĐT từ clipboard — dán được
- [ ] Autofill từ iCloud Keychain / Google Password Manager — điền xong bấm Đăng nhập ngay vẫn đúng
- [ ] Vào login từ trang chi tiết sản phẩm → bấm X → quay lại đúng trang trước
- [ ] Vào login từ onboarding → bấm X → về trang chủ
- [ ] Mở sheet đăng nhập từ giỏ hàng — có tiêu đề, có link đăng ký, không có nút X
- [ ] Bật dark mode — logo đổi sang bản trắng, viền và nền đúng token
- [ ] Đặt cỡ chữ hệ thống lớn nhất — logo không phình, bố cục không vỡ

- [ ] **Step 3: Ghi nhận kết quả**

Báo lại đầy đủ: lệnh nào chạy, kết quả ra sao, mục nào trong danh sách thủ công chưa kiểm được và vì sao. Không tuyên bố hoàn thành nếu còn mục chưa kiểm.
