/**
 * Sheet chỉnh độ trong của Liquid Glass.
 *
 * Ô xem trước đặt một tấm kính thật lên dải màu thương hiệu, để thấy ngay
 * chữ còn đọc được ở mức đang kéo hay không — quyết định này phụ thuộc nền
 * phía sau nên không thể mô tả bằng lời.
 *
 * Trong lúc kéo chỉ đổi state cục bộ; chỉ ghi vào store khi thả tay, tránh
 * vẽ lại mọi bề mặt đang hiện ở từng bước kéo.
 */
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import Slider from '@react-native-community/slider'
import { LinearGradient } from 'expo-linear-gradient'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { GlassSheetBackground } from '@/components/ui/glass-sheet-background'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { useReduceTransparency } from '@/hooks/use-glass-level'
import { useGlassStore } from '@/stores/glass.store'

export const GlassSheet = memo(function GlassSheet({
  visible,
  onClose,
  isDark,
  primaryColor,
}: {
  visible: boolean
  onClose: () => void
  isDark: boolean
  primaryColor: string
}) {
  const sheetRef = useRef<BottomSheetModal>(null)
  const { t } = useTranslation('profile')
  const { bottom } = useSafeAreaInsets()

  const level = useGlassStore((s) => s.level)
  const setLevel = useGlassStore((s) => s.setLevel)
  const [dragging, setDragging] = useState<number | null>(null)
  const reduced = useReduceTransparency()

  const snapPoints = useMemo(() => [330 + bottom], [bottom])

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

  useEffect(() => {
    if (visible) sheetRef.current?.present()
    else sheetRef.current?.dismiss()
  }, [visible])

  const handleComplete = useCallback(
    (value: number) => {
      setDragging(null)
      setLevel(value)
    },
    [setLevel],
  )

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const mutedColor = isDark ? colors.gray[400] : colors.gray[500]
  const cardColor = isDark ? colors.card.dark : colors.white.light
  const shown = dragging ?? level

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableContentPanningGesture={false}
      enableHandlePanningGesture
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundComponent={GlassSheetBackground}
      onDismiss={onClose}
    >
      <View style={[s.content, { paddingBottom: bottom + 8 }]}>
        <Text style={[s.title, { color: textColor }]}>
          {t('profile.glass.title', 'Độ trong của kính')}
        </Text>
        <Text style={[s.subtitle, { color: mutedColor }]}>
          {t('profile.glass.subtitle')}
        </Text>

        <View style={s.preview}>
          <LinearGradient
            colors={[primaryColor, '#8b5cf6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <GlassSurface
            color={cardColor}
            radius={14}
            level={shown}
            style={s.previewGlass}
          >
            <Text style={[s.previewText, { color: textColor }]}>
              {t('profile.glass.preview', 'Xem trước')}
            </Text>
          </GlassSurface>
        </View>

        <View style={s.sliderRow}>
          <Text style={[s.edge, { color: mutedColor }]}>
            {t('profile.glass.solid', 'Đặc')}
          </Text>
          <Slider
            style={s.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={level}
            onValueChange={setDragging}
            onSlidingComplete={handleComplete}
            minimumTrackTintColor={primaryColor}
            maximumTrackTintColor={isDark ? colors.gray[700] : colors.gray[300]}
            thumbTintColor={primaryColor}
          />
          <Text style={[s.edge, { color: mutedColor }]}>
            {t('profile.glass.clear', 'Trong')}
          </Text>
        </View>
        <Text style={[s.percent, { color: mutedColor }]}>
          {Math.round(shown * 100)}%
        </Text>

        {reduced ? (
          <Text style={[s.note, { color: mutedColor }]}>
            {t('profile.glass.reduceTransparencyNote')}
          </Text>
        ) : null}
      </View>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  preview: {
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  previewGlass: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { fontSize: 15, fontWeight: '700' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  slider: { flex: 1, height: 40 },
  edge: { fontSize: 12 },
  percent: {
    fontSize: 12,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginTop: -6,
  },
  note: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 2 },
})
