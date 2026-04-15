import { useRouter } from 'expo-router'
import React, { Suspense, lazy, useCallback, useState } from 'react'
import { InteractionManager, Text, TouchableOpacity, View } from 'react-native'

import { useRunAfterTransition } from '@/hooks'

const CartContent = lazy(() => import('@/components/cart/cart-content'))

function CartShell({ onBack }: { onBack: () => void }) {
  return (
    <View className="flex-1 bg-white p-4 dark:bg-black">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-gray-900 dark:text-white">Cart</Text>
        <TouchableOpacity onPress={onBack}>
          <Text className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            Back
          </Text>
        </TouchableOpacity>
      </View>
      <View className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
      <View className="mt-3 h-24 rounded-xl bg-gray-100 dark:bg-gray-800" />
    </View>
  )
}

export default function CartPage() {
  const router = useRouter()
  const [contentReady, setContentReady] = useState(false)

  const showContent = useCallback(() => {
    // Defer den sau transition de tranh mount list/tinh toan khi animation dang chay.
    InteractionManager.runAfterInteractions(() => setContentReady(true))
  }, [])

  useRunAfterTransition(showContent, [], { androidDelayMs: 40 })

  return contentReady ? (
    <Suspense
      fallback={<CartShell onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu'))} />}
    >
      <CartContent />
    </Suspense>
  ) : (
    <CartShell onBack={() => (router.canGoBack() ? router.back() : router.replace('/menu'))} />
  )
}

