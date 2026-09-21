// Vỏ tại stack gốc — Android cần màn giỏ hàng ở đây vì thanh tab gốc không
// cho ẩn một tab mà vẫn điều hướng tới (xem node_modules/expo-router/build/useScreens.js:123,
// trigger `hidden` bị lọc khỏi navigator). Màn thật vẫn ở app/(tabs)/cart.tsx (iOS dùng).
export { default } from '@/app/(tabs)/cart'
