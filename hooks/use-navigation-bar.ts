import { useEffect } from 'react'
import { Platform } from 'react-native'
import {
  changeNavigationBarColor,
  hideNavigationBar,
  showNavigationBar,
} from 'navigation-bar-color'

/**
 * Hook để quản lý Navigation Bar trên Android
 * 
 * @param backgroundColor - Màu nền của navigation bar (mặc định: #FFFFFF)
 * @param light - true = icon màu đen (cho nền sáng), false = icon màu trắng (cho nền tối)
 * @param animated - Có animate khi đổi màu không (mặc định: true)
 */
export function useNavigationBar(
  backgroundColor: string = '#FFFFFF',
  light: boolean = true,
  animated: boolean = true
) {
  useEffect(() => {
    // Chỉ áp dụng trên Android
    if (Platform.OS !== 'android') {
      return
    }

    // Đổi màu navigation bar — gọi Expo Module (JSI khi New Arch bật)
    changeNavigationBarColor(backgroundColor, light, animated).catch(() => {})

    // Cleanup: Không cần reset vì navigation bar sẽ tự động reset khi app đóng
  }, [backgroundColor, light, animated])
}

/**
 * Utility function để đổi màu navigation bar ngay lập tức
 * 
 * @param backgroundColor - Màu nền của navigation bar
 * @param light - true = icon màu đen, false = icon màu trắng
 * @param animated - Có animate không
 */
export const setNavigationBarColor = (
  backgroundColor: string,
  light: boolean = true,
  animated: boolean = true
): Promise<{ success: boolean }> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve({ success: false })
  }
  return changeNavigationBarColor(backgroundColor, light, animated)
}

/**
 * Utility function để ẩn/hiện navigation bar
 * 
 * @param hidden - true = ẩn, false = hiện
 */
export const setNavigationBarHidden = (hidden: boolean): Promise<{ success: boolean }> => {
  if (Platform.OS !== 'android') {
    return Promise.resolve({ success: false })
  }
  return hidden ? hideNavigationBar() : showNavigationBar()
}

