jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}))

jest.mock('@/components/ui/text', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require('react-native')
  return { Text: RN.Text }
})
jest.mock('@/constants', () => ({
  colors: { mutedForeground: { dark: '#888', light: '#888' } },
}))
jest.mock('@/providers/font-scale-provider', () => ({ useFontScale: () => 1 }))
jest.mock('lucide-react-native', () => ({ Eye: () => null, EyeOff: () => null }))

import { act, fireEvent, render } from '@testing-library/react-native'
import { Controller } from 'react-hook-form'
import { View } from 'react-native'
import { z } from 'zod'
import * as Haptics from 'expo-haptics'

import { PasswordInputField } from '@/components/input/password-input-field'
import { useZodForm } from '@/hooks/use-zod-form'

const mockImpactAsync = Haptics.impactAsync as jest.Mock

const schema = z.object({ password: z.string().min(8) })

function Harness() {
  const { control } = useZodForm(schema, { defaultValues: { password: '' } })

  return (
    <View>
      <Controller
        control={control}
        name="password"
        render={({ field: { value, onChange, onBlur } }) => (
          <PasswordInputField
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            placeholder="password"
          />
        )}
      />
    </View>
  )
}

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
})
