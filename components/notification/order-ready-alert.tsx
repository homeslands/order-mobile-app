import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFooter,
  type BottomSheetFooterProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import { ShoppingBag } from 'lucide-react-native'
import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet, Text, View, useColorScheme } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Button } from '@/components/ui'
import { colors } from '@/constants'

const SNAP = ['40%']

interface OrderReadyAlertProps {
  visible: boolean
  orderSlug: string
  branchName: string
  referenceNumber: string
  onViewOrder: () => void
  onClose: () => void
}

export const OrderReadyAlert = memo(function OrderReadyAlert({
  visible,
  orderSlug,
  branchName,
  referenceNumber,
  onViewOrder,
  onClose,
}: OrderReadyAlertProps) {
  const { t } = useTranslation('notification')
  const sheetRef = useRef<BottomSheetModal>(null)
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

  const bgStyle = useMemo(
    () => ({ backgroundColor: isDark ? colors.card.dark : colors.card.light }),
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
        opacity={0.55}
        pressBehavior="none"
      />
    ),
    [],
  )

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={bottomInset}>
        <View
          style={[
            s.footer,
            {
              backgroundColor: isDark ? colors.card.dark : colors.card.light,
              borderTopColor: isDark ? colors.border.dark : colors.border.light,
            },
          ]}
        >
          <Button variant="outline" onPress={onClose} className="flex-1">
            {t('alertOrderReadyClose')}
          </Button>
          {orderSlug !== '' ? (
            <Button variant="default" onPress={onViewOrder} className="flex-1">
              {t('alertOrderReadyViewOrder')}
            </Button>
          ) : null}
        </View>
      </BottomSheetFooter>
    ),
    [isDark, bottomInset, orderSlug, onClose, onViewOrder, t],
  )

  const ref = referenceNumber !== ''
    ? `#${referenceNumber}`
    : orderSlug !== ''
      ? `#${orderSlug}`
      : ''
  const body = branchName
    ? t('alertOrderReadyBody', { ref, branch: branchName })
    : t('alertOrderReadyBodyNoBranch', { ref })

  const iconColor = isDark ? colors.primary.dark : colors.primary.light
  const bodyColor = isDark ? colors.gray[200] : colors.gray[700]
  const titleColor = isDark ? colors.foreground.dark : colors.foreground.light

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={SNAP}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={bgStyle}
      footerComponent={renderFooter}
      onDismiss={onClose}
    >
      <BottomSheetScrollView
        contentContainerStyle={s.content}
        scrollEnabled={false}
      >
        <View style={s.header}>
          <ShoppingBag size={22} color={iconColor} />
          <Text style={[s.title, { color: titleColor }]}>
            {t('alertOrderReadyTitle')}
          </Text>
        </View>
        <Text style={[s.body, { color: bodyColor }]}>{body}</Text>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

const s = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 88,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flexShrink: 1,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
