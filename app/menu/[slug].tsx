/**
 * Redirect /menu/[slug] → /product/[id] (backward compatibility).
 * Product detail nằm ở stack gốc tại app/product/[id].tsx.
 */
import { Redirect, useLocalSearchParams } from 'expo-router'

export default function MenuSlugRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  return (
    <Redirect
      href={{
        pathname: '/product/[id]',
        params: { id: slug ?? '' },
      }}
    />
  )
}
