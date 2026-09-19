import {
  classifyPointQrError,
  formatPointQrPayer,
  parsePointPaymentQr,
  previewOutcome,
} from '@/utils/point-payment-qr'

// Chuỗi thật lấy từ sheet kiểm thử BE (đã đổi 1 ký tự CRC — app không kiểm CRC).
const VALID =
  '00020101021238830011ORDER.POINT0164b7f1fce44fd4a7ddcc4b4711b6b6f13340622dccaa1a8a1a2af26a9633b4ad2a54061600005802VN6228011081992a6895071041d5f0f994630466C9'

// VietQR ngân hàng thật: cùng tiền tố nhưng GUID là A000000727 (NAPAS).
const BANK_QR =
  '00020101021238570010A00000072701270006970403011300110123456780208QRIBFTTA53037045405100005802VN62150811Chuyen tien6304ABCD'

function axiosError(status: number | null, statusCode?: number) {
  return {
    isAxiosError: true,
    response:
      status === null
        ? undefined
        : { status, data: statusCode ? { statusCode } : {} },
  }
}

describe('parsePointPaymentQr', () => {
  it('nhận QR xu và cắt khoảng trắng hai đầu', () => {
    expect(parsePointPaymentQr(`  ${VALID}\n`)).toBe(VALID)
  })

  it.each([
    ['QR ngân hàng', BANK_QR],
    ['chuỗi rỗng', ''],
    ['URL', 'https://trendcoffee.vn/pay'],
    ['slug voucher', 'b3644671ed'],
    ['thiếu tiền tố', VALID.slice(12)],
  ])('loại %s', (_, raw) => {
    expect(parsePointPaymentQr(raw)).toBeNull()
  })
})

describe('classifyPointQrError', () => {
  it.each([
    [160206, 'notFound'],
    [160207, 'alreadyPaid'],
    [160208, 'cancelled'],
    [160209, 'orderChanged'],
    [160210, 'missingData'],
    [160212, 'invalid'],
    [160213, 'mismatch'],
    [158205, 'insufficient'],
  ])('mã %i → %s', (code, kind) => {
    expect(classifyPointQrError(axiosError(400, code))).toBe(kind)
  })

  it('không có response là mất mạng', () => {
    expect(classifyPointQrError(axiosError(null))).toBe('network')
  })

  it('401 và 403 không kèm statusCode nghiệp vụ', () => {
    expect(classifyPointQrError(axiosError(401))).toBe('unauthorized')
    expect(classifyPointQrError(axiosError(403))).toBe('forbidden')
  })

  it('mã lạ hoặc lỗi không phải axios là unknown', () => {
    expect(classifyPointQrError(axiosError(500, 999999))).toBe('unknown')
    expect(classifyPointQrError(new Error('x'))).toBe('unknown')
    expect(classifyPointQrError(null)).toBe('unknown')
  })
})

describe('previewOutcome', () => {
  it('rẽ nhánh theo status', () => {
    expect(previewOutcome({ status: 'initiate' })).toBe('confirm')
    expect(previewOutcome({ status: 'completed' })).toBe('alreadyPaid')
    expect(previewOutcome({ status: 'cancelled' })).toBe('cancelled')
  })
})

describe('formatPointQrPayer', () => {
  it('có tên thì ghép tên và số đã che', () => {
    expect(
      formatPointQrPayer({
        slug: 'u1',
        phonenumber: '0324567894',
        firstName: 'Lan',
        lastName: 'Nguyễn',
      }),
    ).toBe('Lan Nguyễn · ******7894')
  })

  it('không có tên thì chỉ số đã che', () => {
    expect(formatPointQrPayer({ slug: 'u1', phonenumber: '0324567894' })).toBe(
      '******7894',
    )
  })
})
