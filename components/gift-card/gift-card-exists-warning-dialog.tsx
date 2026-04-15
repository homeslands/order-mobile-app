import { BottomSheetBackdrop, type BottomSheetBackdropProps, BottomSheetModal } from '@gorhom/bottom-sheet'
import { TriangleAlert } from 'lucide-react-native'
import { memo, useCallback, useEffect, useRef } from 'react'
import { StyleSheet, Text, useColorScheme, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity as GHTouchable } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { IGiftCard } from '@/types'
import { formatCurrency, formatPoints } from '@/utils'

interface GiftCardExistsWarningDialogProps {
  open: boolean
  currentCard: IGiftCard
  currentQuantity: number
  newCard: IGiftCard
  newQuantity: number
  onCancel: () => void
  onReplace: () => void
}

const SNAP_POINTS = ['50%']

export const GiftCardExistsWarningDialog = memo(
  function GiftCardExistsWarningDialog({
    open,
    currentCard,
    currentQuantity,
    newCard,
    newQuantity,
    onCancel,
    onReplace,
  }: GiftCardExistsWarningDialogProps) {
    const isDark = useColorScheme() === 'dark'
    const insets = useSafeAreaInsets()
    const sheetRef = useRef<BottomSheetModal>(null)

    const textColor = isDark ? colors.gray[50] : colors.gray[900]
    const subColor = isDark ? colors.gray[400] : colors.gray[500]
    const borderColor = isDark ? colors.gray[700] : colors.gray[200]
    const { t } = useTranslation('giftCard')

    useEffect(() => {
      if (open) {
        sheetRef.current?.present()
      } else {
        sheetRef.current?.dismiss()
      }
    }, [open])

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

    const closeSheet = useCallback(() => sheetRef.current?.dismiss(), [])

    const handleReplace = useCallback(() => {
      onReplace()
      closeSheet()
    }, [onReplace, closeSheet])

    return (
          <BottomSheetModal
            ref={sheetRef}
            snapPoints={SNAP_POINTS}
            enablePanDownToClose
            enableContentPanningGesture={false}
            enableHandlePanningGesture
            enableDynamicSizing={false}
            backdropComponent={renderBackdrop}
            backgroundStyle={{ backgroundColor: isDark ? colors.gray[900] : colors.white.light }}
            handleIndicatorStyle={{ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }}
            onDismiss={onCancel}
          >
            <View style={[s.content, { paddingBottom: insets.bottom + 16 }]}>
              {/* Body */}
              <View style={s.body}>
                <TriangleAlert size={32} color={colors.warning.light} />
                <Text style={[s.title, { color: textColor }]}>{t('warningDialog.title')}</Text>

                {/* Card comparison */}
                <View style={[s.comparison, { borderColor }]}>
                  <View style={s.cardRow}>
                    <Text style={[s.cardLabel, { color: subColor }]}>{t('warningDialog.currentCard')}</Text>
                    <Text style={[s.cardName, { color: textColor }]} numberOfLines={1}>
                      {currentCard.title}
                    </Text>
                    <Text style={[s.cardDetail, { color: subColor }]}>
                      {currentQuantity} × {formatPoints(currentCard.points)} điểm ={' '}
                      {formatCurrency(currentCard.price * currentQuantity)}
                    </Text>
                  </View>

                  <View style={[s.divider, { backgroundColor: borderColor }]} />

                  <View style={s.cardRow}>
                    <Text style={[s.cardLabel, { color: subColor }]}>{t('warningDialog.replaceWith')}</Text>
                    <Text style={[s.cardName, { color: textColor }]} numberOfLines={1}>
                      {newCard.title}
                    </Text>
                    <Text style={[s.cardDetail, { color: subColor }]}>
                      {newQuantity} × {formatPoints(newCard.points)} điểm ={' '}
                      {formatCurrency(newCard.price * newQuantity)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Footer buttons */}
              <View style={s.btnRow}>
                <View style={s.btnWrap}>
                  <GHTouchable
                    onPress={closeSheet}
                    activeOpacity={0.8}
                    style={[s.btn, { backgroundColor: isDark ? colors.gray[700] : colors.gray[100] }]}
                  >
                    <Text style={[s.btnText, { color: isDark ? colors.gray[50] : colors.gray[700] }]}>
                      {t('warningDialog.keepCurrent')}
                    </Text>
                  </GHTouchable>
                </View>
                <View style={s.btnWrap}>
                  <GHTouchable
                    onPress={handleReplace}
                    activeOpacity={0.8}
                    style={[s.btn, { backgroundColor: colors.primary.light }]}
                  >
                    <Text style={[s.btnText, { color: colors.white.light }]}>{t('warningDialog.replace')}</Text>
                  </GHTouchable>
                </View>
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
    paddingTop: 8,
    justifyContent: 'space-between',
  },
  body: {
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  comparison: {
    alignSelf: 'stretch',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  cardRow: {
    gap: 2,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cardDetail: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  btnRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 12,
  },
  btnWrap: {
    flex: 1,
  },
  btn: {
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
