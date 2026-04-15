// Helper để quản lý trạng thái validation voucher từ customer change
// Sử dụng để tránh duplicate toast khi validate voucher ở nhiều nơi

let isValidatingFromCustomerChange = false

export const setValidatingFromCustomerChange = (value: boolean) => {
  isValidatingFromCustomerChange = value
}

export const getValidatingFromCustomerChange = () => {
  return isValidatingFromCustomerChange
}
