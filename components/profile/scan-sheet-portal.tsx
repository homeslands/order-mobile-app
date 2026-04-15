import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { X } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { useUserStore } from '@/stores'
import { useScanSheetStore } from '@/stores/scan-sheet.store'

const QR_SIZE = 220
const SNAP_POINTS = ['62%']

// ─── QR Content ──────────────────────────────────────────────────────────────

const QrContent = memo(function QrContent({
  isDark,
  onClose,
}: {
  isDark: boolean
  onClose: () => void
}) {
  const { t } = useTranslation('profile')
  const userInfo = useUserStore((s) => s.userInfo)

  const primary = isDark ? colors.primary.dark : colors.primary.light
  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[500]
  const qrBg = isDark ? colors.gray[800] : colors.white.light

  const fullName = [userInfo?.firstName, userInfo?.lastName]
    .filter(Boolean)
    .join(' ')

  const slug = userInfo?.slug ?? null

  return (
    <View style={s.content}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: textColor }]}>{t('profile.qr.title')}</Text>
        <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
          <X size={20} color={mutedColor} />
        </Pressable>
      </View>

      {/* Subtitle */}
      <Text style={[s.subtitle, { color: mutedColor }]}>
        {t('profile.qr.subtitle')}
      </Text>

      {/* QR Container */}
      <View style={[s.qrWrap, { backgroundColor: qrBg }]}>
        <View style={[s.corner, s.cornerTL, { borderColor: primary }]} />
        <View style={[s.corner, s.cornerTR, { borderColor: primary }]} />
        <View style={[s.corner, s.cornerBL, { borderColor: primary }]} />
        <View style={[s.corner, s.cornerBR, { borderColor: primary }]} />
        {slug ? (
          <QRCode
            value={slug}
            size={QR_SIZE}
            color={isDark ? colors.gray[50] : colors.gray[900]}
            backgroundColor="transparent"
          />
        ) : (
          <View style={s.qrPlaceholder}>
            <Text style={[s.errorText, { color: mutedColor }]}>
              {t('profile.qr.notLoggedIn')}
            </Text>
          </View>
        )}
      </View>

      {/* User info */}
      {fullName ? (
        <Text style={[s.userName, { color: textColor }]} numberOfLines={1}>
          {fullName}
        </Text>
      ) : null}
      {userInfo?.phonenumber ? (
        <Text style={[s.userPhone, { color: mutedColor }]} numberOfLines={1}>
          {userInfo.phonenumber}
        </Text>
      ) : null}
    </View>
  )
})

// ─── Portal ───────────────────────────────────────────────────────────────────

const ScanSheetPortal = memo(function ScanSheetPortal() {
  const { visible, close } = useScanSheetStore()
  const sheetRef = useRef<BottomSheetModal>(null)
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

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

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      onDismiss={close}
    >
      <BottomSheetScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: bottomInset + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <QrContent isDark={isDark} onClose={() => sheetRef.current?.dismiss()} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  scroll: { flexGrow: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 4,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: 0,
    padding: 4,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  qrWrap: {
    width: QR_SIZE + 40,
    height: QR_SIZE + 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
  },
  cornerTL: {
    top: 10,
    left: 10,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 7,
  },
  cornerTR: {
    top: 10,
    right: 10,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 7,
  },
  cornerBL: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 7,
  },
  cornerBR: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 7,
  },
  qrPlaceholder: {
    width: QR_SIZE,
    height: QR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  userPhone: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
})

export default ScanSheetPortal
