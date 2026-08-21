import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

import { needsProfileCompletion } from '@/utils/auth-helpers'

export default function Index() {
  useEffect(() => {
    AsyncStorage.getItem('hasSeenOnboarding').then((value) => {
      if (!value) {
        router.replace('/onboarding')
        return
      }
      // Hồ sơ thiếu họ / tên / ngày sinh thì quay lại bước hoàn tất, không cho
      // vào app. Xem needsProfileCompletion() để biết vì sao cần cổng này.
      if (needsProfileCompletion()) {
        router.replace('/auth/register/profile')
        return
      }
      router.replace('/(tabs)/home')
    })
  }, [])

  return <View style={{ flex: 1 }} />
}
