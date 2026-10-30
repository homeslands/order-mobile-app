/**
 * HomeActionGrid — các lối tắt một-chạm trên Home, theo ngôn ngữ ZaloPay:
 *
 * 1. Tấm QR bốn ô: ba chức năng QR dùng ở quầy (qua useQrActions — cổng
 *    auth, đóng sheet, chặn chạm trùng đều nằm trong hook) và Thẻ quà (sang
 *    tab Gift Card, mang đúng tên của tab). Nhãn QR dùng đúng chữ của sheet
 *    chọn QR ở Profile — một chức năng không mang hai tên.
 * 2. Mục "Tiện ích" bốn ô: Đặt món, Đổi thẻ quà tặng, Lịch sử đơn, Liên hệ.
 *
 * Icon vẽ riêng (home-icons.tsx), hiện một màu chữ (foreground) — xem `tone`.
 *
 * "Đổi thẻ quà tặng" và "Lịch sử đơn" tự chặn đăng xuất: hai màn đích chỉ đọc
 * userSlug rỗng rồi tắt query, nên không chặn thì khách rơi vào màn trống.
 * Phiên đọc tại thời điểm chạm, cùng vị từ với useQrActions.
 *
 * Nhãn tấm QR phải vừa MỘT dòng trong ô bốn cột (81.8pt trên màn 375pt, chữ
 * 12pt): một nhãn xuống dòng thì hàng cao theo nó và các ô còn lại hở dưới
 * đáy. Nhãn Tiện ích được hai dòng. Ô KHÔNG khoá chiều cao — các ô cùng hàng
 * flex tự bằng nhau.
 */
import { memo, useCallback, useMemo, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Linking, View, useColorScheme } from 'react-native'

// Import thẳng file, không qua barrel @/components/navigation: barrel kéo
// theo module native và làm vỡ test.
import { NativeGesturePressable } from '@/components/navigation/native-gesture-pressable'
import { Text } from '@/components/ui/text'
import { colors } from '@/constants'
import { hotline } from '@/constants/env'
import { hasUsableSession, useQrActions } from '@/hooks/use-qr-actions'
import { navigateNative } from '@/lib/navigation'

import {
  CoinPaymentIcon,
  GiftCardIcon,
  HotlineIcon,
  MemberIdIcon,
  OrderHistoryIcon,
  OrderIcon,
  RedeemGiftIcon,
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
        className="items-center"
      >
        <Icon size={32} {...tone} />
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
          testID={`home-utility-icon-${key}`}
          className="items-center justify-center rounded-full"
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
  const { t: tTabs } = useTranslation('tabs')
  const isDark = useColorScheme() === 'dark'
  const { openMemberId, openScanPay, openCoinPayment } = useQrActions()

  const openGiftCardTab = useCallback(() => {
    navigateNative.navigate('/(tabs)/gift-card')
  }, [])
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
  const callHotline = useCallback(() => {
    if (hotline) void Linking.openURL(`tel:${hotline}`)
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
      {
        key: 'giftCard',
        label: tTabs('tabs.giftCard'),
        Icon: GiftCardIcon,
        onPress: openGiftCardTab,
      },
    ],
    [
      tProfile,
      tTabs,
      openMemberId,
      openScanPay,
      openCoinPayment,
      openGiftCardTab,
    ],
  )

  const utilities = useMemo<Action[]>(() => {
    const list: Action[] = [
      {
        key: 'order',
        label: t('actions.order'),
        Icon: OrderIcon,
        onPress: openMenu,
      },
      {
        key: 'giftCardRedeem',
        label: t('actions.giftCardRedeem'),
        Icon: RedeemGiftIcon,
        onPress: openGiftCardRedeem,
      },
      {
        key: 'orderHistory',
        label: t('actions.orderHistory'),
        Icon: OrderHistoryIcon,
        onPress: openOrderHistory,
      },
    ]
    // Bản build EAS đọc biến môi trường của EAS, không đọc .env ở máy — quên
    // khai báo thì số rỗng. Ẩn ô thay vì để một nút bấm vào không ra gì.
    if (hotline) {
      list.push({
        key: 'hotline',
        label: t('actions.hotline'),
        Icon: HotlineIcon,
        onPress: callHotline,
      })
    }
    return list
  }, [t, openMenu, openGiftCardRedeem, openOrderHistory, callHotline])

  const foreground = isDark ? colors.foreground.dark : colors.foreground.light
  const cardBg = isDark ? colors.card.dark : colors.card.light
  const border = isDark ? colors.border.dark : colors.border.light
  // Một màu: nét và chi tiết đều màu chữ (đen, sang trắng ở chế độ tối), không
  // mảng lót — icon nét kiểu ZaloPay. Bộ icon vẫn nhận ba màu riêng
  // (home-icons.tsx) nên muốn quay lại hai tông chỉ cần đổi ở đây.
  const tone = useMemo<IconTone>(
    () => ({ stroke: foreground, accent: foreground, fill: 'none' }),
    [foreground],
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
