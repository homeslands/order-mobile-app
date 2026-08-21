// deriveScanStatus là bộ não của màn quét: nó quyết định camera hiện gì và
// khi nào sheet được phép tự áp voucher. Sai ở đây thì hoặc khách bị đá mất
// voucher đang dùng, hoặc mã hợp lệ mà không bao giờ được áp.
import { deriveScanStatus } from '@/components/sheet/scan-status'
import type { ProcessedVoucher } from '@/components/sheet/voucher-validation'
import type { IVoucher } from '@/types'

const t = (key: string) => key

function voucher(slug: string, title = `voucher ${slug}`): IVoucher {
  return { slug, title } as IVoucher
}

function processed(
  v: IVoucher,
  isValid: boolean,
  errorMessage = '',
): ProcessedVoucher {
  return {
    voucher: v,
    isValid,
    errorMessage,
    discountLabel: 'giảm 30.000₫',
    expiryText: '',
    minOrderText: '',
    usagePercent: 0,
  }
}

const base = {
  isFetching: false,
  fetchedVoucher: null,
  processed: null,
  currentVoucher: null,
  t,
}

describe('deriveScanStatus', () => {
  it('chưa quét gì thì ở trạng thái idle', () => {
    expect(deriveScanStatus({ ...base, scannedValue: null })).toEqual({
      kind: 'idle',
    })
  })

  it('đang gọi API thì báo checking', () => {
    expect(
      deriveScanStatus({ ...base, scannedValue: 'ABCD', isFetching: true }),
    ).toEqual({ kind: 'checking' })
  })

  it('không tìm thấy mã thì báo lỗi, KHÔNG kèm chuỗi vừa quét', () => {
    expect(deriveScanStatus({ ...base, scannedValue: 'ABCD' })).toEqual({
      kind: 'error',
      title: 'scan.notFound',
    })
  })

  it('mã tồn tại nhưng không đủ điều kiện thì trả đúng lý do có sẵn', () => {
    const v = voucher('v1')
    expect(
      deriveScanStatus({
        ...base,
        scannedValue: 'ABCD',
        fetchedVoucher: v,
        processed: processed(v, false, 'Đơn tối thiểu 200.000₫'),
      }),
    ).toEqual({
      kind: 'error',
      title: 'Đơn tối thiểu 200.000₫',
      detail: 'voucher v1',
    })
  })

  it('không đủ điều kiện mà thiếu lý do thì rơi về câu "hiện không dùng được"', () => {
    const v = voucher('v1')
    const result = deriveScanStatus({
      ...base,
      scannedValue: 'ABCD',
      fetchedVoucher: v,
      processed: processed(v, false, ''),
    })
    expect(result).toEqual({
      kind: 'error',
      title: 'scan.notUsable',
      detail: 'voucher v1',
    })
  })

  it('hợp lệ và chưa có voucher nào thì sẵn sàng áp', () => {
    const v = voucher('v1')
    expect(
      deriveScanStatus({
        ...base,
        scannedValue: 'ABCD',
        fetchedVoucher: v,
        processed: processed(v, true),
      }),
    ).toEqual({ kind: 'ready', voucher: v })
  })

  it('hợp lệ nhưng đang có voucher KHÁC thì phải hỏi trước khi thay', () => {
    const current = voucher('old', 'Giảm 50.000₫')
    const next = voucher('new', 'Giảm 30.000₫')
    expect(
      deriveScanStatus({
        ...base,
        scannedValue: 'ABCD',
        fetchedVoucher: next,
        processed: processed(next, true),
        currentVoucher: current,
      }),
    ).toEqual({
      kind: 'confirmReplace',
      voucher: next,
      currentLabel: 'Giảm 50.000₫',
      nextLabel: 'Giảm 30.000₫',
    })
  })

  it('quét đúng cái voucher đang áp thì báo đã dùng rồi, không áp lại', () => {
    const v = voucher('same', 'Giảm 30.000₫')
    expect(
      deriveScanStatus({
        ...base,
        scannedValue: 'ABCD',
        fetchedVoucher: v,
        processed: processed(v, true),
        currentVoucher: v,
      }),
    ).toEqual({
      kind: 'error',
      title: 'scan.alreadyApplied',
      detail: 'Giảm 30.000₫',
    })
  })

  it('isFetching thắng mọi dữ liệu cũ còn sót lại', () => {
    const v = voucher('v1')
    expect(
      deriveScanStatus({
        ...base,
        scannedValue: 'ABCD',
        isFetching: true,
        fetchedVoucher: v,
        processed: processed(v, true),
      }),
    ).toEqual({ kind: 'checking' })
  })

  it('có voucher nhưng chưa chấm điều kiện xong thì coi như chưa tìm thấy', () => {
    const v = voucher('v1')
    expect(
      deriveScanStatus({
        ...base,
        scannedValue: 'ABCD',
        fetchedVoucher: v,
        processed: null,
      }),
    ).toEqual({ kind: 'error', title: 'scan.notFound' })
  })
})
