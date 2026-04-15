/**
 * Redirect /menu/[slug] → /(tabs)/menu/product/[id] (backward compatibility).
 * Product detail nằm trong tab Menu tại app/(tabs)/menu/product/[id].tsx.
 */
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function MenuSlugRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  return (
    <Redirect
      href={{ pathname: '/(tabs)/menu/product/[id]', params: { id: slug ?? '' } }}
    />
  )
}
