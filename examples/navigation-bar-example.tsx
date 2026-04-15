/**
 * Ví dụ sử dụng Navigation Bar trên Android
 * 
 * File này minh họa các cách sử dụng react-native-navigation-bar-color
 */

import { setNavigationBarColor, useNavigationBar } from '@/hooks/use-navigation-bar'
import { StyleSheet, Text, View } from 'react-native'

// ============================================
// Ví dụ 1: Sử dụng Hook trong Component
// ============================================
export function ExampleWithHook() {
  // Đổi màu navigation bar sang trắng với icon màu đen
  useNavigationBar('#FFFFFF', true, true)

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Navigation bar màu trắng với icon đen</Text>
    </View>
  )
}

// ============================================
// Ví dụ 2: Navigation Bar màu đen với icon trắng
// ============================================
export function DarkNavigationBarExample() {
  // Đổi màu navigation bar sang đen với icon màu trắng
  useNavigationBar('#000000', false, true)

  return (
    <View style={[styles.container, styles.darkContainer]}>
      <Text style={styles.lightText}>Navigation bar màu đen với icon trắng</Text>
    </View>
  )
}

// ============================================
// Ví dụ 3: Đổi màu động theo theme
// ============================================
export function AdaptiveNavigationBarExample() {
  // Giả sử bạn có theme từ context hoặc store
  const isDarkMode = false // Thay bằng logic thực tế của bạn

  useNavigationBar(
    isDarkMode ? '#000000' : '#FFFFFF',
    !isDarkMode, // light = true khi nền sáng
    true
  )

  return (
    <View style={[styles.container, isDarkMode && styles.darkContainer]}>
      <Text style={isDarkMode ? styles.lightText : styles.text}>
        Navigation bar tự động đổi màu theo theme
      </Text>
    </View>
  )
}

// ============================================
// Ví dụ 4: Đổi màu bằng function (không dùng hook)
// ============================================
export function ExampleWithFunction() {
  const handleChangeColor = () => {
    // Đổi màu navigation bar ngay lập tức
    setNavigationBarColor('#FF0000', true, true)
      .then(() => {
        // Màu đã được đổi thành công
      })
      .catch(() => {
        // Xử lý lỗi nếu cần
      })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text} onPress={handleChangeColor}>
        Nhấn để đổi màu navigation bar
      </Text>
    </View>
  )
}

// ============================================
// Ví dụ 5: Đổi màu khi vào screen cụ thể
// ============================================
export function ScreenSpecificNavigationBar() {
  // Khi vào screen này, navigation bar sẽ đổi màu
  useNavigationBar('#4CAF50', true, true) // Màu xanh lá

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Screen này có navigation bar màu xanh lá
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  darkContainer: {
    backgroundColor: '#000000',
  },
  text: {
    color: '#000000',
    fontSize: 16,
    textAlign: 'center',
  },
  lightText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
})

