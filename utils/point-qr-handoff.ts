/**
 * Chặn mở màn xác nhận trả xu bằng deep link.
 *
 * `trend://payment/point-confirm?qrData=…` mở thẳng màn xác nhận, bỏ qua
 * bước quét — kẻ gian chỉ cần gửi một đường link để dẫn người khác trả đơn
 * của mình. Màn quét đánh dấu mã vừa đọc từ camera ở đây; màn xác nhận chỉ
 * nhận mã đã được đánh dấu.
 *
 * Chỉ nằm trong bộ nhớ: tắt app là mất, nên link mở app từ bên ngoài không
 * bao giờ đi qua được. Không xoá sau khi đọc vì màn xác nhận có thể mount lại.
 */
const scanned = new Set<string>()

export function markPointQrScanned(qrData: string): void {
  scanned.add(qrData)
}

export function wasPointQrScanned(qrData: string | undefined): boolean {
  return !!qrData && scanned.has(qrData)
}
