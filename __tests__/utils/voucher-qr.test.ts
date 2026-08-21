// Hợp đồng backend: QR chứa ĐÚNG voucher.slug, không gì khác.
// Slug KHÁC code — ô nhập tay nhận code, camera nhận slug, và
// /voucher/specific tra bằng hai tham số khác nhau.
//
// Client không phán định dạng slug — server mới biết slug nào có thật. Bộ lọc
// chỉ loại những QR chắc chắn thuộc định dạng khác, để khỏi tốn một vòng gọi
// mạng vô nghĩa.
import { parseScannedVoucher } from '@/utils/voucher-qr'

describe('parseScannedVoucher — slug gửi thẳng lên server', () => {
  it('trả nguyên văn slug quan sát được từ hệ thống', () => {
    expect(parseScannedVoucher('b3644671ed')).toBe('b3644671ed')
  })

  it('GIỮ NGUYÊN hoa thường — slug phân biệt hoa thường', () => {
    expect(parseScannedVoucher('aB3c4D')).toBe('aB3c4D')
  })

  it('cắt khoảng trắng thừa hai đầu', () => {
    expect(parseScannedVoucher('  b3644671ed\n')).toBe('b3644671ed')
  })

  it('chấp nhận slug ngắn — độ dài là chuyện của server', () => {
    expect(parseScannedVoucher('a1')).toBe('a1')
  })

  it('chấp nhận gạch ngang và gạch dưới', () => {
    expect(parseScannedVoucher('he-2026_vip')).toBe('he-2026_vip')
  })

  it('vẫn nhận chuỗi dài 64 ký tự — biên trên là chặn rác, không phải luật slug', () => {
    const long = 'a'.repeat(64)
    expect(parseScannedVoucher(long)).toBe(long)
  })
})

describe('parseScannedVoucher — loại thứ chắc chắn không phải slug', () => {
  it('từ chối chuỗi rỗng', () => {
    expect(parseScannedVoucher('')).toBeNull()
    expect(parseScannedVoucher('   ')).toBeNull()
  })

  it('từ chối mọi đường dẫn web, kể cả URL voucher của hệ thống', () => {
    expect(
      parseScannedVoucher(
        'https://sandbox.order.cmsiot.net/voucher/b3644671ed',
      ),
    ).toBeNull()
    expect(
      parseScannedVoucher('https://www.canvaqr.com/v/RGQglovznd'),
    ).toBeNull()
  })

  it('từ chối cấu hình wifi', () => {
    expect(parseScannedVoucher('WIFI:S:Trend;T:WPA;P:12345678;;')).toBeNull()
  })

  it('từ chối danh thiếp vCard', () => {
    expect(
      parseScannedVoucher('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD'),
    ).toBeNull()
  })

  it('từ chối mailto, tel, geo', () => {
    expect(parseScannedVoucher('mailto:a@b.vn')).toBeNull()
    expect(parseScannedVoucher('tel:+84901234567')).toBeNull()
    expect(parseScannedVoucher('geo:10.77,106.69')).toBeNull()
  })

  it('từ chối chuỗi có khoảng trắng ở giữa', () => {
    expect(parseScannedVoucher('b364 4671ed')).toBeNull()
  })

  it('từ chối chuỗi nhiều dòng', () => {
    expect(parseScannedVoucher('abc\ndef')).toBeNull()
  })

  it('từ chối chuỗi dài quá mức', () => {
    expect(parseScannedVoucher('a'.repeat(65))).toBeNull()
  })
})
