/**
 * Màn quét QR voucher, hiển thị toàn màn hình.
 *
 * Component này không biết gì về voucher — nó chỉ trả về một chuỗi mã đã qua
 * lọc. Mọi việc tra cứu và chấm điều kiện do sheet gọi nó lo.
 *
 * Dùng `Modal` của React Native chứ không mở route mới. Modal render trong một
 * native window riêng nằm trên tất cả, nên đạt toàn màn hình thật, trong khi
 * BottomSheetModal gọi nó vẫn mount nguyên bên dưới và giữ đủ state (mã gõ dở,
 * voucher đang chọn, danh sách đã tải). Điều hướng sang route sẽ mất hết những
 * thứ đó và phải dựng thêm đường trả kết quả ngược về.
 *
 * Phần camera (quyền, khung, khoá chống quét trùng) nằm ở `QrCamera`; file này
 * chỉ lo nhãn voucher và màn hỏi thay voucher.
 */
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Pressable, StyleSheet, View } from 'react-native'

import {
  QrCamera,
  qrCameraStyles,
  type QrCameraLabels,
  type QrCameraStatus,
} from '@/components/scan/qr-camera'
import type { ScanStatus } from '@/components/sheet/scan-status'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { parseScannedVoucher } from '@/utils/voucher-qr'

type VoucherQrScannerProps = {
  visible: boolean
  /**
   * Kết quả tra cứu do sheet đẩy vào. Camera chỉ hiển thị, không tự quyết —
   * mọi luật nằm trong `deriveScanStatus`.
   */
  status: ScanStatus
  /**
   * Nhận **slug** voucher nguyên văn đã qua lọc — QR chứa slug, không phải
   * code. Bên gọi phải tra cứu bằng tham số `slug`.
   *
   * Chốt quét KHÔNG tự mở sau khi gọi hàm này. Bên gọi mở lại chốt bằng cách
   * đặt `visible` về false, hoặc bằng `onRetry` khi muốn khách quét mã khác
   * mà vẫn ở trong camera.
   */
  onScanned: (slug: string) => void
  /** Mở lại chốt và xoá kết quả cũ để quét mã khác. */
  onRetry: () => void
  /** Khách đồng ý thay voucher đang áp bằng mã vừa quét. */
  onConfirmReplace: () => void
  onClose: () => void
}

export const VoucherQrScanner = memo(function VoucherQrScanner({
  visible,
  status,
  onScanned,
  onRetry,
  onConfirmReplace,
  onClose,
}: VoucherQrScannerProps) {
  const { t } = useTranslation('voucher')

  const labels = useMemo<QrCameraLabels>(
    () => ({
      title: t('scan.title'),
      closeA11y: t('close'),
      hint: t('scan.hint'),
      hintSource: t('scan.hintSource'),
      rejectedTitle: t('scan.notAVoucher'),
      rejectedHint: t('scan.notAVoucherHint'),
      retry: t('scan.retry'),
      permTitle: t('scan.permTitle'),
      permBody: t('scan.permBody'),
      permDeniedTitle: t('scan.permDeniedTitle'),
      permDeniedBody: t('scan.permDeniedBody'),
      permAllow: t('scan.permAllow'),
      openSettings: t('scan.openSettings'),
      permDismiss: t('scan.manualEntry'),
    }),
    [t],
  )

  const cameraStatus = useMemo<QrCameraStatus>(() => {
    switch (status.kind) {
      case 'checking':
        return { kind: 'busy', label: t('scan.checking') }
      case 'ready':
        return { kind: 'busy', label: t('scan.applying') }
      case 'error':
        return { kind: 'error', title: status.title, detail: status.detail }
      default:
        return { kind: 'idle' }
    }
  }, [status, t])

  // Hỏi trước khi thay voucher đang dùng. "Giữ nguyên" dùng `retry` của
  // QrCamera để mở khoá quét, rồi báo lên sheet qua onRetry.
  const renderCenter = useMemo(() => {
    if (status.kind !== 'confirmReplace') return undefined
    const { currentLabel, nextLabel } = status
    return function ConfirmReplace(retry: () => void) {
      return (
        <View style={qrCameraStyles.hintWrap}>
          <Text style={qrCameraStyles.hint}>{t('scan.replaceTitle')}</Text>
          <View style={s.compareBox}>
            <Text style={s.compareLabel}>{t('scan.replaceCurrent')}</Text>
            <Text style={s.compareValue}>{currentLabel}</Text>
            <View style={s.compareDivider} />
            <Text style={s.compareLabel}>{t('scan.replaceNext')}</Text>
            <Text style={[s.compareValue, s.compareValueNext]}>
              {nextLabel}
            </Text>
          </View>
          <View style={s.confirmRow}>
            <Pressable
              style={[qrCameraStyles.retryBtn, s.confirmBtn]}
              onPress={retry}
              accessibilityRole="button"
            >
              <Text style={qrCameraStyles.retryText}>
                {t('scan.replaceKeep')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                qrCameraStyles.retryBtn,
                s.confirmBtn,
                s.confirmBtnPrimary,
              ]}
              onPress={onConfirmReplace}
              accessibilityRole="button"
            >
              <Text style={s.confirmTextPrimary}>
                {t('scan.replaceConfirm')}
              </Text>
            </Pressable>
          </View>
        </View>
      )
    }
  }, [status, t, onConfirmReplace])

  const footer = useMemo(
    () => (
      <Pressable
        style={s.manualBtn}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={s.manualText}>{t('scan.manualEntry')}</Text>
      </Pressable>
    ),
    [onClose, t],
  )

  // Ẩn là unmount QrCamera, nên chốt quét tự mở lại lần mở sau.
  if (!visible) return null

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <QrCamera
        labels={labels}
        parse={parseScannedVoucher}
        onScanned={onScanned}
        status={cameraStatus}
        onRetry={onRetry}
        onClose={onClose}
        renderCenter={renderCenter}
        footer={footer}
      />
    </Modal>
  )
})

const s = StyleSheet.create({
  compareBox: {
    alignSelf: 'stretch',
    marginTop: 4,
    padding: 14,
    borderRadius: 12,
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  // Nhãn và giá trị cùng màu trắng — phân biệt bằng cỡ chữ và độ đậm, không
  // bằng màu, để chữ nào trên nền camera cũng đọc được như nhau.
  compareLabel: { color: colors.white.light, fontSize: 12, fontWeight: '500' },
  compareValue: { color: colors.white.light, fontSize: 15, fontWeight: '600' },
  // Mã vừa quét to và đậm hơn mã đang dùng: nhìn ra ngay cái mới thì quyết
  // nhanh hơn.
  compareValueNext: { fontSize: 17, fontWeight: '700' },
  compareDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  confirmRow: { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  confirmBtn: { flex: 1, marginTop: 6 },
  confirmBtnPrimary: { backgroundColor: colors.primary.light },
  confirmTextPrimary: {
    color: colors.white.light,
    fontSize: 13,
    fontWeight: '700',
  },
  manualBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Viền trắng đặc, nền trắng pha rất loãng — nằm trên nền camera nên cố
    // tình hardcode. borderWidth 1 chứ không hairline: hairline gần như biến mất.
    borderWidth: 1,
    borderColor: colors.white.light,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  manualText: { color: colors.white.light, fontSize: 16, fontWeight: '600' },
})
