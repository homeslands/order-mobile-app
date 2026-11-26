import { useCallback, useState } from 'react'

export const RESEND_COOLDOWN_SECONDS = 60

/** Mốc được bấm gửi lại: tính từ lúc mã vừa gửi, không phải lúc mã hết hạn. */
export function getResendAvailableAt(sentAtMs: number): string {
  return new Date(sentAtMs + RESEND_COOLDOWN_SECONDS * 1000).toISOString()
}

/**
 * Giữ mốc cooldown gửi lại OTP, tách khỏi thời hạn OTP. Gọi
 * `restartResendCooldown` mỗi khi gửi / gửi lại mã thành công. Hook chỉ đổi
 * state lúc restart — phần đếm từng giây để bước OTP lo (`useCountdown`),
 * nên màn cha không re-render mỗi giây.
 *
 * BE gửi lại đúng mã cũ với `expiresAt` cũ, nên không suy ra được lần gửi
 * lại từ `expiresAt` — phải restart tường minh.
 */
export function useResendCooldown() {
  const [resendAvailableAt, setResendAvailableAt] = useState(() =>
    getResendAvailableAt(Date.now()),
  )
  const restartResendCooldown = useCallback(
    () => setResendAvailableAt(getResendAvailableAt(Date.now())),
    [],
  )
  return { resendAvailableAt, restartResendCooldown }
}
