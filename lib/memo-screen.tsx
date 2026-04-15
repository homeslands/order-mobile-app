import React, { type ComponentType, type FC } from 'react'

/**
 * Wraps a screen component with React.memo to prevent unnecessary re-renders
 * during navigation (e.g. when parent layout or context updates but screen props
 * are unchanged). Keeps the UI thread free for 60fps transitions.
 *
 * Use for route screens that receive stable props (e.g. from Native Stack).
 * Ensure navigation params/options don't pass new object/function refs every
 * render — use route.params or context for dynamic data.
 *
 * @example
 * function ProductDetailScreen() {
 *   return <ProductDetailContent />
 * }
 * ProductDetailScreen.displayName = 'ProductDetailScreen'
 * export default memoScreen(ProductDetailScreen)
 */
export function memoScreen<P extends object>(
  Component: ComponentType<P>,
  displayName?: string,
): FC<P> {
  const Memoized = React.memo(Component) as FC<P>
  if (displayName) {
    Memoized.displayName = displayName
  } else if (Component.displayName) {
    Memoized.displayName = `Memo(${Component.displayName})`
  }
  return Memoized
}
