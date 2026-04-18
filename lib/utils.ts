import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { colors } from '@/constants'

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx (conditional classes) with tailwind-merge (merge conflicting Tailwind classes)
 *
 * @example
 * cn('px-2 py-1', 'bg-red-500', isActive && 'bg-blue-500')
 * // Returns: 'px-2 py-1 bg-blue-500' (bg-red-500 is overridden)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Create a variants helper function for component variants
 *
 * @example
 * const buttonVariants = variants('base-classes', {
 *   default: 'bg-gray-900 text-white',
 *   destructive: 'bg-red-500 text-white',
 * })
 *
 * buttonVariants('destructive') // Returns: 'base-classes bg-red-500 text-white'
 */
export function variants<T extends string>(
  base: string,
  variantMap: Record<T, string>,
) {
  return (variant: T) => {
    return cn(base, variantMap[variant])
  }
}

/**
 * Type for theme colors
 */
export type ThemeColors = {
  primary: string
  background: string
  card: string
  foreground: string
  mutedForeground: string
  border: string
  secondary: string
  indicatorBackground: string // For tab indicator background
}

/**
 * Get color values from CSS variables based on theme
 * Colors are defined in app/global.css
 */
export function getThemeColor(isDark: boolean): ThemeColors {
  return {
    primary: isDark ? colors.primary.dark : colors.primary.light,
    background: isDark ? '#111318' : '#f2f4f6',
    card: isDark ? colors.card.dark : colors.card.light,
    foreground: isDark ? colors.foreground.dark : colors.foreground.light,
    mutedForeground: isDark
      ? colors.mutedForeground.dark
      : colors.mutedForeground.light,
    border: isDark ? colors.border.dark : colors.border.light,
    secondary: isDark ? colors.border.dark : '#f5f5f4',
    indicatorBackground: isDark ? colors.gray[700] : colors.border.light,
  }
}

/**
 * Convert hex color to rgba with opacity
 */
export function hexToRgba(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}
