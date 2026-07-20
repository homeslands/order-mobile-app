# Build & Release Guide

Quy trình phát hành app TREND Coffee (`com.trendcoffee.order`) lên App Store và
Google Play.

- **Android** → build trên EAS (cloud), tải `.aab` về, upload tay lên Play Console
- **iOS** → archive bằng Xcode trên máy, upload thẳng lên App Store Connect

---

## 0. Chuẩn bị (một lần)

Các file sau **bị gitignore** — không có trong repo, phải tự đặt vào máy:

| File | Lấy từ đâu |
| --- | --- |
| `.env` | team lead |
| `google-services.json` | Firebase Console → Android app |
| `GoogleService-Info.plist` | Firebase Console → iOS app |

Keystore Android đặt **ngoài repo** để sống sót qua `prebuild --clean`, và khai
trong `~/.gradle/gradle.properties` (xem `plugins/android-release-signing.js`).
Chỉ cần cho build local — build EAS dùng keystore đã lưu trên server EAS.

> **Không bao giờ commit** các file trên, `credentials.json`, hay bất kỳ `.jks`
> nào. Cũng đừng dán mật khẩu keystore vào chat/issue/PR.

---

## 1. Đánh version

Sửa `app.json`:

```jsonc
{
  "expo": {
    "version": "2.5.3",           // hiển thị cho người dùng
    "ios":     { "buildNumber": "60" },
    "android": { "versionCode": 60 }
  }
}
```

**iOS bắt buộc chạy tiếp lệnh này** — `app.json` không tự chạm vào `Info.plist`,
mà `ios/` được git track. Bỏ qua bước này thì Xcode vẫn archive version cũ:

```bash
npx expo prebuild --platform ios
```

Rồi commit **cả** `app.json` **và** `ios/TRENDCoffee/Info.plist`.

> **Android trên EAS bỏ qua `versionCode` trong `app.json`.** `eas.json` khai
> `appVersionSource: "remote"` + `autoIncrement`, nên EAS tự tăng số của chính
> nó. Xem/sửa số remote:
>
> ```bash
> eas build:version:get --platform android
> eas build:version:set --platform android   # interactive, không có flag --version-code
> ```
>
> Số remote **phải > versionCode đang live trên Play**, nếu không Play từ chối.

---

## 2. Build Android (EAS)

```bash
npm run build:android
```

Lệnh này = `npm run prebuild:clean && eas build --profile production --platform android`.

Build chạy trên **server Linux của Expo**, không tốn CPU máy bạn. Upload xong
(~1–2 phút) là Ctrl+C / đóng máy thoải mái — build vẫn tiếp tục.

```bash
eas build:list --platform android --limit 3      # xem trạng thái
eas build:download --platform android --latest   # tải .aab về khi xong
```

Thời gian thực tế: **20–40 phút** (phần lớn là xếp hàng ở free tier).

### Upload lên Play

Play Console → **TREND Coffee** → Kiểm thử và phát hành → chọn track
(Internal testing / Production) → **Tạo bản phát hành mới** → upload `.aab`.

> `eas submit --platform android --latest` **chưa dùng được** — cần Google
> Service Account key (`Cài đặt → Truy cập API` trên Play Console) mà project
> hiện chưa dựng. `eas.json` cũng đang khai `"submit": { "production": {} }` rỗng.

### Kiểm tra keystore trước khi upload

AAB phải ký bằng đúng upload key Play đang chờ, nếu sai Play từ chối ngay:

```bash
eas credentials --platform android    # xem SHA1 của config Default
```

So với Play Console → app → Kiểm thử và phát hành → Cài đặt → **Ký ứng dụng** →
"Chứng chỉ khoá tải lên" → SHA-1. Hai số phải trùng.

### Build Android local (thay thế)

Nhanh hơn và miễn phí, nhưng ngốn CPU + vài GB ổ cứng. Cần keystore trong
`~/.gradle/gradle.properties` như mục 0:

```bash
npx expo prebuild --platform android
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

---

## 3. Build iOS (Xcode)

```bash
# 1. Sync version + native config từ app.json sang ios/
npx expo prebuild --platform ios

# 2. Chỉ khi vừa thêm/đổi package native
npx pod-install

# 3. Mở workspace (KHÔNG phải .xcodeproj)
open ios/TRENDCoffee.xcworkspace
```

Trong Xcode:

1. Chọn scheme **TRENDCoffee**, target device là **Any iOS Device (arm64)** —
   không chọn simulator, sẽ không archive được
2. **Product → Clean Build Folder** (⇧⌘K) nếu vừa đổi version
3. **Product → Archive**
4. Organizer mở ra → kiểm tra **version/build hiện đúng số ở mục 1** trước khi
   đi tiếp
5. **Distribute App → App Store Connect → Upload**

Chờ ~10–30 phút để Apple xử lý, sau đó bản build hiện trong App Store Connect →
TestFlight.

> Archive hiện **sai version**? Nghĩa là quên `npx expo prebuild --platform ios`
> ở bước 1 — `app.json` một mình không đủ.

---

## 4. Git flow

```
feature/TCA-xx  →  develop  →  staging  →  main (+ tag)
```

- Không commit thẳng vào `develop` / `staging` / `main` — luôn đi qua PR
- Tag trên `main`: `v2.5.3`
- Sau khi release, **back-merge** `main` về `develop` để develop không tụt lại

Kiểm tra develop có tụt lại không:

```bash
git log --oneline origin/develop..origin/main
```

Chỉ nên còn các commit merge. Nếu thấy commit nội dung → develop đang thiếu, cần
back-merge.

---

## 5. Trước khi build

```bash
npm run check:all    # typecheck + lint + circular deps + test
```

---

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân |
| --- | --- |
| Xcode archive ra version cũ | Quên `npx expo prebuild --platform ios` |
| EAS: "google-services.json is missing" | EAS chỉ upload file git track; `app.config.js` đọc từ file env var của EAS — kiểm tra `GOOGLE_SERVICES_JSON` còn khai trên EAS không |
| EAS: "Gradle build failed with unknown error" | Từng do `gradle.properties` ở gốc repo ép đường dẫn node của macOS lên server Linux. File này đã xoá + gitignore — **đừng tạo lại**, để nó ở `~/.gradle/gradle.properties` |
| Play từ chối AAB: version code đã tồn tại | Số remote của EAS ≤ số đang live. Xem mục 1 |
| Play từ chối AAB: sai chữ ký | Keystore trên EAS không phải upload key. Xem "Kiểm tra keystore" ở mục 2 |
| `Cannot run program "node"` khi build Android local | Xem `docs/android-studio-node-setup.md` |
