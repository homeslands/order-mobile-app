# Production Build Guide

## 1️⃣ Chuẩn bị Environment

```bash
# Tạo/cập nhật .env với API cloud
# File: .env

EXPO_PUBLIC_BASE_API_URL=https://cloud-api.trendcoffee.net
EXPO_PUBLIC_FILE_URL=https://cloud-api.trendcoffee.net/files
EXPO_PUBLIC_GOOGLE_MAP_API_KEY=your_key
EXPO_PUBLIC_FIREBASE_API_KEY=your_key
...
```

**Lưu ý**: Chỉ sử dụng `EXPO_PUBLIC_*` prefix — các biến này mới được inject vào bundle.

## 2️⃣ Build Android

### Option A: Dùng script (Recommended)

```bash
bash scripts/build-production.sh android
```

**Script sẽ:**

1. ✅ Verify `.env` file tồn tại + có `EXPO_PUBLIC_BASE_API_URL`
2. ✅ Clean tất cả build caches
3. ✅ Run typecheck
4. ✅ EAS build với profile `production`

### Option B: Manual

```bash
# 1. Clean caches
npm run prebuild:clean

# 2. Type check
npm run typecheck

# 3. Build
npm run build:android
```

## 3️⃣ Build iOS

### Option A: EAS (CI/CD)

```bash
bash scripts/build-production.sh ios
```

Hoặc manual:

```bash
npm run prebuild:clean && npm run typecheck && npm run build:ios
```

### Option B: Local — Xcode Product → Archive

Bắt buộc chạy prebuild trước để copy sound files và cập nhật xcodeproj:

```bash
# 1. Xóa Metro cache
rm -rf node_modules/.cache/metro

# 2. Regenerate native iOS project (copy sound files, cập nhật xcodeproj)
npx expo prebuild --platform ios --no-install

# 3. Cài CocoaPods (nếu có thay đổi dependencies)
cd ios && pod install && cd ..
```

Sau đó trong Xcode:

1. Mở `ios/TRENDCoffee.xcworkspace`
2. Chọn scheme **TRENDCoffee** → target **Any iOS Device**
3. **Product → Archive**
4. Sau khi archive xong → **Distribute App → App Store Connect**

> **Tại sao cần prebuild?** `ios/` bị gitignore (generated folder). `expo prebuild` copy `ding.mp3`, `notification.mp3` từ `assets/sound/` vào `ios/TRENDCoffee/` và thêm reference vào xcodeproj. Nếu bỏ qua bước này, build sẽ thiếu sound files.

## 4️⃣ Kiểm tra Build Status

```bash
# Xem EAS builds
eas build:list

# Xem log build cụ thể
eas build:view <build-id>
```

## 🏗️ Build Local qua Android Studio

### Flow chuẩn khi đổi `.env` rồi build

```bash
# 1. Xóa Metro cache (bắt buộc mỗi khi đổi .env)
rm -rf node_modules/.cache/metro

# 2. Xóa pre-built bundle nếu có (tránh Gradle dùng bundle JS cũ)
rm -f android/app/src/main/assets/index.android.bundle

# 3. Xóa .cxx để tránh lỗi CMake add_subdirectory khi clean
rm -rf android/app/.cxx

# 4. Chạy codegen (bắt buộc trước khi sync/clean)
cd android && ./gradlew generateCodegenArtifactsFromSchema

# 5. Sync sound files vào res/raw (bắt buộc nếu thêm/đổi tên file âm trong app.json)
cd .. && npx expo prebuild --platform android --no-install && cd android

# 6. Clean Gradle build artifacts
./gradlew clean && cd ..
```

Sau đó trong Android Studio:

1. **File → Sync Project with Gradle Files**
2. **Build → Rebuild Project** (hoặc Run)

Hoặc dùng CLI:

```bash
npx expo run:android --variant release
```

> **Lưu ý:** Phải xóa `app/.cxx` **trước** khi chạy `./gradlew clean` — nếu không, CMake sẽ lỗi `add_subdirectory` vì JNI dirs chưa được tạo.

### Flow lần đầu setup / sau `npm install`

```bash
# Thêm bước build nitro-modules để generate headers + prefab
cd android && ./gradlew :react-native-nitro-modules:assembleRelease :react-native-nitro-modules:assembleDebug

# Sau đó chạy codegen
./gradlew generateCodegenArtifactsFromSchema
```

Rồi mới Sync → Clean → Rebuild trong Studio.

### Tại sao cần các bước này?

| Bước                                 | Lý do                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Xóa Metro cache                      | Metro cache không tự invalidate khi `.env` thay đổi                                               |
| `expo prebuild --platform android`   | Copy sound files từ `assets/sound/` vào `res/raw/` — Gradle không tự làm bước này                 |
| `generateCodegenArtifactsFromSchema` | Sync chạy CMake configure trước khi codegen tạo thư mục JNI — nếu thiếu sẽ lỗi `add_subdirectory` |
| Build nitro-modules (lần đầu)        | `react-native-mmkv` cần `libNitroModules.so` + headers được build trước mới link được             |

---

## 🔍 Troubleshooting

### ❌ Build vẫn dùng env cũ (dev)

**Nguyên nhân:** Cache gradle hoặc Metro chưa được xóa

**Fix:**

```bash
npm run prebuild:clean
npm run build:android
```

### ❌ EXPO*PUBLIC*\* biến không được inject

**Kiểm tra:**

1. `.env` file tồn tại?
2. Biến có `EXPO_PUBLIC_` prefix?
3. Chạy `cat .env` để verify

**Fix:**

```bash
# Đảm bảo .env đúng format
EXPO_PUBLIC_BASE_API_URL=https://api.example.com

# Không có space xung quanh =
❌ EXPO_PUBLIC_BASE_API_URL = https://api.example.com
✅ EXPO_PUBLIC_BASE_API_URL=https://api.example.com
```

### ❌ EAS build fail

```bash
# Xem full log
eas build:view <build-id> --log

# Clear EAS cache
eas build:cache:clear
```

## 📋 Environment Variables Reference

| Variable                         | Purpose         | Example                             |
| -------------------------------- | --------------- | ----------------------------------- |
| `EXPO_PUBLIC_BASE_API_URL`       | API backend     | `https://api.trendcoffee.net`       |
| `EXPO_PUBLIC_FILE_URL`           | File server     | `https://api.trendcoffee.net/files` |
| `EXPO_PUBLIC_FIREBASE_*`         | Firebase config | From Firebase console               |
| `EXPO_PUBLIC_GOOGLE_MAP_API_KEY` | Google Maps     | From Google Cloud                   |

## 🔐 Security

- ❌ **Không commit** `.env` file (add to `.gitignore`)
- ✅ **Dùng** `.env.local` cho local-only values
- ✅ **EAS secrets** cho sensitive data không muốn trong source code

## ✅ Verification Checklist

- [ ] `.env` file tồn tại
- [ ] Tất cả `EXPO_PUBLIC_*` vars có giá trị
- [ ] `npm run typecheck` pass
- [ ] Cache đã bị clean (`npm run prebuild:clean`)
- [ ] Build log không có warning về missing vars
