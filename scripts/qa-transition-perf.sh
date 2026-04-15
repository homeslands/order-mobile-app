#!/usr/bin/env bash
#
# QA Transition Performance — Tự động 10 lần navigate Menu List → Menu Item Detail.
#
# Yêu cầu:
# - adb đã cài và thiết bị đã kết nối
# - App đã mở, đang ở màn Menu (tab Thực đơn), danh sách món đã load
#
# Cách lấy tọa độ:
#   adb shell wm size          # Kích thước màn hình
#   adb shell settings put system pointer_location 1  # Bật hiển thị tọa độ khi chạm
#   # Tap vào món đầu tiên, ghi nhận x y
#   adb shell settings put system pointer_location 0  # Tắt sau khi xong
#
# Mặc định (1080x2400): menu item đầu ~(540, 550), back button ~(80, 150)
#

set -e

ATTEMPTS=10
WAIT_AFTER_TAP=2      # giây đợi sau khi tap vào detail
WAIT_AFTER_BACK=1     # giây đợi sau khi back

# Tọa độ — CHỈNH THEO THIẾT BỊ (x y)
# Menu item đầu tiên (tap để mở detail)
MENU_ITEM_X=${MENU_ITEM_X:-540}
MENU_ITEM_Y=${MENU_ITEM_Y:-550}

# Nút Back (góc trái trên)
BACK_BUTTON_X=${BACK_BUTTON_X:-80}
BACK_BUTTON_Y=${BACK_BUTTON_Y:-150}

echo "=== QA Transition Performance ==="
echo "Attempts: $ATTEMPTS"
echo "Menu item tap: ($MENU_ITEM_X, $MENU_ITEM_Y)"
echo "Back button: ($BACK_BUTTON_X, $BACK_BUTTON_Y)"
echo ""

# Kiểm tra adb
if ! command -v adb &> /dev/null; then
  echo "Error: adb not found. Install Android SDK platform-tools."
  exit 1
fi

# Kiểm tra thiết bị
DEVICES=$(adb devices | grep -v "List" | grep "device$" | wc -l)
if [ "$DEVICES" -eq 0 ]; then
  echo "Error: No Android device/emulator connected."
  echo "Run: adb devices"
  exit 1
fi

echo "Device connected. Starting $ATTEMPTS navigation cycles..."
echo ""

for i in $(seq 1 $ATTEMPTS); do
  echo "[$i/$ATTEMPTS] Tap menu item..."
  adb shell input tap $MENU_ITEM_X $MENU_ITEM_Y
  sleep $WAIT_AFTER_TAP

  echo "[$i/$ATTEMPTS] Back..."
  adb shell input tap $BACK_BUTTON_X $BACK_BUTTON_Y
  sleep $WAIT_AFTER_BACK
done

echo ""
echo "Done. [TransitionFPS] logs appear in:"
echo "  1. Metro terminal (nơi chạy 'npm run android' hoặc 'expo start')"
echo "  2. Hoặc: adb logcat -s ReactNativeJS:V | grep TransitionFPS"
