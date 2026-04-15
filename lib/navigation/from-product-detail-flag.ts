/**
 * Flag để Cart biết user vừa navigate từ Product Detail (app/product/[id]).
 * Consume khi Cart mount để reset. Unmount Product Detail đã nhẹ (simplified tree + defer clearCache)
 * nên Cart dùng delay thống nhất 150ms như Tab bar → Cart.
 */
let fromProductDetail = false

export function setFromProductDetail(value: boolean): void {
  fromProductDetail = value
}

/** Đọc và reset flag — gọi 1 lần khi Cart mount */
export function consumeFromProductDetail(): boolean {
  const value = fromProductDetail
  fromProductDetail = false
  return value
}
