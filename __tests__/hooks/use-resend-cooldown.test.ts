import { act, renderHook } from '@testing-library/react-native'

import { useCountdown } from '@/hooks/use-countdown'
import {
  RESEND_COOLDOWN_SECONDS,
  getResendAvailableAt,
  useResendCooldown,
} from '@/hooks/use-resend-cooldown'

const NOW = new Date('2026-01-01T00:00:00.000Z').getTime()

describe('getResendAvailableAt', () => {
  it('mốc gửi lại là 60 giây sau lúc gửi mã', () => {
    expect(RESEND_COOLDOWN_SECONDS).toBe(60)
    expect(getResendAvailableAt(NOW)).toBe('2026-01-01T00:01:00.000Z')
  })
})

describe('useResendCooldown', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(NOW)
  })
  afterEach(() => jest.useRealTimers())

  // Ghép đúng như màn OTP dùng: mốc ở màn cha, đếm ngược ở bước OTP.
  function renderCooldown() {
    return renderHook(() => {
      const cooldown = useResendCooldown()
      const seconds = useCountdown({ expiresAt: cooldown.resendAvailableAt })
      return { ...cooldown, seconds }
    })
  }

  it('khoá gửi lại 60 giây rồi mở, không phụ thuộc thời hạn OTP', () => {
    const { result } = renderCooldown()
    expect(result.current.seconds).toBe(60)

    act(() => {
      jest.advanceTimersByTime(59_000)
    })
    expect(result.current.seconds).toBe(1)

    act(() => {
      jest.advanceTimersByTime(1_000)
    })
    expect(result.current.seconds).toBe(0)
  })

  it('gửi lại thành công thì đếm lại từ 60 giây', () => {
    const { result } = renderCooldown()
    act(() => {
      jest.advanceTimersByTime(60_000)
    })
    expect(result.current.seconds).toBe(0)

    act(() => result.current.restartResendCooldown())
    expect(result.current.seconds).toBe(60)

    act(() => {
      jest.advanceTimersByTime(30_000)
    })
    expect(result.current.seconds).toBe(30)
  })

  it('restartResendCooldown giữ nguyên tham chiếu giữa các lần render', () => {
    const { result, rerender } = renderCooldown()
    const first = result.current.restartResendCooldown
    rerender({})
    expect(result.current.restartResendCooldown).toBe(first)
  })
})
