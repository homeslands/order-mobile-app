/**
 * Khung camera quét QR dùng chung, chiếm toàn bộ chỗ của bên chứa.
 *
 * Không biết gì về voucher hay thanh toán: bên gọi đưa vào hàm lọc chuỗi
 * (`parse`), nhãn chữ, trạng thái và phần chân màn. Component chỉ lo quyền
 * camera, khung ngắm, khoá chống quét trùng, haptic và khối lỗi có nút
 * "Quét lại".
 *
 * Không tự bọc Modal hay route. Màn voucher bọc trong Modal để giữ state
 * của sheet bên dưới; màn thanh toán xu là một route riêng.
 */
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { StatusBar } from 'expo-status-bar'
import { Camera, CameraOff, TriangleAlert, X } from 'lucide-react-native'
import { memo, useCallback, useRef, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { FOOTER_BOTTOM_EXTRA, STATIC_TOP_INSET } from '@/constants/status-bar'

export type QrCameraStatus =
  /** Chưa quét gì — hiện hướng dẫn. */
  | { kind: 'idle' }
  /** Đang xử lý mã vừa quét (tra cứu, áp dụng…). */
  | { kind: 'busy'; label: string }
  /** Bên gọi báo lỗi — khung đỏ, kèm nút "Quét lại". */
  | { kind: 'error'; title: string; detail?: string }

export type QrCameraLabels = {
  title: string
  closeA11y: string
  hint: string
  hintSource?: string
  /** Tiêu đề khi `parse` trả null — mã chắc chắn không đúng loại. */
  rejectedTitle: string
  rejectedHint: string
  retry: string
  permTitle: string
  permBody: string
  permDeniedTitle: string
  permDeniedBody: string
  permAllow: string
  openSettings: string
  /** Nút phụ trên panel xin quyền — gọi `onClose`. */
  permDismiss: string
}

type QrCameraProps = {
  labels: QrCameraLabels
  /**
   * Lọc chuỗi thô đọc từ camera. Trả chuỗi đã lọc, hoặc null nếu chắc chắn
   * không phải loại mã cần quét — khi đó báo lỗi tại chỗ, không gọi
   * `onScanned`.
   */
  parse: (raw: string) => string | null
  /**
   * Nhận chuỗi đã lọc. Khoá quét KHÔNG tự mở sau khi gọi — bên gọi mở lại
   * bằng cách đưa status `error` (khách bấm "Quét lại") hoặc unmount.
   */
  onScanned: (value: string) => void
  status: QrCameraStatus
  /** Khách bấm "Quét lại" — khoá đã mở, bên gọi xoá kết quả cũ. */
  onRetry: () => void
  onClose: () => void
  /**
   * Thay khối giữa màn khi bên gọi cần nội dung riêng (voucher: hỏi thay
   * mã). `retry` mở khoá và gọi `onRetry`, dùng cho nút "giữ nguyên".
   */
  renderCenter?: (retry: () => void) => ReactNode
  footer?: ReactNode
}

const BARCODE_SETTINGS = { barcodeTypes: ['qr' as const] }
const FRAME_MAX = 300
const FRAME_RATIO = 0.68

export const QrCamera = memo(function QrCamera({
  labels,
  parse,
  onScanned,
  status,
  onRetry,
  onClose,
  renderCenter,
  footer,
}: QrCameraProps) {
  const [permission, requestPermission] = useCameraPermissions()
  /** Chuỗi thô vừa bị `parse` từ chối — hiện lên để biết QR thật chứa gì. */
  const [rejectedRaw, setRejectedRaw] = useState<string | null>(null)
  const isDark = useColorScheme() === 'dark'
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  // Chốt một chiều. onBarcodeScanned bắn nhiều lần mỗi giây khi mã còn nằm
  // trong khung; dùng state cho chốt này sẽ kéo theo re-render và vẫn để lọt
  // lần bắn thứ hai trong cùng một frame.
  const lockRef = useRef(false)

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (lockRef.current) return
      lockRef.current = true

      const value = parse(data)
      if (value === null) {
        setRejectedRaw(data)
        return
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      onScanned(value)
    },
    [parse, onScanned],
  )

  const handleRetry = useCallback(() => {
    lockRef.current = false
    setRejectedRaw(null)
    onRetry()
  }, [onRetry])

  const handleOpenSettings = useCallback(() => {
    Linking.openSettings()
  }, [])

  const handleRequestPermission = useCallback(() => {
    void requestPermission().catch(() => {})
  }, [requestPermission])

  const frameSize = Math.min(width * FRAME_RATIO, FRAME_MAX)
  const footerPadding = insets.bottom + FOOTER_BOTTOM_EXTRA
  // Nền camera luôn tối; panel xin quyền thì theo theme.
  const showsCamera = !permission || permission.granted
  const rejected = rejectedRaw !== null

  let content: ReactNode

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
          {blocked ? labels.permDeniedTitle : labels.permTitle}
        </Text>
        <Text style={[s.panelBody, { color: bodyColor }]}>
          {blocked ? labels.permDeniedBody : labels.permBody}
        </Text>
        <Pressable
          style={s.primaryBtn}
          onPress={blocked ? handleOpenSettings : handleRequestPermission}
        >
          <Text style={s.primaryBtnText}>
            {blocked ? labels.openSettings : labels.permAllow}
          </Text>
        </Pressable>
        <Pressable
          style={[s.ghostBtn, { borderColor: panelBorder }]}
          onPress={onClose}
        >
          <Text style={[s.ghostBtnText, { color: ghostTextColor }]}>
            {labels.permDismiss}
          </Text>
        </Pressable>
      </View>
    )
  } else {
    // Khung góc chuyển đỏ cho cả mã sai định dạng lẫn lỗi do bên gọi báo.
    const hasError = rejected || status.kind === 'error'
    const cornerTone = hasError ? s.cornerBad : s.cornerNormal

    let center: ReactNode
    if (rejected) {
      // Mã sai loại — bắt tại chỗ, chưa hề gọi lên bên trên.
      center = (
        <View style={s.hintWrap}>
          <View style={s.errorBox}>
            <TriangleAlert
              size={22}
              color={colors.destructive.dark}
              style={s.errorIcon}
            />
            <View style={s.errorTexts}>
              <Text style={s.errorTitle}>{labels.rejectedTitle}</Text>
              <Text style={s.errorDetail}>{labels.rejectedHint}</Text>
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
            <Text style={s.retryText}>{labels.retry}</Text>
          </Pressable>
        </View>
      )
    } else if (renderCenter) {
      // handleRetry chỉ được bên gọi dùng làm onPress (event handler), không
      // bao giờ gọi ngay trong lúc render — nhưng eslint không suy ra được
      // điều đó qua một render-prop nên tắt cảnh báo tại đây.
      // eslint-disable-next-line react-hooks/refs
      center = renderCenter(handleRetry)
    } else if (status.kind === 'busy') {
      center = (
        <View style={s.hintWrap}>
          <ActivityIndicator color={colors.primary.light} />
          <Text style={s.hint}>{status.label}</Text>
        </View>
      )
    } else if (status.kind === 'error') {
      center = (
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
            <Text style={s.retryText}>{labels.retry}</Text>
          </Pressable>
        </View>
      )
    } else {
      center = (
        <View style={s.hintWrap}>
          <Text style={s.hint}>{labels.hint}</Text>
          {labels.hintSource ? (
            <Text style={s.hintSource}>{labels.hintSource}</Text>
          ) : null}
        </View>
      )
    }

    content = (
      <View style={[s.root, s.dark]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={BARCODE_SETTINGS}
          onBarcodeScanned={handleBarcodeScanned}
        />

        <View style={[s.topBar, { paddingTop: STATIC_TOP_INSET + 8 }]}>
          <Text style={s.topTitle}>{labels.title}</Text>
          <Pressable
            style={s.closeBtn}
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel={labels.closeA11y}
          >
            <X size={20} color={colors.white.light} />
          </Pressable>
        </View>

        <View style={s.center}>
          <View style={[s.frame, { width: frameSize, height: frameSize }]}>
            <View style={s.frameInner} />
            <View style={[s.corner, s.cornerTL, cornerTone]} />
            <View style={[s.corner, s.cornerTR, cornerTone]} />
            <View style={[s.corner, s.cornerBL, cornerTone]} />
            <View style={[s.corner, s.cornerBR, cornerTone]} />
          </View>
          {center}
        </View>

        <View style={[s.footer, { paddingBottom: footerPadding }]}>
          {footer}
        </View>
      </View>
    )
  }

  return (
    <>
      <StatusBar style={showsCamera || isDark ? 'light' : 'dark'} />
      {content}
    </>
  )
})

const FRAME_INSET = 16

const s = StyleSheet.create({
  root: { flex: 1 },
  // Nền camera cố tình hardcode: mặt phẳng này không đổi theo theme.
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
  // Nền camera luôn tối — dùng biến thể .dark của destructive để khớp khối
  // errorBox, cùng nằm trên nền đó.
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
  // mọi con bị co theo nội dung, chữ bên trong sẽ xuống dòng từng từ.
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
  // Màu destructive chỉ ở icon và viền — chữ đỏ cỡ lớn trên nền camera vừa
  // khó đọc vừa hét vào mặt khách.
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
  // Monospace để đọc được từng ký tự, `selectable` để copy ra được.
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  retryText: { color: colors.white.light, fontSize: 13, fontWeight: '600' },

  footer: { paddingHorizontal: 20 },

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

/** Style dùng lại cho nội dung `renderCenter` của bên gọi. */
export const qrCameraStyles = {
  hintWrap: s.hintWrap,
  hint: s.hint,
  retryBtn: s.retryBtn,
  retryText: s.retryText,
}
