import { getPublicSpecificMenu, getSpecificMenu } from '@/api/menu'
import { Role } from '@/constants'
import { useBranchStore, useOrderFlowStore, useUserStore } from '@/stores'
import { cartActions } from '@/stores/cart.store'
import type { IMenuItem, IOrderItem, IProductVariant } from '@/types'
import { showToast } from '@/utils'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'

export interface CartValidationResult {
  removed: string[]
  updated: string[]
  isValid: boolean
}

/**
 * Validate cart items against today's menu.
 * - Removes items whose product is no longer on the menu or is locked
 * - Swaps variant if slug changed but same size still exists
 * - Updates price if variant price changed
 * - Updates promotion from today's menu
 *
 * Returns { removed, updated, isValid }
 */
function validateCartItems(
  cartItems: IOrderItem[],
  menuItems: IMenuItem[],
): CartValidationResult {
  // Build lookup: productSlug → menuItem
  const menuMap = new Map<string, IMenuItem>()
  for (const mi of menuItems) {
    if (mi.product?.slug) menuMap.set(mi.product.slug, mi)
  }

  const removed: string[] = []
  const updated: string[] = []

  for (const cartItem of cartItems) {
    const productSlug = cartItem.productSlug || cartItem.slug
    const menuItem = menuMap.get(productSlug)

    // CASE A: Product not in today's menu at all
    if (!menuItem) {
      removed.push(cartItem.name || productSlug)
      continue
    }

    // CASE B: Product is locked (out of stock / admin lock)
    if (menuItem.isLocked) {
      removed.push(cartItem.name || productSlug)
      continue
    }

    const variants = menuItem.product?.variants || []
    const sizeName = (cartItem.variant?.size?.name || cartItem.size || '')
      .toLowerCase()
      .trim()

    // Find matching variant: exact slug → same size name → first variant
    const matchedVariant =
      variants.find((v) => v.slug === cartItem.variant?.slug) ||
      variants.find(
        (v) => (v.size?.name || '').toLowerCase().trim() === sizeName,
      ) ||
      variants[0]

    if (!matchedVariant) {
      removed.push(cartItem.name || productSlug)
      continue
    }

    // Check if anything changed (slug, price, promotion)
    const slugChanged = matchedVariant.slug !== cartItem.variant?.slug
    const priceChanged = matchedVariant.price !== cartItem.variant?.price
    const newPromotion = menuItem.promotion || null
    const promotionChanged =
      (newPromotion?.slug || null) !== (cartItem.promotion?.slug || null)

    if (slugChanged || priceChanged || promotionChanged) {
      updated.push(cartItem.name || productSlug)
    }
  }

  return {
    removed,
    updated,
    isValid: removed.length === 0,
  }
}

/**
 * Hook that provides cart validation against today's menu.
 *
 * Returns:
 * - validate(force?) — run validation, returns result
 * - isValidating — loading state
 */
export function useCartValidation() {
  const queryClient = useQueryClient()
  const isValidatingRef = useRef(false)
  const lastValidatedDateRef = useRef<string | null>(null)

  const { hasUser, roleName } = useUserStore(
    useShallow((s) => ({
      hasUser: !!s.userInfo,
      roleName: s.userInfo?.role?.name,
    })),
  )
  const branchSlug = useBranchStore((s) => s.branch?.slug)

  const validate = useCallback(
    async (force = false): Promise<CartValidationResult | null> => {
      const orderingData = useOrderFlowStore.getState().orderingData
      const cartItems = orderingData?.orderItems
      if (!cartItems || cartItems.length === 0) return null
      if (!branchSlug) return null

      // Skip if already validated today (unless forced)
      const today = new Date().toISOString().slice(0, 10)
      if (!force && lastValidatedDateRef.current === today) return null

      // Prevent concurrent validation
      if (isValidatingRef.current) return null
      isValidatingRef.current = true

      try {
        const query = {
          branch: branchSlug,
          date: new Date().toISOString().slice(0, 10),
        }
        const fetchMenu =
          hasUser && roleName !== Role.CUSTOMER
            ? getSpecificMenu
            : getPublicSpecificMenu

        // Use queryClient to leverage cache
        const queryKey =
          hasUser && roleName !== Role.CUSTOMER
            ? ['specific-menu', query]
            : ['public-specific-menu', query]

        const menuData = await queryClient.fetchQuery({
          queryKey,
          queryFn: () => fetchMenu(query),
          staleTime: force ? 0 : 30_000,
          meta: { skipGlobalError: true },
        })

        const menuItems = menuData?.result?.menuItems
        if (!menuItems) return null

        // Validate
        const result = validateCartItems(cartItems, menuItems)

        // Apply changes if needed
        if (result.removed.length > 0 || result.updated.length > 0) {
          // Remove stale items
          for (const cartItem of cartItems) {
            const slug = cartItem.productSlug || cartItem.slug
            const name = cartItem.name || slug
            if (result.removed.includes(name)) {
              cartActions.removeItem(cartItem.id)
            }
          }

          // Update changed items
          if (result.updated.length > 0) {
            const currentData = useOrderFlowStore.getState().orderingData
            const currentItems = currentData?.orderItems || []
            const menuLookup = new Map<string, IMenuItem>()
            for (const mi of menuItems) {
              if (mi.product?.slug) menuLookup.set(mi.product.slug, mi)
            }

            for (const item of currentItems) {
              const slug = item.productSlug || item.slug
              const name = item.name || slug
              if (!result.updated.includes(name)) continue

              const mi = menuLookup.get(slug)
              if (!mi) continue

              const variants = mi.product?.variants || []
              const newVariant: IProductVariant | undefined =
                variants.find((v) => v.slug === item.variant?.slug) ||
                variants.find(
                  (v) => v.size?.slug === item.variant?.size?.slug,
                ) ||
                variants[0]

              if (newVariant) {
                cartActions.updateVariant(item.id, newVariant)
              }
            }
          }

          // Show feedback
          if (result.removed.length > 0) {
            const names = result.removed.slice(0, 3).join(', ')
            const suffix =
              result.removed.length > 3
                ? ` và ${result.removed.length - 3} món khác`
                : ''
            showToast(`${names}${suffix} không còn trong menu, đã xoá`)
          } else if (result.updated.length > 0) {
            showToast(`Đã cập nhật giá mới cho ${result.updated.length} món`)
          }

          // Re-validate voucher after item changes
          const voucherAfter =
            useOrderFlowStore.getState().orderingData?.voucher
          if (voucherAfter && result.removed.length > 0) {
            cartActions.setVoucher(null)
          }
        }

        lastValidatedDateRef.current = today
        return result
      } catch {
        // Silently fail — menu fetch can fail due to network/auth timing
        // Don't remove cart items on fetch failure
        return null
      } finally {
        isValidatingRef.current = false
      }
    },
    [branchSlug, hasUser, roleName, queryClient],
  )

  return { validate, isValidatingRef }
}
