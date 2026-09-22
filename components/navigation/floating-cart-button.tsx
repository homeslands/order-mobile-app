import { ShoppingCart } from 'lucide-react-native'
import React, { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import { TAB_ROUTES } from '@/constants/navigation.config'
import { useGlassEnabled } from '@/hooks/use-glass'
import { useOrderFlowCartItemCount } from '@/stores/selectors'

import { NativeGesturePressable } from './native-gesture-pressable'
import { GlassSurface } from '@/components/ui/glass-surface'
import { Text } from '@/components/ui/text'

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
  const glass = useGlassEnabled()
  const orderFlowCount = useOrderFlowCartItemCount()
  const cartItemCount = countOverride ?? orderFlowCount

  const buttonStyle = useMemo(
    () => ({
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      ...(!glass && {
        shadowColor: primaryColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      }),
    }),
    [glass, primaryColor],
  )

  return (
    <NativeGesturePressable
      navigation={{ type: 'push', href: href ?? TAB_ROUTES.CART }}
      style={buttonStyle}
    >
      <GlassSurface
        color={primaryColor}
        tint={primaryColor}
        radius={32}
        interactive
        style={StyleSheet.absoluteFill}
      />
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
