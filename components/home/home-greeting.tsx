/**
 * HomeGreeting — dòng lời chào ngay dưới banner trên Home, thay cho header
 * logo: ảnh đại diện, "Xin chào, <tên>", và chuông thông báo.
 *
 * Cuộn theo nội dung như ZaloPay, không ghim trên cùng. Chưa đăng nhập thì chỉ
 * "Xin chào" — lời mời đăng nhập đã nằm trên thẻ số dư ngay bên dưới.
 *
 * Ảnh đại diện dùng đúng quy tắc URL của màn Profile: đường dẫn tương đối thì
 * ghép `publicFileURL`, URL tuyệt đối thì dùng thẳng.
 */
import { Image } from 'expo-image'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { View, useColorScheme } from 'react-native'

import { NotificationBell } from '@/components/notification/notification-bell'
import { Text } from '@/components/ui/text'
import { colors, publicFileURL } from '@/constants'
import { useUserStore } from '@/stores'

const AVATAR_SIZE = 40

function avatarUri(image: string): string {
  return /^https?:\/\//i.test(image)
    ? image
    : `${publicFileURL}/${image.replace(/^\//, '')}`
}

export const HomeGreeting = memo(function HomeGreeting() {
  const { t } = useTranslation('home')
  const isDark = useColorScheme() === 'dark'
  const firstName = useUserStore((s) => s.userInfo?.firstName)
  const image = useUserStore((s) => s.userInfo?.image)

  const foreground = isDark ? colors.foreground.dark : colors.foreground.light
  const muted = isDark
    ? colors.mutedForeground.dark
    : colors.mutedForeground.light
  // Avatar nền kem chữ nâu, không dùng cam: trên Home chỉ thẻ Xu được là
  // mảng màu đậm.
  const avatarBg = isDark ? '#3a2f25' : '#f4e9da'
  const avatarText = isDark ? '#e8b57c' : '#6b3d1b'
  // Nền nút chuông: xám rất nhạt như ZaloPay, tách khỏi nền trang trắng.
  const bellBg = isDark ? colors.card.dark : '#f3f1ee'

  return (
    <View className="flex-row items-center px-4 pb-1 pt-3.5">
      <View
        className="items-center justify-center overflow-hidden rounded-full"
        style={{
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          backgroundColor: avatarBg,
        }}
      >
        {image ? (
          <Image
            source={{
              uri: avatarUri(image),
              width: AVATAR_SIZE * 2,
              height: AVATAR_SIZE * 2,
            }}
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
            contentFit="cover"
            cachePolicy="disk"
          />
        ) : (
          <Text
            className="font-bold"
            style={{ fontSize: 16, color: avatarText }}
          >
            {firstName ? firstName.charAt(0).toUpperCase() : ''}
          </Text>
        )}
      </View>

      <View className="ml-3 flex-1">
        {firstName ? (
          <>
            <Text style={{ fontSize: 12, color: muted }}>
              {`${t('greeting.hello')},`}
            </Text>
            <Text
              className="font-bold"
              style={{ fontSize: 16, color: foreground }}
              numberOfLines={1}
            >
              {firstName}
            </Text>
          </>
        ) : (
          <Text
            className="font-bold"
            style={{ fontSize: 16, color: foreground }}
          >
            {t('greeting.hello')}
          </Text>
        )}
      </View>

      <View
        className="items-center justify-center rounded-full"
        style={{ width: 40, height: 40, backgroundColor: bellBg }}
      >
        <NotificationBell color={foreground} size={20} />
      </View>
    </View>
  )
})
