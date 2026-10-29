/**
 * HomeActionGrid — lưới sáu ô một-chạm trên Home, 3 cột × 2 hàng.
 *
 * Hàng trên là ba chức năng QR dùng ở quầy, đi qua useQrActions (cổng auth,
 * đóng sheet, chặn chạm trùng đều nằm trong hook). Nhãn dùng đúng chữ của
 * sheet chọn QR ở Profile để một chức năng không mang hai tên.
 *
 * "Đổi thẻ quà tặng" và "Lịch sử đơn" tự chặn đăng xuất: hai màn đích chỉ đọc
 * userSlug rỗng rồi tắt query, nên không chặn thì khách rơi vào màn trống.
 * Phiên đọc tại thời điểm chạm, cùng vị từ với useQrActions.
 *
 * Nhãn tối đa hai dòng và sáu ô cùng một chiều cao: "Quét QR trả đơn" và
 * "Đổi thẻ quà tặng" không vừa một dòng trên màn 320pt ngay ở cỡ chữ mặc định
 * (đo bằng BeVietnamPro_600SemiBold: 97.4pt và 99.7pt, ô rộng 88pt).
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

/**
 * Đủ cho icon 44 + khoảng cách + hai dòng nhãn ở cỡ chữ lớn (×1.1). Cố định
 * để sáu ô luôn bằng nhau dù nhãn một hay hai dòng.
 */
const TILE_HEIGHT = 112
const LABEL_FONT_SIZE = 12

type Tile = {
  key: string
  label: string
  Icon: LucideIcon
  emphasized: boolean
  onPress: () => void
}

const ActionTile = memo(function ActionTile({
  tileKey,
  label,
  Icon,
  emphasized,
  onPress,
  isDark,
}: {
  tileKey: string
  label: string
  Icon: LucideIcon
  emphasized: boolean
  onPress: () => void
  isDark: boolean
}) {
  const primary = isDark ? colors.primary.dark : colors.primary.light
  const foreground = isDark ? colors.foreground.dark : colors.foreground.light
  // Ba ô QR đậm hơn nhưng cùng kích cỡ — để ở quầy mắt tìm nhanh hơn mà lưới
  // vẫn một quy tắc.
  const iconBg = emphasized ? primary : primary + '1f'
  const iconColor = emphasized ? colors.white.light : primary
  const tileBg = isDark ? colors.card.dark : colors.card.light

  return (
    <Pressable
      testID={`home-action-${tileKey}`}
      onPress={onPress}
      className="flex-1 items-center rounded-2xl px-1"
      style={{ height: TILE_HEIGHT, backgroundColor: tileBg, paddingTop: 12 }}
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={22} color={iconColor} />
      </View>
      <Text
        numberOfLines={2}
        className="mt-1.5 text-center font-semibold"
        style={{ fontSize: LABEL_FONT_SIZE, color: foreground }}
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

  const rows = useMemo<Tile[][]>(
    () => [
      [
        {
          key: 'memberId',
          label: tProfile('profile.qr.memberId'),
          Icon: ScanLine,
          emphasized: true,
          onPress: openMemberId,
        },
        {
          key: 'scanPay',
          label: tProfile('profile.qr.scanPay'),
          Icon: ScanQrCode,
          emphasized: true,
          onPress: openScanPay,
        },
        {
          key: 'coinPayment',
          label: tProfile('profile.qr.coinPayment'),
          Icon: QrCode,
          emphasized: true,
          onPress: openCoinPayment,
        },
      ],
      [
        {
          key: 'giftCardRedeem',
          label: t('actions.giftCardRedeem'),
          Icon: Gift,
          emphasized: false,
          onPress: openGiftCardRedeem,
        },
        {
          key: 'orderHistory',
          label: t('actions.orderHistory'),
          Icon: ClipboardList,
          emphasized: false,
          onPress: openOrderHistory,
        },
        {
          key: 'order',
          label: t('actions.order'),
          Icon: Coffee,
          emphasized: false,
          onPress: openMenu,
        },
      ],
    ],
    [
      t,
      tProfile,
      openMemberId,
      openScanPay,
      openCoinPayment,
      openGiftCardRedeem,
      openOrderHistory,
      openMenu,
    ],
  )

  return (
    <View className="mx-4 mt-3 gap-3">
      {rows.map((row, i) => (
        <View key={i} className="flex-row gap-3">
          {row.map((tile) => (
            <ActionTile
              key={tile.key}
              tileKey={tile.key}
              label={tile.label}
              Icon={tile.Icon}
              emphasized={tile.emphasized}
              onPress={tile.onPress}
              isDark={isDark}
            />
          ))}
        </View>
      ))}
    </View>
  )
})
