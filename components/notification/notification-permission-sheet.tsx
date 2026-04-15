/**
 * NotificationPermissionSheet — Modal bottom sheet hướng dẫn bật notification.
 *
 * Hiển thị khi user deny permission.
 * Platform-specific instructions (Android Settings / iOS Settings).
 * Dismiss → lưu flag, không hiện lại session này.
 */
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { Bell, Settings } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { colors } from '@/constants'

const SNAP = ['38%']

interface Props {
  visible: boolean
  onClose: () => void
}

export const NotificationPermissionSheet = memo(
  function NotificationPermissionSheet({ visible, onClose }: Props) {
    const { t } = useTranslation('notification')
    const sheetRef = useRef<BottomSheetModal>(null)
    const isDark = useColorScheme() === 'dark'
    const { bottom: bottomInset } = useSafeAreaInsets()

    const bgStyle = useMemo(
      () => ({
        backgroundColor: isDark ? colors.gray[900] : colors.white.light,
      }),
      [isDark],
    )

    useEffect(() => {
      if (visible) {
        sheetRef.current?.present()
      } else {
        sheetRef.current?.dismiss()
      }
    }, [visible])

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.4}
          pressBehavior="close"
        />
      ),
      [],
    )

    const handleOpenSettings = useCallback(() => {
      Linking.openSettings()
      onClose()
    }, [onClose])

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP}
        enablePanDownToClose
        enableContentPanningGesture={false}
        enableHandlePanningGesture
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={bgStyle}
        onDismiss={onClose}
      >
            <View style={[s.content, { paddingBottom: bottomInset + 8 }]}>
              <View style={s.body}>
                <View
                  style={[
                    s.iconWrap,
                    {
                      backgroundColor: isDark
                        ? colors.gray[800]
                        : '#fef3c7',
                    },
                  ]}
                >
                  <Bell size={28} color="#f59e0b" />
                </View>

                <Text
                  style={[
                    s.title,
                    {
                      color: isDark ? colors.gray[50] : colors.gray[900],
                    },
                  ]}
                >
                  {t('enableTitle')}
                </Text>

                <Text
                  style={[
                    s.description,
                    {
                      color: isDark ? colors.gray[400] : colors.gray[500],
                    },
                  ]}
                >
                  {Platform.OS === 'ios'
                    ? t('enableInstructionIos')
                    : t('enableInstructionAndroid')}
                </Text>
              </View>

              <View style={s.spacer} />

              <View style={s.footer}>
                <Pressable
                  onPress={onClose}
                  style={[
                    s.btn,
                    {
                      backgroundColor: isDark
                        ? colors.gray[800]
                        : colors.gray[100],
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.btnText,
                      {
                        color: isDark
                          ? colors.gray[50]
                          : colors.gray[700],
                      },
                    ]}
                  >
                    {t('enableLater')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleOpenSettings}
                  style={[
                    s.btn,
                    { backgroundColor: '#f59e0b' },
                  ]}
                >
                  <Settings size={16} color="#fff" />
                  <Text style={s.settingsText}>{t('enableOpenSettings')}</Text>
                </Pressable>
              </View>
            </View>
      </BottomSheetModal>
    )
  },
)

const s = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  body: {
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  spacer: { flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  settingsText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
})
