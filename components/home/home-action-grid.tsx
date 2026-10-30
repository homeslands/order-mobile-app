/**
 * HomeActionGrid — các lối tắt một-chạm trên Home, theo ngôn ngữ ZaloPay:
 *
 * 1. Một tấm trắng nổi chứa ba chức năng QR dùng ở quầy. Đi qua useQrActions
 *    (cổng auth, đóng sheet, chặn chạm trùng đều nằm trong hook). Nhãn dùng
 *    đúng chữ của sheet chọn QR ở Profile để một chức năng không mang hai tên.
 * 2. Mục "Tiện ích": Đặt món, Đổi thẻ quà tặng, Lịch sử đơn — chia đều ba cột.
 *
 * Icon hai tông vẽ riêng (home-icons.tsx), không dùng bộ có sẵn. Màu icon đi
 * từ token: nét khung màu chữ, điểm nhấn và mảng lót màu thương hiệu.
 *
 * "Đổi thẻ quà tặng" và "Lịch sử đơn" tự chặn đăng xuất: hai màn đích chỉ đọc
 * userSlug rỗng rồi tắt query, nên không chặn thì khách rơi vào màn trống.
 * Phiên đọc tại thời điểm chạm, cùng vị từ với useQrActions.
 *
 * Nhãn tối đa hai dòng ("Quét QR trả đơn", "Đổi thẻ quà tặng" không vừa một
 * dòng trên màn 320pt). Ô KHÔNG khoá chiều cao: khoá cho đủ hai dòng thì khi
 * nhãn chỉ một dòng, phần thừa dồn xuống đáy và tấm QR trên thưa dưới dày.
 * Các ô cùng hàng flex vẫn tự bằng nhau.
 */
import { memo, useCallback, useMemo, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { View, useColorScheme } from 'react-native'

// Import thẳng file, không qua barrel @/components/navigation: barrel kéo
// theo module native và làm vỡ test.
import { NativeGesturePressable } from '@/components/navigation/native-gesture-pressable'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { hasUsableSession, useQrActions } from '@/hooks/use-qr-actions'
import { navigateNative } from '@/lib/navigation'
import { hexToRgba } from '@/lib/utils'

import {
  CoinPaymentIcon,
  GiftCardIcon,
  MemberIdIcon,
  OrderHistoryIcon,
  OrderIcon,
  ScanPayIcon,
  type HomeIconProps,
} from './home-icons'

type Action = {
  key: string
  label: string
  Icon: ComponentType<HomeIconProps>
  onPress: () => void
}

type IconTone = Omit<HomeIconProps, 'size'>

/**
 * Mỗi ô bọc NativeGesturePressable của repo: thu nhỏ 0.97 bằng
 * SPRING_CONFIGS.press trên UI thread khi chạm — chuẩn phản hồi chạm của app.
 * testID và nhãn trợ năng nằm ở View bên trong vì NativeGesturePressable
 * không nhận hai prop đó.
 */
const QrActionItem = memo(function QrActionItem({
  action,
  tone,
  labelColor,
}: {
  action: Action
  tone: IconTone
  labelColor: string
}) {
  const { key, label, Icon, onPress } = action
  return (
    <NativeGesturePressable onPress={onPress} className="flex-1">
      <View
        testID={`home-action-${key}`}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        className="items-center px-1"
      >
        <Icon size={32} {...tone} />
        <Text
          numberOfLines={2}
          className="mt-2 text-center font-sans"
          style={{ fontSize: 14, color: labelColor }}
        >
          {label}
        </Text>
      </View>
    </NativeGesturePressable>
  )
})

const UtilityItem = memo(function UtilityItem({
  action,
  tone,
  labelColor,
  boxBg,
}: {
  action: Action
  tone: IconTone
  labelColor: string
  boxBg: string
}) {
  const { key, label, Icon, onPress } = action
  return (
    <NativeGesturePressable onPress={onPress} className="flex-1">
      <View
        testID={`home-action-${key}`}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        className="items-center px-1"
      >
        <View
          className="items-center justify-center rounded-xl"
          style={{ width: 56, height: 56, backgroundColor: boxBg }}
        >
          <Icon size={28} {...tone} />
        </View>
        <Text
          numberOfLines={2}
          className="mt-2 text-center font-sans"
          style={{ fontSize: 12, color: labelColor }}
        >
          {label}
        </Text>
      </View>
    </NativeGesturePressable>
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
        Icon: MemberIdIcon,
        onPress: openMemberId,
      },
      {
        key: 'scanPay',
        label: tProfile('profile.qr.scanPay'),
        Icon: ScanPayIcon,
        onPress: openScanPay,
      },
      {
        key: 'coinPayment',
        label: tProfile('profile.qr.coinPayment'),
        Icon: CoinPaymentIcon,
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
        Icon: OrderIcon,
        onPress: openMenu,
      },
      {
        key: 'giftCardRedeem',
        label: t('actions.giftCardRedeem'),
        Icon: GiftCardIcon,
        onPress: openGiftCardRedeem,
      },
      {
        key: 'orderHistory',
        label: t('actions.orderHistory'),
        Icon: OrderHistoryIcon,
        onPress: openOrderHistory,
      },
    ],
    [t, openMenu, openGiftCardRedeem, openOrderHistory],
  )

  const foreground = isDark ? colors.foreground.dark : colors.foreground.light
  const cardBg = isDark ? colors.card.dark : colors.card.light
  const border = isDark ? colors.border.dark : colors.border.light
  // Hai tông từ token: nét khung màu chữ, điểm nhấn màu thương hiệu, mảng lót
  // là màu thương hiệu rất trong.
  const tone = useMemo<IconTone>(
    () =>
      isDark
        ? {
            stroke: colors.foreground.dark,
            accent: colors.primary.dark,
            fill: hexToRgba(colors.primary.dark, 0.24),
          }
        : {
            stroke: colors.foreground.light,
            accent: colors.primary.light,
            fill: hexToRgba(colors.primary.light, 0.16),
          },
    [isDark],
  )

  return (
    <View>
      <View
        testID="home-qr-card"
        className="mx-4 mt-3 flex-row rounded-2xl px-2 py-4"
        // Phẳng, không đổ bóng: thẻ trắng trên nền xám đã tự tách khỏi nền
        // bằng độ tương phản, như thẻ số dư và ô Tiện ích. Ở chế độ tối nền
        // thẻ và nền trang gần nhau nên cần viền.
        style={{
          backgroundColor: cardBg,
          borderWidth: isDark ? 1 : 0,
          borderColor: border,
        }}
      >
        {qrActions.map((a) => (
          <QrActionItem
            key={a.key}
            action={a}
            tone={tone}
            labelColor={foreground}
          />
        ))}
      </View>

      <Text
        className="px-4 pb-3 pt-6 font-sans-semibold"
        style={{ fontSize: 18, color: foreground }}
      >
        {t('utilities')}
      </Text>
      <View testID="home-utilities" className="flex-row px-2">
        {utilities.map((a) => (
          <UtilityItem
            key={a.key}
            action={a}
            tone={tone}
            labelColor={foreground}
            boxBg={cardBg}
          />
        ))}
      </View>
    </View>
  )
})
