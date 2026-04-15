import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { QrCode, ScanLine } from 'lucide-react-native'
import { scheduleTransitionTask } from '@/lib/navigation'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { useQRSelectionSheetStore } from '@/stores/qr-selection-sheet.store'
import { useScanSheetStore } from '@/stores/scan-sheet.store'

const SNAP_POINTS = ['38%']

// ─── Option Card ──────────────────────────────────────────────────────────────

const OptionCard = memo(function OptionCard({
  icon: Icon,
  title,
  desc,
  onPress,
  primary,
  textColor,
  mutedColor,
  cardBg,
}: {
  icon: typeof ScanLine
  title: string
  desc: string
  onPress: () => void
  primary: string
  textColor: string
  mutedColor: string
  cardBg: string
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[s.optionCard, { backgroundColor: cardBg }]}
    >
      <View style={[s.iconCircle, { backgroundColor: `${primary}18` }]}>
        <Icon size={22} color={primary} />
      </View>
      <View style={s.optionTexts}>
        <Text style={[s.optionTitle, { color: textColor }]}>{title}</Text>
        <Text style={[s.optionDesc, { color: mutedColor }]}>{desc}</Text>
      </View>
    </TouchableOpacity>
  )
})

// ─── Portal ───────────────────────────────────────────────────────────────────

const QRSelectionSheet = memo(function QRSelectionSheet() {
  // Fix 3: per-slice selectors to avoid full-store subscription
  const visible = useQRSelectionSheetStore((s) => s.visible)
  const close = useQRSelectionSheetStore((s) => s.close)
  const openScanSheet = useScanSheetStore((s) => s.open)
  const sheetRef = useRef<BottomSheetModal>(null)
  const isDark = useColorScheme() === 'dark'
  const { bottom } = useSafeAreaInsets()
  const router = useRouter()

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.gray[900] : colors.white.light }),
    [isDark],
  )

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  )

  const handleMemberCard = useCallback(() => {
    close()
    scheduleTransitionTask(openScanSheet)
  }, [close, openScanSheet])

  const handlePaymentQR = useCallback(() => {
    close()
    scheduleTransitionTask(() => router.push('/payment/qr-generate'))
  // router intentionally omitted — push destination is a string literal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [close])

  const contentStyle = useMemo(
    () => [s.content, { paddingBottom: bottom + 24 }],
    [bottom],
  )

  // Fix 7: useMemo for color derivations
  const { primary, textColor, mutedColor, cardBg } = useMemo(
    () => ({
      primary: isDark ? colors.primary.dark : colors.primary.light,
      textColor: isDark ? colors.gray[50] : colors.gray[900],
      mutedColor: isDark ? colors.gray[400] : colors.gray[500],
      cardBg: isDark ? colors.gray[800] : colors.gray[50],
    }),
    [isDark],
  )

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enableDynamicSizing={false}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={close}
    >
      <BottomSheetScrollView
        contentContainerStyle={contentStyle}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.title, { color: textColor }]}>Chọn loại QR</Text>
        <Text style={[s.subtitle, { color: mutedColor }]}>
          Chọn hình thức QR phù hợp với yêu cầu của bạn
        </Text>

        <View style={s.optionsList}>
          <OptionCard
            icon={ScanLine}
            title="Mã định danh"
            desc="Nhân viên quét mã tại quầy"
            onPress={handleMemberCard}
            primary={primary}
            textColor={textColor}
            mutedColor={mutedColor}
            cardBg={cardBg}
          />
          <OptionCard
            icon={QrCode}
            title="Thanh toán Xu"
            desc="Quét QR để thanh toán bằng xu"
            onPress={handlePaymentQR}
            primary={primary}
            textColor={textColor}
            mutedColor={mutedColor}
            cardBg={cardBg}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionTexts: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
})

export default QRSelectionSheet
