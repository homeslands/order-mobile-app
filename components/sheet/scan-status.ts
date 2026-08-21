/**
 * Máy trạng thái của màn quét QR voucher — hàm thuần, không hook, không React.
 *
 * Camera hiển thị gì, và sheet có được phép tự áp voucher hay không, đều do
 * hàm này quyết định. Ba sheet (giỏ hàng, thanh toán, sửa đơn) cùng gọi nó
 * nên luật chỉ nằm đúng một chỗ.
 */
import type { ProcessedVoucher } from './voucher-validation'
import type { IVoucher } from '@/types'

export type ScanStatus =
  /** Chưa quét gì — camera sẵn sàng. */
  | { kind: 'idle' }
  /** Đang tra cứu mã trên máy chủ. */
  | { kind: 'checking' }
  /** Hợp lệ và không vướng gì — sheet được phép tự áp. */
  | { kind: 'ready'; voucher: IVoucher }
  /** Hợp lệ nhưng đang có voucher khác — phải hỏi trước khi thay. */
  | {
      kind: 'confirmReplace'
      voucher: IVoucher
      currentLabel: string
      nextLabel: string
    }
  /** Không tìm thấy, không đủ điều kiện, hoặc đã áp sẵn chính mã này. */
  | { kind: 'error'; title: string; detail?: string }

type TFn = (key: string) => string

type DeriveScanStatusInput = {
  /**
   * Giá trị camera vừa đọc được (slug), null khi chưa quét lần nào trong
   * phiên hiện tại. Chỉ dùng để biết đã có lần quét hay chưa.
   */
  scannedValue: string | null
  isFetching: boolean
  fetchedVoucher: IVoucher | null
  processed: ProcessedVoucher | null
  /** Voucher đang được áp cho đơn, nếu có. */
  currentVoucher: IVoucher | null
  t: TFn
}

export function deriveScanStatus({
  scannedValue,
  isFetching,
  fetchedVoucher,
  processed,
  currentVoucher,
  t,
}: DeriveScanStatusInput): ScanStatus {
  if (!scannedValue) return { kind: 'idle' }

  // isFetching phải thắng dữ liệu của lần quét trước còn nằm lại trong cache,
  // nếu không camera sẽ nháy kết quả cũ trước khi kết quả mới về.
  if (isFetching) return { kind: 'checking' }

  if (!fetchedVoucher || !processed) {
    // Không kèm chuỗi vừa quét: với khách đó là một dãy ký tự vô nghĩa
    // (`b3644671ed`), không giúp họ làm gì tiếp.
    return { kind: 'error', title: t('scan.notFound') }
  }

  if (!processed.isValid) {
    return {
      kind: 'error',
      title: processed.errorMessage || t('scan.notUsable'),
      detail: fetchedVoucher.title,
    }
  }

  if (currentVoucher?.slug === fetchedVoucher.slug) {
    return {
      kind: 'error',
      title: t('scan.alreadyApplied'),
      detail: fetchedVoucher.title,
    }
  }

  if (currentVoucher) {
    return {
      kind: 'confirmReplace',
      voucher: fetchedVoucher,
      currentLabel: currentVoucher.title,
      nextLabel: fetchedVoucher.title,
    }
  }

  return { kind: 'ready', voucher: fetchedVoucher }
}
