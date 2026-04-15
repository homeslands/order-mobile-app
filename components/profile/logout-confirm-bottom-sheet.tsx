/**
 * Bottom sheet xác nhận đăng xuất — logic giống ClearCartBottomSheet / OrderTypeSheet.
 */
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native'

let sheetRef: BottomSheet | null = null
let openCallback: (() => void) | null = null
let isComponentMounted = false

const LogoutConfirmBottomSheetContent = memo(
  function LogoutConfirmBottomSheetContent({
    onCancel,
    onConfirm,
  }: {
    onCancel: () => void
    onConfirm: () => void
    isDark: boolean
  }) {
    const { t } = useTranslation('auth')
    const { t: tCommon } = useTranslation('common')
    return (
      <View className="px-4 pb-5 pt-2">
        <Text className="mb-2 text-base font-semibold text-gray-900 dark:text-gray-50">
          {t('logout.title', 'Đăng xuất')}
        </Text>
        <Text className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          {t('logout.description', 'Bạn có chắc chắn muốn đăng xuất không?')}
        </Text>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={onCancel}
            className="flex-1 items-center justify-center rounded-full border border-gray-300 bg-white py-3 dark:border-gray-600 dark:bg-gray-900"
            activeOpacity={0.8}
          >
            <Text className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {tCommon('common.cancel', 'Huỷ')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onConfirm}
            className="flex-1 items-center justify-center rounded-full py-3"
            activeOpacity={0.8}
            style={{ backgroundColor: '#EF4444' }}
          >
            <Text className="text-sm font-semibold text-white">
              {t('logout.logout', 'Đăng xuất')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  },
)

type Props = {
  onConfirm: () => void
}

const LogoutConfirmBottomSheetBase = ({ onConfirm }: Props) => {
  const isDark = useColorScheme() === 'dark'
  const bottomSheetRef = useRef<BottomSheet>(null)
  const [shouldOpen, setShouldOpen] = useState(false)
  const [_isOpen, setIsOpen] = useState(false)

  const snapPoints = useMemo(() => ['30%'], [])

  // Copy đúng pattern ref + openCallback từ OrderTypeSheet
  useEffect(() => {
    isComponentMounted = true

    const checkAndSetRef = () => {
      const currentRef = bottomSheetRef.current
      if (currentRef && isComponentMounted) {
        sheetRef = currentRef
        openCallback = () => setShouldOpen(true)
        return currentRef
      }
      return null
    }

    checkAndSetRef()
    const timeoutId1 = setTimeout(() => {
      if (isComponentMounted) checkAndSetRef()
    }, 100)
    const timeoutId2 = setTimeout(() => {
      if (isComponentMounted) checkAndSetRef()
    }, 300)

    return () => {
      isComponentMounted = false
      sheetRef = null
      openCallback = null
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
    }
  }, [])

  const handleSheetChanges = useCallback(
    (index: number) => {
      setIsOpen(index >= 0)

      if (index < 0) {
        setShouldOpen(false)
      } else if (index >= 0 && shouldOpen) {
        setShouldOpen(false)
      }
    },
    [shouldOpen],
  )

  // Handle shouldOpen — mở sheet với retry giống OrderTypeSheet
  useEffect(() => {
    if (!shouldOpen) return

    const openSheet = () => {
      if (!bottomSheetRef.current) return false
      try {
        bottomSheetRef.current.snapToIndex(0)
        return true
      } catch {
        return false
      }
    }

    if (openSheet()) return

    const t1 = setTimeout(() => {
      if (shouldOpen && openSheet()) return
    }, 50)
    const t2 = setTimeout(() => {
      if (shouldOpen && openSheet()) return
    }, 100)
    const t3 = setTimeout(() => {
      if (shouldOpen && openSheet()) return
    }, 200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [shouldOpen])

  const close = useCallback(() => {
    if (sheetRef) {
      try {
        sheetRef.close()
      } catch {
        // ignore
      }
    }
  }, [])

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

  const handleConfirm = useCallback(() => {
    close()
    onConfirm()
  }, [close, onConfirm])

  const content = useMemo(
    () => (
      <LogoutConfirmBottomSheetContent
        onCancel={close}
        onConfirm={handleConfirm}
        isDark={isDark}
      />
    ),
    [close, handleConfirm, isDark],
  )

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        enableContentPanningGesture={false}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{
          backgroundColor: isDark ? '#111827' : '#ffffff',
        }}
        containerStyle={styles.container}
      >
        {content}
      </BottomSheet>
    </View>
  )
}

LogoutConfirmBottomSheetBase.displayName = 'LogoutConfirmBottomSheet'

const MemoizedLogoutConfirmBottomSheet = memo(LogoutConfirmBottomSheetBase)

type LogoutConfirmBottomSheetComponent =
  typeof MemoizedLogoutConfirmBottomSheet & {
    open: () => void
  }

const LogoutConfirmBottomSheetTyped =
  MemoizedLogoutConfirmBottomSheet as LogoutConfirmBottomSheetComponent

// Static open — logic giống ClearCartBottomSheet / openOrderTypeSheet
LogoutConfirmBottomSheetTyped.open = () => {
  if (openCallback) {
    openCallback()
  } else if (sheetRef) {
    try {
      sheetRef.snapToIndex(0)
    } catch {
      // ignore
    }
  } else {
    const attempts = [100, 200, 300, 500, 1000]
    attempts.forEach((delay) => {
      setTimeout(() => {
        if (openCallback) {
          openCallback()
        } else if (sheetRef) {
          try {
            sheetRef.snapToIndex(0)
          } catch {
            // ignore
          }
        }
      }, delay)
    })
  }
}

export const LogoutConfirmBottomSheet = LogoutConfirmBottomSheetTyped

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    zIndex: 99999,
    elevation: 99999,
  },
})
