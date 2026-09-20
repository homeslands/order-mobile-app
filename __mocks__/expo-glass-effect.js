// Jest không có module native ExpoGlassEffect. Mock trả về "máy không có
// kính", nên test luôn chạy nhánh fallback — đúng với Android và iOS < 26.
const { View } = require('react-native')

module.exports = {
  GlassView: View,
  GlassContainer: View,
  isLiquidGlassAvailable: () => false,
  isGlassEffectAPIAvailable: () => false,
}
