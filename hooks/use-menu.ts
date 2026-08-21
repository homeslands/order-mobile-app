import {
  getPublicSpecificMenu,
  getSpecificMenu,
  getSpecificMenuItem,
} from '@/api/menu'
import { ISpecificMenuRequest } from '@/types/menu.type'
import { useQuery } from '@tanstack/react-query'
import { MENU_QUERY_SKIP_CODES } from '@/lib/global-error-gate'

export const useSpecificMenu = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: ['specific-menu', query],
    queryFn: async () => getSpecificMenu(query),
    enabled: !!enabled,
    staleTime: 30_000,
    meta: { skipGlobalErrorCodes: MENU_QUERY_SKIP_CODES },
  })
}

export const usePublicSpecificMenu = (
  query: ISpecificMenuRequest,
  enabled?: boolean,
) => {
  return useQuery({
    queryKey: ['public-specific-menu', query],
    queryFn: async () => getPublicSpecificMenu(query),
    enabled: !!enabled,
    staleTime: 30_000,
    meta: { skipGlobalErrorCodes: MENU_QUERY_SKIP_CODES },
  })
}

export const useSpecificMenuItem = (slug: string, enabled = true) => {
  return useQuery({
    queryKey: ['specific-menu-item', slug],
    queryFn: async () => getSpecificMenuItem(slug),
    enabled: !!slug && enabled,
    staleTime: 30_000,
  })
}
