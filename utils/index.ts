export * from './auth-helpers'
export * from './capitalizeFirstLetter'
export * from './cart'
export * from './current-url-manager'
export * from './date'
export * from './enum-labels'
export * from './format'
export * from './getNativeFcmToken'
export * from './getWebFcmToken'
export * from './google-map'
export * from './http'
export * from './loyalty-point'
// export * from './map-icons'
// export * from './notification-navigation'
export * from './order-api-diff'
export * from './order-comparison'
export * from './payment-resolver'
// export * from './pdf-font'
// Export download-image functions (excluding duplicates)
export {
  downloadAndSaveImage,
  downloadQRCodeImage,
  useDownloadImage,
} from './download-image'

// Export download-pdf functions (excluding duplicates)
export { downloadAndSavePDF } from './download-pdf'

// Export permission functions from download-image (shared)
export {
  checkMediaLibraryPermission,
  requestMediaLibraryPermission,
} from './download-image'
export * from './permission'
export { computeProductDetailTotal } from './product-detail-calc'
export * from './priceRange'
// export * from './printer'
export * from './toast'
export * from './voucher'
export * from './voucher-validation-helper'
export * from './mask-identity'
