import AsyncStorage from '@react-native-async-storage/async-storage'
import { router } from 'expo-router'
import { useEffect } from 'react'
import { View } from 'react-native'

export default function Index() {
  useEffect(() => {
    AsyncStorage.getItem('hasSeenOnboarding').then((value) => {
      if (value) {
        router.replace('/(tabs)/home')
      } else {
        router.replace('/onboarding')
      }
    })
  }, [])

  return <View style={{ flex: 1 }} />
}
