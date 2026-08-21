/**
 * Cổng ép hoàn tất hồ sơ (app/index.tsx gọi needsProfileCompletion). Đây là thứ duy nhất khiến "họ tên và
 * ngày sinh là bắt buộc" có hiệu lực thật — bỏ nút "Bỏ qua" chỉ bịt được một
 * đường, vì tài khoản đã đăng nhập xong trước khi tới màn điền hồ sơ nên tắt
 * app rồi mở lại là lách được.
 */
// auth-helpers nạp @/stores, kéo theo cả chuỗi native module. isProfileIncomplete
// là hàm thuần, không đụng store, nên chặn ở đây là đủ.
jest.mock('@/stores', () => ({
  useAuthStore: { getState: () => ({ isAuthenticated: () => false }) },
  useUserStore: { getState: () => ({ userInfo: null }) },
}))

import { isProfileIncomplete } from '@/utils/auth-helpers'

const full = { firstName: 'Thắng', lastName: 'Phan', dob: '01/01/1990' }

describe('isProfileIncomplete', () => {
  it('hồ sơ đủ ba trường thì không chặn', () => {
    expect(isProfileIncomplete(full)).toBe(false)
  })

  it.each(['firstName', 'lastName', 'dob'] as const)(
    'thiếu %s thì chặn',
    (field) => {
      expect(isProfileIncomplete({ ...full, [field]: '' })).toBe(true)
      expect(isProfileIncomplete({ ...full, [field]: null })).toBe(true)
      expect(isProfileIncomplete({ ...full, [field]: undefined })).toBe(true)
    },
  )

  it('chưa có userInfo thì không chặn — chưa đăng nhập, để luồng thường xử lý', () => {
    expect(isProfileIncomplete(null)).toBe(false)
  })
})
