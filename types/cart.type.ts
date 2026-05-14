export interface ICartCalculationResult {
  subTotalBeforeDiscount: number
  subTotal: number
  subTotalAfterPromotion: number
  promotionDiscount: number
  itemLevelDiscount: number
  orderLevelDiscount: number
  totalDiscount: number
  // totalAfterDiscount?: number
}
