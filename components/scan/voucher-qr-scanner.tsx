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
 */
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { StatusBar } from 'expo-status-bar'
import { Camera, CameraOff, TriangleAlert, X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { ScanStatus } from '@/components/sheet/scan-status'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { FOOTER_BOTTOM_EXTRA, STATIC_TOP_INSET } from '@/constants/status-bar'
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

const BARCODE_SETTINGS = { barcodeTypes: ['qr' as const] }
const FRAME_MAX = 300
const FRAME_RATIO = 0.68

export const VoucherQrScanner = memo(function VoucherQrScanner({
  visible,
  status,
  onScanned,
  onRetry,
  onConfirmReplace,
  onClose,
}: VoucherQrScannerProps) {
  const { t } = useTranslation('voucher')
  const [permission, requestPermission] = useCameraPermissions()
  const [rejected, setRejected] = useState(false)
  /** Chuỗi thô vừa bị bộ lọc từ chối — hiện lên để biết QR thật chứa gì. */
  const [rejectedRaw, setRejectedRaw] = useState<string | null>(null)
  const isDark = useColorScheme() === 'dark'
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  // Chốt một chiều. onBarcodeScanned bắn nhiều lần mỗi giây khi mã còn nằm
  // trong khung; dùng state cho chốt này sẽ kéo theo re-render và vẫn để lọt
  // lần bắn thứ hai trong cùng một frame.
  const lockRef = useRef(false)

  useEffect(() => {
    if (!visible) {
      lockRef.current = false
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRejected(false)
      setRejectedRaw(null)
    }
  }, [visible])

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (lockRef.current) return
      lockRef.current = true

      const slug = parseScannedVoucher(data)
      if (!slug) {
        setRejected(true)
        setRejectedRaw(data)
        return
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      onScanned(slug)
    },
    [onScanned],
  )

  const handleRetry = useCallback(() => {
    lockRef.current = false
    setRejected(false)
    setRejectedRaw(null)
    onRetry()
  }, [onRetry])

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings()
  }, [])

  const handleRequestPermission = useCallback(() => {
    void requestPermission().catch(() => {})
  }, [requestPermission])

  if (!visible) return null

  const frameSize = Math.min(width * FRAME_RATIO, FRAME_MAX)
  const footerPadding = insets.bottom + FOOTER_BOTTOM_EXTRA
  // Nền camera luôn tối; panel xin quyền thì theo theme.
  const showsCamera = !permission || permission.granted

  let content: React.ReactNode

  if (!permission) {
    // Hook chưa giải quyết xong ở frame đầu — giữ nền tối, đừng nháy nội dung.
    content = <View style={[s.root, s.dark]} />
  } else if (!permission.granted) {
    const blocked = !permission.canAskAgain
    // Panel này là mặt phẳng theo theme, không phải nền camera — phải đổi màu
    // theo isDark, không như phần camera bên dưới.
    const panelBg = isDark ? colors.card.dark : colors.card.light
    const panelBorder = isDark ? colors.border.dark : colors.border.light
    const titleColor = isDark ? colors.foreground.dark : colors.foreground.light
    const bodyColor = isDark
      ? colors.mutedForeground.dark
      : colors.mutedForeground.light
    const ghostTextColor = isDark
      ? colors.foreground.dark
      : colors.foreground.light
    const iconWrapBg = isDark ? colors.border.dark : colors.gray[100]

    content = (
      <View
        style={[
          s.root,
          s.panel,
          {
            backgroundColor: panelBg,
            paddingTop: STATIC_TOP_INSET,
            paddingBottom: footerPadding,
          },
        ]}
      >
        <View style={[s.iconWrap, { backgroundColor: iconWrapBg }]}>
          {blocked ? (
            <CameraOff size={28} color={colors.destructive.light} />
          ) : (
            <Camera size={28} color={colors.primary.light} />
          )}
        </View>
        <Text style={[s.panelTitle, { color: titleColor }]}>
          {blocked ? t('scan.permDeniedTitle') : t('scan.permTitle')}
        </Text>
        <Text style={[s.panelBody, { color: bodyColor }]}>
          {blocked ? t('scan.permDeniedBody') : t('scan.permBody')}
        </Text>
        <Pressable
          style={s.primaryBtn}
          onPress={blocked ? handleOpenSettings : handleRequestPermission}
        >
          <Text style={s.primaryBtnText}>
            {blocked ? t('scan.openSettings') : t('scan.permAllow')}
          </Text>
        </Pressable>
        <Pressable
          style={[s.ghostBtn, { borderColor: panelBorder }]}
          onPress={onClose}
        >
          <Text style={[s.ghostBtnText, { color: ghostTextColor }]}>
            {t('scan.manualEntry')}
          </Text>
        </Pressable>
      </View>
    )
  } else {
    // Khung góc chuyển đỏ cho cả mã sai định dạng lẫn mã tra cứu hỏng.
    const hasError = rejected || status.kind === 'error'

    content = (
      <View style={[s.root, s.dark]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={BARCODE_SETTINGS}
          onBarcodeScanned={handleBarcodeScanned}
        />

        <View style={[s.topBar, { paddingTop: STATIC_TOP_INSET + 8 }]}>
          <Text style={s.topTitle}>{t('scan.title')}</Text>
          <Pressable
            style={s.closeBtn}
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel={t('close')}
          >
            <X size={20} color={colors.white.light} />
          </Pressable>
        </View>

        <View style={s.center}>
          <View style={[s.frame, { width: frameSize, height: frameSize }]}>
            <View style={s.frameInner} />
            <View
              style={[
                s.corner,
                s.cornerTL,
                hasError ? s.cornerBad : s.cornerNormal,
              ]}
            />
            <View
              style={[
                s.corner,
                s.cornerTR,
                hasError ? s.cornerBad : s.cornerNormal,
              ]}
            />
            <View
              style={[
                s.corner,
                s.cornerBL,
                hasError ? s.cornerBad : s.cornerNormal,
              ]}
            />
            <View
              style={[
                s.corner,
                s.cornerBR,
                hasError ? s.cornerBad : s.cornerNormal,
              ]}
            />
          </View>

          {rejected ? (
            // Mã sai định dạng — bắt tại chỗ, chưa hề gọi API.
            <View style={s.hintWrap}>
              <View style={s.errorBox}>
                <TriangleAlert
                  size={22}
                  color={colors.destructive.dark}
                  style={s.errorIcon}
                />
                <View style={s.errorTexts}>
                  <Text style={s.errorTitle}>{t('scan.notAVoucher')}</Text>
                  <Text style={s.errorDetail}>{t('scan.notAVoucherHint')}</Text>
                  {rejectedRaw ? (
                    <Text style={s.errorRaw} selectable numberOfLines={4}>
                      {rejectedRaw}
                    </Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                style={s.retryBtn}
                onPress={handleRetry}
                accessibilityRole="button"
              >
                <Text style={s.retryText}>{t('scan.retry')}</Text>
              </Pressable>
            </View>
          ) : status.kind === 'checking' || status.kind === 'ready' ? (
            <View style={s.hintWrap}>
              <ActivityIndicator color={colors.primary.light} />
              <Text style={s.hint}>
                {status.kind === 'ready'
                  ? t('scan.applying')
                  : t('scan.checking')}
              </Text>
            </View>
          ) : status.kind === 'error' ? (
            <View style={s.hintWrap}>
              <View style={s.errorBox}>
                <TriangleAlert
                  size={22}
                  color={colors.destructive.dark}
                  style={s.errorIcon}
                />
                <View style={s.errorTexts}>
                  <Text style={s.errorTitle}>{status.title}</Text>
                  {status.detail ? (
                    <Text style={s.errorDetail}>{status.detail}</Text>
                  ) : null}
                </View>
              </View>
              <Pressable
                style={s.retryBtn}
                onPress={handleRetry}
                accessibilityRole="button"
              >
                <Text style={s.retryText}>{t('scan.retry')}</Text>
              </Pressable>
            </View>
          ) : status.kind === 'confirmReplace' ? (
            <View style={s.hintWrap}>
              <Text style={s.hint}>{t('scan.replaceTitle')}</Text>
              <View style={s.compareBox}>
                <Text style={s.compareLabel}>{t('scan.replaceCurrent')}</Text>
                <Text style={s.compareValue}>{status.currentLabel}</Text>
                <View style={s.compareDivider} />
                <Text style={s.compareLabel}>{t('scan.replaceNext')}</Text>
                <Text style={[s.compareValue, s.compareValueNext]}>
                  {status.nextLabel}
                </Text>
              </View>
              <View style={s.confirmRow}>
                <Pressable
                  style={[s.retryBtn, s.confirmBtn]}
                  onPress={handleRetry}
                  accessibilityRole="button"
                >
                  <Text style={s.retryText}>{t('scan.replaceKeep')}</Text>
                </Pressable>
                <Pressable
                  style={[s.retryBtn, s.confirmBtn, s.confirmBtnPrimary]}
                  onPress={onConfirmReplace}
                  accessibilityRole="button"
                >
                  <Text style={s.confirmTextPrimary}>
                    {t('scan.replaceConfirm')}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={s.hintWrap}>
              <Text style={s.hint}>{t('scan.hint')}</Text>
              <Text style={s.hintSource}>{t('scan.hintSource')}</Text>
            </View>
          )}
        </View>

        <View style={[s.footer, { paddingBottom: footerPadding }]}>
          <Pressable
            style={s.manualBtn}
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={s.manualText}>{t('scan.manualEntry')}</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar style={showsCamera || isDark ? 'light' : 'dark'} />
      {content}
    </Modal>
  )
})

const FRAME_INSET = 16

const s = StyleSheet.create({
  root: { flex: 1 },
  dark: { backgroundColor: '#0C0D0F' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topTitle: { color: colors.white.light, fontSize: 20, fontWeight: '700' },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },

  frame: { alignSelf: 'center' },
  // Vùng quét lùi vào trong, chừa khoảng thở giữa nó và bốn góc ngoặc.
  frameInner: {
    position: 'absolute',
    top: FRAME_INSET,
    left: FRAME_INSET,
    right: FRAME_INSET,
    bottom: FRAME_INSET,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  corner: { position: 'absolute', width: 30, height: 30 },
  cornerNormal: { borderColor: colors.primary.light },
  // Nền camera luôn tối (#0C0D0F) bất kể theme — dùng biến thể .dark của
  // destructive để khớp với khối errorBox bên dưới, cùng nằm trên nền đó.
  cornerBad: { borderColor: colors.destructive.dark },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 7,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 7,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 7,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 7,
  },

  // alignSelf 'stretch' là bắt buộc: cha `center` đặt alignItems 'center' nên
  // mọi con bị co theo nội dung. Thiếu dòng này thì errorBox/compareBox/
  // confirmRow bên trong stretch tới một cái cha đã hẹp, chữ xuống dòng từng
  // từ và tràn khỏi viền.
  hintWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  hint: {
    color: colors.white.light,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  hintSource: {
    color: colors.white.light,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  // Khối lỗi: icon trái, chữ căn trái. Màu destructive chỉ nằm ở icon và viền
  // — tiêu đề để trắng cho dễ đọc trên nền camera, chữ đỏ cỡ lớn vừa khó đọc
  // vừa hét vào mặt khách. Viền và nền pha loãng để không chói.
  errorBox: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${colors.destructive.dark}66`,
    backgroundColor: `${colors.destructive.dark}2E`,
  },
  errorIcon: { marginTop: 2 },
  errorTexts: { flex: 1, gap: 6 },
  errorTitle: {
    color: colors.white.light,
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  errorDetail: { color: colors.white.light, fontSize: 14, lineHeight: 20 },
  // Nội dung thô của QR. Monospace để đọc được từng ký tự, `selectable` để
  // copy ra được thay vì phải chép tay từ ảnh chụp màn hình.
  errorRaw: {
    marginTop: 6,
    color: colors.white.light,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  retryBtn: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 10,
    // Cần cả hai: khi nút nằm trong confirmRow nó nhận flex:1 nên giãn hết
    // chiều ngang, thiếu alignItems thì nhãn dạt về trái.
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  retryText: { color: colors.white.light, fontSize: 13, fontWeight: '600' },

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
  // Mã vừa quét to và đậm hơn mã đang dùng: đây là màn hỏi "có thay không",
  // nhìn ra ngay cái mới thì quyết nhanh hơn.
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

  footer: { paddingHorizontal: 20 },
  manualBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    // Viền trắng đặc, nền trắng pha rất loãng. Hai giá trị rgba này nằm trên
    // nền camera nên cố tình hardcode, cùng lý do với #0C0D0F ở trên: mặt
    // phẳng này không đổi theo theme.
    // borderWidth 1 chứ không hairline: hairline làm viền gần như biến mất.
    borderWidth: 1,
    borderColor: colors.white.light,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  manualText: { color: colors.white.light, fontSize: 16, fontWeight: '600' },

  panel: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  panelBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 8,
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.light,
  },
  primaryBtnText: {
    color: colors.white.light,
    fontSize: 14,
    fontWeight: '600',
  },
  ghostBtn: {
    alignSelf: 'stretch',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '600' },
})
