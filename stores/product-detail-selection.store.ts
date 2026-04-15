/**
 * Product Detail Selection — Zustand slice cho size, quantity, price, toppings.
 * Atomic updates → chỉ PriceFooter, QuantitySelector, ToppingCheckbox re-render.
 * Image Header, Description không subscribe → không re-render khi chọn size/topping.
 * computeProductDetailTotal: native-first (JSI).
 */
import type { IProductVariant } from '@/types'
import { computeProductDetailTotal } from '@/utils'
import { create } from 'zustand'

export interface ProductDetailSelectionState {
  /** Slug món đang xem — reset khi navigate sang món khác */
  productSlug: string | null
  selectedVariant: IProductVariant | null
  size: string | null
  price: number | null
  quantity: number
  note: string
  selectedToppingIds: Record<string, boolean>
  toppingExtraPrice: number
  /** % giảm giá từ promotion (0 = không giảm) */
  promotionDiscountPercent: number
  /** Giá tổng đã tính sẵn — Footer chỉ đọc, không compute trong render */
  computedTotalPrice: number | null
}

type ProductDetailSelectionActions = {
  setProductSlug: (slug: string | null) => void
  setProductPromotion: (discountPercent: number) => void
  setSelection: (params: {
    variant?: IProductVariant | null
    size?: string | null
    price?: number | null
    quantity?: number
    note?: string
  }) => void
  setQuantity: (qty: number) => void
  setNote: (note: string) => void
  toggleTopping: (toppingId: string, price: number, selected: boolean) => void
  resetForProduct: (slug: string) => void
  clearSelection: () => void
}

const initialState: ProductDetailSelectionState = {
  productSlug: null,
  selectedVariant: null,
  size: null,
  price: null,
  quantity: 1,
  note: '',
  selectedToppingIds: {},
  toppingExtraPrice: 0,
  promotionDiscountPercent: 0,
  computedTotalPrice: null,
}

export const useProductDetailSelectionStore = create<
  ProductDetailSelectionState & ProductDetailSelectionActions
>((set) => ({
  ...initialState,

  setProductSlug: (slug) => set({ productSlug: slug }),

  setProductPromotion: (discountPercent) =>
    set((s) => ({
      promotionDiscountPercent: discountPercent,
      computedTotalPrice: computeProductDetailTotal(
        s.price,
        s.quantity,
        s.toppingExtraPrice,
        discountPercent,
      ),
    })),

  setSelection: (params) =>
    set((s) => {
      const price = params.price !== undefined ? params.price : s.price
      const qty = params.quantity !== undefined ? params.quantity : s.quantity
      return {
        ...s,
        ...(params.variant !== undefined && { selectedVariant: params.variant }),
        ...(params.size !== undefined && { size: params.size }),
        ...(params.price !== undefined && { price: params.price }),
        ...(params.quantity !== undefined && { quantity: params.quantity }),
        ...(params.note !== undefined && { note: params.note }),
        computedTotalPrice: computeProductDetailTotal(
          price,
          qty,
          s.toppingExtraPrice,
          s.promotionDiscountPercent,
        ),
      }
    }),

  setQuantity: (quantity) =>
    set((s) => ({
      quantity,
      computedTotalPrice: computeProductDetailTotal(
        s.price,
        quantity,
        s.toppingExtraPrice,
        s.promotionDiscountPercent,
      ),
    })),

  setNote: (note) => set({ note }),

  toggleTopping: (toppingId, price, selected) =>
    set((s) => {
      const next = { ...s.selectedToppingIds, [toppingId]: selected }
      const delta = selected ? price : -price
      const toppingExtra = Math.max(0, s.toppingExtraPrice + delta)
      return {
        selectedToppingIds: next,
        toppingExtraPrice: toppingExtra,
        computedTotalPrice: computeProductDetailTotal(
          s.price,
          s.quantity,
          toppingExtra,
          s.promotionDiscountPercent,
        ),
      }
    }),

  resetForProduct: (slug) =>
    set({
      productSlug: slug,
      selectedVariant: null,
      size: null,
      price: null,
      quantity: 1,
      note: '',
      selectedToppingIds: {},
      toppingExtraPrice: 0,
      promotionDiscountPercent: 0,
      computedTotalPrice: null,
    }),

  clearSelection: () => set(initialState),
}))
