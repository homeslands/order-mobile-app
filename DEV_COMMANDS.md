# Dev Commands — Trend Coffee App

## Mở IDE / Simulator

```bash
# Mở Android Studio (project android/)
open -a "Android Studio" android/

# Mở Xcode (workspace iOS)
open ios/mobilemovieapp.xcworkspace

# Mở iOS Simulator (hiện tại đang chọn)
open -a Simulator

# Mở thiết bị Android qua ADB
adb devices
```

---

## Dev Server

```bash
# Khởi động Metro bundler
npx expo start

# Khởi động với cache clear
npx expo start --clear
```

---

## Build & Chạy

```bash
# Chạy trên iOS (simulator mặc định)
npx expo run:ios

# Chạy trên iOS - chỉ định thiết bị
npx expo run:ios --device

# Chạy trên Android (emulator/thiết bị)
npx expo run:android

# Build Android APK debug trực tiếp qua Gradle
cd android && ./gradlew app:assembleDebug && cd ..

# Build Android release
cd android && ./gradlew app:assembleRelease && cd ..

# EAS Build production
npm run build:ios
npm run build:android
```

---

## Quality Checks

```bash
# TypeScript strict check
npm run typecheck

# Lint
npm run lint

# Lint + auto-fix
npm run lint:fix

# Typecheck + lint cùng lúc
npm run check

# Phát hiện circular dependencies
npm run check-circular

# Format (Prettier)
npm run format
```

---

## Reset / Clean

```bash
# Xoá Metro cache
npx expo start --clear

# Xoá build Android
cd android && ./gradlew clean && cd ..

# Xoá build iOS (DerivedData)
rm -rf ~/Library/Developer/Xcode/DerivedData

# Cài lại pods iOS
cd ios && pod install && cd ..

# Cài lại node_modules
rm -rf node_modules && npm install
```

---

## Fix: Android Studio không tìm thấy Node (nvm)

Android Studio dùng PATH khác terminal → thêm dòng sau vào `android/local.properties`:

```
node.path=/Users/phanquyetthang/.nvm/versions/node/v18.17.0/bin/node
```

> Lệnh kiểm tra path Node hiện tại: `which node`

---

## Xem thiết bị / simulator

```bash
# Liệt kê iOS simulators
xcrun simctl list devices

# Liệt kê Android emulators
$ANDROID_HOME/emulator/emulator -list-avds

# Khởi động Android emulator cụ thể
$ANDROID_HOME/emulator/emulator -avd <tên_avd>

# Xem log Android
adb logcat
```

---

## Thông tin project

| Mục | Giá trị |
|-----|---------|
| Node | v18.17.0 (nvm) |
| Android SDK | `~/Library/Android/sdk` |
| iOS workspace | `ios/mobilemovieapp.xcworkspace` |
| Bundle ID iOS | xem `app.config.ts` |
| Package Android | xem `android/app/build.gradle` |
