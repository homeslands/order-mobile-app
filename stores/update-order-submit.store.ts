/**
 * Đang gửi thay đổi đơn — để màn sửa đơn không cho đồng hồ hết hạn / polling
 * trạng thái chen vào giữa chuỗi lệnh lưu (xoá bản nháp giữa chừng).
 */
import { create } from 'zustand'

export const useUpdateOrderSubmitStore = create<{
  isSubmitting: boolean
  setSubmitting: (value: boolean) => void
}>()((set) => ({
  isSubmitting: false,
  setSubmitting: (value) => set({ isSubmitting: value }),
}))
