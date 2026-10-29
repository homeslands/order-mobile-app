/**
 * HomeActionGrid — các lối tắt một-chạm trên Home, theo ngôn ngữ ZaloPay:
 *
 * 1. Một tấm trắng nổi chứa ba chức năng QR dùng ở quầy — icon nét để trần,
 *    nhãn chữ tối. Đi qua useQrActions (cổng auth, đóng sheet, chặn chạm
 *    trùng đều nằm trong hook). Nhãn dùng đúng chữ của sheet chọn QR ở
 *    Profile để một chức năng không mang hai tên.
 * 2. Mục "Tiện ích": Đặt món, Đổi thẻ quà tặng, Lịch sử đơn — icon trong ô
 *    rất nhạt có viền mảnh, lưới 4 cột như ZaloPay.
 *
 * "Đổi thẻ quà tặng" và "Lịch sử đơn" tự chặn đăng xuất: hai màn đích chỉ đọc
 * userSlug rỗng rồi tắt query, nên không chặn thì khách rơi vào màn trống.
 * Phiên đọc tại thời điểm chạm, cùng vị từ với useQrActions.
 *
 * Nhãn tối đa hai dòng; các ô trong cùng nhóm có chiều cao cố định để hàng
 * luôn đều: "Quét QR trả đơn" và "Đổi thẻ quà tặng" không vừa một dòng trên
 * màn 320pt (đo bằng BeVietnamPro_600SemiBold: 97.4pt và 99.7pt).
 */
import {
  ClipboardList,
  Coffee,
  Gift,
  QrCode,
  ScanLine,
  ScanQrCode,
  type LucideIcon,
} from 'lucide-react-native'
import { memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View, useColorScheme } from 'react-native'

import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { hasUsableSession, useQrActions } from '@/hooks/use-qr-actions'
import { navigateNative } from '@/lib/navigation'

/** Icon 34 + khoảng cách + hai dòng nhãn 13.5pt ở cỡ chữ lớn (×1.1). */
const QR_ITEM_HEIGHT = 86
/** Ô icon 54 + khoảng cách + hai dòng nhãn 13pt ở cỡ chữ lớn (×1.1). */
const UTILITY_ITEM_HEIGHT = 104
const UTILITY_COLUMNS = 4

type Action = {
  key: string
  label: string
  Icon: LucideIcon
  onPress: () => void
}

const QrActionItem = memo(function QrActionItem({
  action,
  foreground,
}: {
  action: Action
  foreground: string
}) {
  const { key, label, Icon, onPress } = action
  return (
    <Pressable
      testID={`home-action-${key}`}
      onPress={onPress}
      className="flex-1 items-center px-1"
      style={{ height: QR_ITEM_HEIGHT }}
    >
      <Icon size={34} color={foreground} strokeWidth={1.6} />
      <Text
        numberOfLines={2}
        className="mt-2 text-center"
        style={{ fontSize: 13.5, color: foreground }}
      >
        {label}
      </Text>
    </Pressable>
  )
})

const UtilityItem = memo(function UtilityItem({
  action,
  foreground,
  iconColor,
  boxBg,
  boxBorder,
}: {
  action: Action
  foreground: string
  iconColor: string
  boxBg: string
  boxBorder: string
}) {
  const { key, label, Icon, onPress } = action
  return (
    <Pressable
      testID={`home-action-${key}`}
      onPress={onPress}
      className="flex-1 items-center px-0.5"
      style={{ height: UTILITY_ITEM_HEIGHT }}
    >
      <View
        className="items-center justify-center rounded-2xl"
        style={{
          width: 54,
          height: 54,
          backgroundColor: boxBg,
          borderWidth: 1,
          borderColor: boxBorder,
        }}
      >
        <Icon size={26} color={iconColor} strokeWidth={1.8} />
      </View>
      <Text
        numberOfLines={2}
        className="mt-1.5 text-center"
        style={{ fontSize: 13, color: foreground }}
      >
        {label}
      </Text>
    </Pressable>
  )
})

export const HomeActionGrid = memo(function HomeActionGrid() {
  const { t } = useTranslation('home')
  const { t: tProfile } = useTranslation('profile')
  const isDark = useColorScheme() === 'dark'
  const { openMemberId, openScanPay, openCoinPayment } = useQrActions()

  const openGiftCardRedeem = useCallback(() => {
    navigateNative.push(
      hasUsableSession() ? '/gift-card/redeem' : '/auth/login',
    )
  }, [])
  const openOrderHistory = useCallback(() => {
    navigateNative.push(hasUsableSession() ? '/profile/history' : '/auth/login')
  }, [])
  const openMenu = useCallback(() => {
    navigateNative.navigate('/(tabs)/menu')
  }, [])

  const qrActions = useMemo<Action[]>(
    () => [
      {
        key: 'memberId',
        label: tProfile('profile.qr.memberId'),
        Icon: ScanLine,
        onPress: openMemberId,
      },
      {
        key: 'scanPay',
        label: tProfile('profile.qr.scanPay'),
        Icon: ScanQrCode,
        onPress: openScanPay,
      },
      {
        key: 'coinPayment',
        label: tProfile('profile.qr.coinPayment'),
        Icon: QrCode,
        onPress: openCoinPayment,
      },
    ],
    [tProfile, openMemberId, openScanPay, openCoinPayment],
  )

  const utilities = useMemo<Action[]>(
    () => [
      {
        key: 'order',
        label: t('actions.order'),
        Icon: Coffee,
        onPress: openMenu,
      },
      {
        key: 'giftCardRedeem',
        label: t('actions.giftCardRedeem'),
        Icon: Gift,
        onPress: openGiftCardRedeem,
      },
      {
        key: 'orderHistory',
        label: t('actions.orderHistory'),
        Icon: ClipboardList,
        onPress: openOrderHistory,
      },
    ],
    [t, openMenu, openGiftCardRedeem, openOrderHistory],
  )

  const foreground = isDark ? colors.foreground.dark : colors.foreground.light
  const cardBg = isDark ? colors.card.dark : colors.card.light
  const border = isDark ? colors.border.dark : colors.border.light
  // Nâu cà phê cho icon Tiện ích; cam ở chế độ tối để còn tương phản.
  const utilityIcon = isDark ? colors.primary.dark : '#6b3d1b'
  const utilityBorder = isDark ? colors.border.dark : '#efe7dc'
  // Ô trống lấp cho đủ 4 cột, để ô thật giữ đúng bề rộng 1/4 như ZaloPay.
  const fillers = UTILITY_COLUMNS - utilities.length

  return (
    <View>
      <View
        className="mx-4 mt-3.5 flex-row rounded-[18px] px-1.5 pb-1 pt-4"
        style={{
          backgroundColor: cardBg,
          borderWidth: isDark ? 1 : 0,
          borderColor: border,
          shadowColor: '#3a2a1a',
          shadowOpacity: isDark ? 0 : 0.08,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 2 },
          elevation: isDark ? 0 : 3,
        }}
      >
        {qrActions.map((a) => (
          <QrActionItem key={a.key} action={a} foreground={foreground} />
        ))}
      </View>

      <Text
        className="px-4 pb-3 pt-6 font-extrabold"
        style={{ fontSize: 18, color: foreground, letterSpacing: -0.2 }}
      >
        {t('utilities')}
      </Text>
      <View className="flex-row px-2.5">
        {utilities.map((a) => (
          <UtilityItem
            key={a.key}
            action={a}
            foreground={foreground}
            iconColor={utilityIcon}
            boxBg={cardBg}
            boxBorder={utilityBorder}
          />
        ))}
        {Array.from({ length: fillers }, (_, i) => (
          <View key={`filler-${i}`} className="flex-1" />
        ))}
      </View>
    </View>
  )
})
