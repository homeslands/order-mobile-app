import { ShoppingCart } from 'lucide-react-native'
import React, { useMemo } from 'react'
import { Text, View } from 'react-native'

import { TAB_ROUTES } from '@/constants/navigation.config'
import { useOrderFlowCartItemCount } from '@/stores/selectors'

import { NativeGesturePressable } from './native-gesture-pressable'

type Props = {
  primaryColor: string
  /** Override cart route (e.g. perf cart) */
  href?: string
  /** Override badge count (e.g. perf cart count) */
  countOverride?: number
}

const FloatingCartButton = React.memo(function FloatingCartButton({
  primaryColor,
  href,
  countOverride,
}: Props) {
  const orderFlowCount = useOrderFlowCartItemCount()
  const cartItemCount = countOverride ?? orderFlowCount

  const buttonStyle = useMemo(
    () => ({
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: primaryColor,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      shadowColor: primaryColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    }),
    [primaryColor],
  )

  return (
    <NativeGesturePressable
      navigation={{ type: 'push', href: href ?? TAB_ROUTES.CART }}
      style={buttonStyle}
    >
      <ShoppingCart size={24} color="#ffffff" />
      {cartItemCount > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            minWidth: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#ef4444',
            borderWidth: 2,
            borderColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 5,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>
            {cartItemCount > 99 ? '99+' : cartItemCount}
          </Text>
        </View>
      )}
    </NativeGesturePressable>
  )
})

export { FloatingCartButton }
