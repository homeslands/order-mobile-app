/**
 * usePrimaryColor — primary color từ theme hiện tại.
 * Dùng trong list items (MenuItemRow, CatalogHeaderRow) để tránh truyền primaryColor qua props
 * → renderItem không phụ thuộc primaryColor → không re-render toàn list khi parent re-render vì lý do khác.
 * Khi đổi theme: chỉ các row đang mount (visible) re-render vì chúng subscribe useColorScheme.
 */
import { useColorScheme } from 'react-native'

import { getThemeColor } from '@/lib/utils'

export function usePrimaryColor(): string {
  const isDark = useColorScheme() === 'dark'
  return getThemeColor(isDark).primary
}
