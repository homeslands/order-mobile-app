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

```bash
bash scripts/build-production.sh ios
```

Hoặc manual:

```bash
npm run prebuild:clean && npm run typecheck && npm run build:ios
```

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

# 2. Chạy codegen (bắt buộc trước khi sync)
cd android && ./gradlew generateCodegenArtifactsFromSchema
```

Sau đó trong Android Studio:

1. **File → Sync Project with Gradle Files**
2. **Build → Clean Project**
3. **Build → Rebuild Project** (hoặc Run)

> **Lưu ý:** `Build → Clean Project` đã được cấu hình tự động xóa `app/.cxx` trước khi clean native — không cần xóa tay nữa. Mỗi lần đổi file .env, chỉ được build APK/AAB 1 lần.

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
