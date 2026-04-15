import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
} from '@gorhom/bottom-sheet'
import { TriangleAlert } from 'lucide-react-native'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { colors } from '@/constants'
import { useDeleteOrder } from '@/hooks'
import type { IOrder } from '@/types'
import { showToast } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'

const SNAP_POINTS = ['38%']

interface CancelOrderDialogProps {
  order: IOrder
  /** Override trigger — if not provided, renders default button */
  renderTrigger?: (onOpen: () => void) => React.ReactNode
}

function CancelOrderDialogComponent({
  order,
  renderTrigger,
}: CancelOrderDialogProps) {
  const { t: tToast } = useTranslation('toast')
  const { t } = useTranslation(['menu'])
  const { t: tCommon } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  const { mutate: deleteOrder, isPending: isDeleting } = useDeleteOrder()
  const queryClient = useQueryClient()
  const isDark = useColorScheme() === 'dark'
  const { bottom: bottomInset } = useSafeAreaInsets()

  const sheetRef = useRef<BottomSheetModal>(null)
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleOpen = useCallback(() => setVisible(true), [])
  const handleClose = useCallback(() => setVisible(false), [])

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (visible) {
      sheetRef.current?.present()
    } else {
      sheetRef.current?.dismiss()
    }
  }, [visible])

  const handleConfirm = useCallback(() => {
    if (!order?.slug || isDeleting) return
    deleteOrder(order.slug, {
      onSuccess: () => {
        if (successTimerRef.current) clearTimeout(successTimerRef.current)
        successTimerRef.current = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['orders'] })
          queryClient.invalidateQueries({ queryKey: ['order', order.slug] })
          showToast(tToast('toast.handleCancelOrderSuccess'))
          setVisible(false)
          successTimerRef.current = null
        }, 500)
      },
    })
  }, [order, isDeleting, deleteOrder, queryClient, tToast])

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

  const textColor = isDark ? colors.gray[50] : colors.gray[900]
  const subColor = isDark ? colors.gray[400] : colors.gray[500]
  const borderColor = isDark ? colors.gray[700] : colors.gray[200]
  const destructiveColor = isDark
    ? colors.destructive.dark
    : colors.destructive.light

  return (
    <>
      {renderTrigger ? renderTrigger(handleOpen) : (
        <Pressable
          onPress={handleOpen}
          style={[s.defaultTrigger, { backgroundColor: destructiveColor }]}
        >
          <Text style={s.defaultTriggerText}>
            {t('order.cancelOrder', 'Huỷ đơn')}
          </Text>
        </Pressable>
      )}

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={SNAP_POINTS}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={bgStyle}
        handleIndicatorStyle={{ backgroundColor: isDark ? colors.gray[600] : colors.gray[300] }}
        onDismiss={handleClose}
      >
              <View style={s.sheetInner}>
                <View style={s.content}>
                  <View style={s.iconRow}>
                    <View style={s.iconWrap}>
                      <TriangleAlert size={24} color={destructiveColor} />
                    </View>
                    <Text style={[s.title, { color: textColor }]}>
                      {t('order.cancelOrder', 'Huỷ đơn hàng')}
                    </Text>
                  </View>

                  <Text style={[s.desc, { color: subColor }]}>
                    {t(
                      'order.cancelOrderWarning',
                      'Đơn hàng sẽ bị huỷ và không thể hoàn tác. Bạn có chắc chắn muốn huỷ?',
                    )}
                  </Text>
                </View>

                <View style={[s.footer, { borderTopColor: borderColor, paddingBottom: bottomInset + 12 }]}>
                  <Pressable
                    onPress={handleClose}
                    disabled={isDeleting}
                    style={[s.cancelBtn, { backgroundColor: isDark ? colors.gray[800] : colors.gray[100] }]}
                  >
                    <Text style={[s.cancelBtnText, { color: textColor }]}>
                      {tCommon('common.cancel', 'Quay lại')}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleConfirm}
                    disabled={isDeleting}
                    style={[s.confirmBtn, { backgroundColor: destructiveColor, opacity: isDeleting ? 0.7 : 1 }]}
                  >
                    {isDeleting
                      ? <ActivityIndicator size="small" color={colors.white.light} />
                      : (
                        <Text style={s.confirmBtnText}>
                          {tCommon('common.confirmCancel', 'Xác nhận huỷ')}
                        </Text>
                      )
                    }
                  </Pressable>
                </View>
              </View>
      </BottomSheetModal>
    </>
  )
}

export default React.memo(CancelOrderDialogComponent)

const s = StyleSheet.create({
  defaultTrigger: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultTriggerText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white.light,
  },
  sheetInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  desc: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white.light,
  },
})
