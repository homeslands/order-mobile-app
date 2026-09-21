/**
 * Vỏ tại stack gốc cho route '/cart'.
 *
 * Route này tồn tại vì Android cần màn giỏ hàng ở stack gốc — thanh tab gốc
 * (NativeTabs) không cho ẩn một tab mà vẫn điều hướng tới: trigger `hidden`
 * bị `.filter()` loại HẲN khỏi navigator (xem
 * node_modules/expo-router/build/useScreens.js:123), nên route đó không
 * điều hướng tới được nữa. Vì vậy Android không khai báo trigger "cart"
 * trong app/(tabs)/_layout.tsx (xem TAB_ROUTES.CART), và màn giỏ hàng ở đó
 * phải nằm ở '/cart' thay vì '/(tabs)/cart'.
 *
 * Trên iOS, '/(tabs)/cart' vẫn là đường chính thức (tab thứ 5, role="search"
 * ở iOS 26+). Nhưng vì file này tồn tại trong app/, route '/cart' VẪN sống
 * trên cả hai nền tảng — không có gì trong JS bundle ngăn một universal
 * link, payload push notification, hay deep link thủ công mở '/cart' trên
 * iOS. Nếu để lọt, nó sẽ render thẳng app/(tabs)/cart.tsx tại đây — một màn
 * phủ kín, không thanh tab, không ô tròn search — khác hẳn trải nghiệm tab
 * thứ 5 bình thường. Đây là hàng rào cho nguồn NGOÀI JS bundle (không phải
 * cho luồng điều hướng trong app — trong app không nơi nào dùng literal
 * '/cart' trên iOS, TAB_ROUTES.CART đã tự trỏ đúng '/(tabs)/cart'): trên iOS,
 * route này chỉ Redirect sang '/(tabs)/cart' thay vì render màn thật.
 */
import { Redirect } from 'expo-router'
import { Platform } from 'react-native'

import CartScreen from '@/app/(tabs)/cart'

export default function CartRoute() {
  if (Platform.OS === 'android') {
    return <CartScreen />
  }

  return <Redirect href="/(tabs)/cart" />
}
