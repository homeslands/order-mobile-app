jest.mock('@/components/ui', () => ({ Input: () => null }))
jest.mock('@/components/ui/text', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const RN = require('react-native')
  return { Text: RN.Text }
})
jest.mock('@/constants', () => ({
  colors: { mutedForeground: { dark: '#888', light: '#888' } },
}))
jest.mock('@/providers/font-scale-provider', () => ({ useFontScale: () => 1 }))

import { act, fireEvent, render } from '@testing-library/react-native'
import { Pressable, View } from 'react-native'
import { z } from 'zod'

import { FormInput } from '@/components/form/form-input'
import { useZodForm } from '@/hooks/use-zod-form'

const schema = z.object({ phonenumber: z.string() })

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

  it('bật viền destructive khi field invalid dù không có chữ lỗi', async () => {
    const { getByPlaceholderText, getByTestId } = render(<Harness />)

    expect(getByPlaceholderText('phone').props.className).not.toContain(
      'border-destructive',
    )

    await act(async () => {
      fireEvent.press(getByTestId('set-empty-error'))
    })

    expect(getByPlaceholderText('phone').props.className).toContain(
      'border-destructive',
    )
  })
})
