/**
 * Quét QR thanh toán xu trên màn hình thu ngân (route /payment/scan-point).
 *
 * Quét được mã hợp lệ thì gọi xem trước ngay. QR còn chờ trả → `replace`
 * sang màn xác nhận (bấm back không quay lại camera đang chạy). Mọi trường
 * hợp khác báo lỗi tại chỗ, khách bấm "Quét lại" để thử mã khác.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'

import {
  QrCamera,
  type QrCameraLabels,
  type QrCameraStatus,
} from '@/components/scan/qr-camera'
import { fetchPointPaymentQr } from '@/hooks/use-point-payment-qr'
import {
  classifyPointQrError,
  parsePointPaymentQr,
  previewOutcome,
} from '@/utils/point-payment-qr'

export default function ScanPointScreen() {
  const { t } = useTranslation('payment')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<QrCameraStatus>({ kind: 'idle' })

  const labels = useMemo<QrCameraLabels>(
    () => ({
      title: t('pointQr.scan.title'),
      closeA11y: t('pointQr.scan.close'),
      hint: t('pointQr.scan.hint'),
      hintSource: t('pointQr.scan.hintSource'),
      rejectedTitle: t('pointQr.scan.rejectedTitle'),
      rejectedHint: t('pointQr.scan.rejectedHint'),
      retry: t('pointQr.scan.retry'),
      permTitle: t('pointQr.scan.permTitle'),
      permBody: t('pointQr.scan.permBody'),
      permDeniedTitle: t('pointQr.scan.permDeniedTitle'),
      permDeniedBody: t('pointQr.scan.permDeniedBody'),
      permAllow: t('pointQr.scan.permAllow'),
      openSettings: t('pointQr.scan.openSettings'),
      permDismiss: t('pointQr.scan.permDismiss'),
    }),
    [t],
  )

  const handleScanned = useCallback(
    (qrData: string) => {
      setStatus({ kind: 'busy', label: t('pointQr.scan.checking') })
      fetchPointPaymentQr(queryClient, qrData)
        .then((qr) => {
          const outcome = previewOutcome(qr)
          if (outcome === 'confirm') {
            router.replace({
              pathname: '/payment/point-confirm',
              params: { qrData },
            } as never)
            return
          }
          setStatus({ kind: 'error', title: t(`pointQr.errors.${outcome}`) })
        })
        .catch((error: unknown) => {
          const kind = classifyPointQrError(error)
          setStatus({ kind: 'error', title: t(`pointQr.errors.${kind}`) })
        })
    },
    [queryClient, router, t],
  )

  const handleRetry = useCallback(() => {
    setStatus({ kind: 'idle' })
  }, [])

  const handleClose = useCallback(() => {
    router.back()
  }, [router])

  return (
    <View style={s.root}>
      <QrCamera
        labels={labels}
        parse={parsePointPaymentQr}
        onScanned={handleScanned}
        status={status}
        onRetry={handleRetry}
        onClose={handleClose}
      />
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1 },
})
