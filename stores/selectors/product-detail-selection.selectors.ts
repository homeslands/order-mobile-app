/**
 * Product Detail Selection — Atomic selectors.
 * Chỉ PriceFooter subscribe price, quantity, toppingExtraPrice.
 * Chỉ VariantChip subscribe size.
 * Chỉ ToppingItem subscribe selectedToppingIds[toppingId].
 */
import { useProductDetailSelectionStore } from '../product-detail-selection.store'

export const useDetailProductSlug = () =>
  useProductDetailSelectionStore((s) => s.productSlug)

export const useDetailSelectedVariant = () =>
  useProductDetailSelectionStore((s) => s.selectedVariant)

export const useDetailSize = () =>
  useProductDetailSelectionStore((s) => s.size)

export const useDetailPrice = () =>
  useProductDetailSelectionStore((s) => s.price)

export const useDetailQuantity = () =>
  useProductDetailSelectionStore((s) => s.quantity)

export const useDetailNote = () =>
  useProductDetailSelectionStore((s) => s.note)

export const useDetailToppingExtraPrice = () =>
  useProductDetailSelectionStore((s) => s.toppingExtraPrice)

/** Giá tổng đã tính sẵn trong store — Footer chỉ đọc, không compute */
export const useDetailComputedTotalPrice = () =>
  useProductDetailSelectionStore((s) => s.computedTotalPrice)

export const useDetailSetProductPromotion = () =>
  useProductDetailSelectionStore((s) => s.setProductPromotion)

export const useDetailIsToppingSelected = (toppingId: string) =>
  useProductDetailSelectionStore((s) => !!s.selectedToppingIds[toppingId])

export const useDetailSetSelection = () =>
  useProductDetailSelectionStore((s) => s.setSelection)

export const useDetailSetQuantity = () =>
  useProductDetailSelectionStore((s) => s.setQuantity)

export const useDetailSetNote = () =>
  useProductDetailSelectionStore((s) => s.setNote)

export const useDetailToggleTopping = () =>
  useProductDetailSelectionStore((s) => s.toggleTopping)

export const useDetailResetForProduct = () =>
  useProductDetailSelectionStore((s) => s.resetForProduct)
