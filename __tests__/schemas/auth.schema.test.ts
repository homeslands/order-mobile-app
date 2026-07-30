import { renderHook } from '@testing-library/react-native'

import { useLoginSchema } from '@/schemas'

// Không có i18n provider trong jest nên t() trả về chính key — assert theo key.
const parse = (values: { phonenumber: string; password: string }) => {
  const { result } = renderHook(() => useLoginSchema())
  return result.current.safeParse(values)
}

const messageFor = (
  result: ReturnType<typeof parse>,
  field: 'phonenumber' | 'password',
) =>
  result.success
    ? undefined
    : result.error.issues.find((i) => i.path[0] === field)?.message

describe('useLoginSchema', () => {
  it('chặn khi cả 2 ô rỗng, báo lỗi riêng cho từng ô', () => {
    const result = parse({ phonenumber: '', password: '' })

    expect(result.success).toBe(false)
    expect(messageFor(result, 'phonenumber')).toBe('login.phoneNumberRequired')
    expect(messageFor(result, 'password')).toBe('login.passwordRequired')
  })

  it('chặn khi chỉ mật khẩu rỗng, không báo oan ô SĐT', () => {
    const result = parse({ phonenumber: '0901234567', password: '' })

    expect(result.success).toBe(false)
    expect(messageFor(result, 'password')).toBe('login.passwordRequired')
    expect(messageFor(result, 'phonenumber')).toBeUndefined()
  })

  it('cho qua khi cả 2 ô có dữ liệu', () => {
    expect(
      parse({ phonenumber: '0901234567', password: 'somepass1' }).success,
    ).toBe(true)
  })

  // Hai case dưới khoá lại quyết định cố ý, không phải kẽ hở bị bỏ sót.

  it('KHÔNG chặn SĐT sai định dạng — để server phán, tránh khoá cửa tài khoản tạo theo quy tắc cũ', () => {
    expect(parse({ phonenumber: '1', password: 'somepass1' }).success).toBe(
      true,
    )
  })

  it('KHÔNG trim mật khẩu — trim sẽ làm sai lệch giá trị người dùng nhập', () => {
    expect(parse({ phonenumber: '0901234567', password: ' ' }).success).toBe(
      true,
    )
  })
})
