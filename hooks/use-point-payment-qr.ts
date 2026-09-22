import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import { getPointPaymentQr, payPointPaymentQr } from '@/api/payment'
import { QUERYKEY } from '@/constants'
import type { IPointPaymentQr } from '@/types/qr-payment.type'

export const pointPaymentQrKey = (qrData: string) =>
  ['pointPaymentQr', qrData] as const

async function loadPointPaymentQr(qrData: string): Promise<IPointPaymentQr> {
  const response = await getPointPaymentQr(qrData)
  return response.result
}

/**
 * Xem trước ngay lúc quét. staleTime 0: trạng thái QR đổi theo thao tác của
 * nhân viên nên luôn hỏi lại server. Kết quả nằm lại cache để màn xác nhận
 * hiện ngay mà không gọi lần hai.
 */
export function fetchPointPaymentQr(queryClient: QueryClient, qrData: string) {
  return queryClient.fetchQuery({
    queryKey: pointPaymentQrKey(qrData),
    queryFn: () => loadPointPaymentQr(qrData),
    staleTime: 0,
    retry: false,
    meta: { skipGlobalError: true },
  })
}

export function usePointPaymentQrPreview(qrData: string | undefined) {
  return useQuery({
    queryKey: pointPaymentQrKey(qrData ?? ''),
    queryFn: () => loadPointPaymentQr(qrData!),
    enabled: !!qrData,
    // Lỗi của API này là lỗi nghiệp vụ (mã huỷ, lệch đơn) — thử lại vô ích
    // và làm khách chờ thêm.
    retry: false,
    meta: { skipGlobalError: true },
  })
}

export function usePayPointPaymentQr() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (qrData: string) => {
      const response = await payPointPaymentQr(qrData)
      return response.result
    },
    meta: { skipGlobalError: true },
    onSuccess: () => {
      // Khoá khớp tiền tố của useCoinBalance ([profile, 'balance', slug]) và
      // usePointTransactions* ([pointTransactions, ...]).
      void queryClient.invalidateQueries({
        queryKey: [QUERYKEY.profile, 'balance'],
      })
      void queryClient.invalidateQueries({
        queryKey: [QUERYKEY.pointTransactions],
      })
    },
  })
}
