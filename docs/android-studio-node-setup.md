# Android Studio - Node.js Setup Guide

## Vấn đề

Android Studio (GUI app trên macOS) không đọc shell config (`~/.zshrc`, `~/.bashrc`), nên không thấy `node` khi dùng nvm. React Native & Expo Gradle plugin cần `node` để resolve packages và autolink modules → gây lỗi:

```
Cannot run program "node": error=2, No such file or directory
```

## Cách hoạt động của fix hiện tại

Dùng **LaunchAgent** để inject PATH chứa node vào môi trường của tất cả GUI apps.

**File:** `~/Library/LaunchAgents/environment.plist`

```xml
<string>launchctl setenv PATH "/Users/phanquyetthang/.nvm/versions/node/v18.17.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"</string>
```

Ngoài ra, `android/settings.gradle` và `android/app/build.gradle` cũng được cấu hình hardcode absolute path đến node.

---

## Khi upgrade Node (nvm)

Sau khi cài version Node mới qua nvm, cần update **3 file**:

### 1. LaunchAgent

```bash
# Xem node path hiện tại
which node
# Ví dụ output: /Users/phanquyetthang/.nvm/versions/node/v20.11.0/bin/node

# Sửa file plist
nano ~/Library/LaunchAgents/environment.plist
# Thay path cũ (v18.17.0) thành path mới (v20.11.0)

# Reload
launchctl unload ~/Library/LaunchAgents/environment.plist
launchctl load ~/Library/LaunchAgents/environment.plist

# Hoặc apply ngay không cần restart
launchctl setenv PATH "/Users/phanquyetthang/.nvm/versions/node/v20.11.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
```

### 2. android/settings.gradle (dòng 2)

```groovy
def nodePath = "/Users/phanquyetthang/.nvm/versions/node/v20.11.0/bin/node"
```

### 3. android/app/build.gradle (dòng 6)

```groovy
def nodeExecutable = "/Users/phanquyetthang/.nvm/versions/node/v20.11.0/bin/node"
```

### 4. Restart Android Studio

```bash
# Kill Gradle daemons cũ
pkill -9 -f GradleDaemon

# Đóng và mở lại Android Studio (Cmd+Q rồi mở lại)
```

---

## Troubleshooting

### Lỗi "Cannot run program 'node'"

```bash
# 1. Kiểm tra launchctl PATH đã set chưa
launchctl getenv PATH

# 2. Nếu chưa có hoặc sai path, set lại
launchctl setenv PATH "$(dirname $(which node)):/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# 3. Kill tất cả Gradle daemons cũ
pkill -9 -f GradleDaemon

# 4. Đóng hoàn toàn Android Studio (Cmd+Q) rồi mở lại
```

### Lỗi "Could not read workspace metadata"

Cache Gradle bị corrupt. Fix:

```bash
rm -rf ~/.gradle/caches/
rm -rf ~/.gradle/daemon/
rm -rf android/.gradle/

# Rebuild cache (chạy từ thư mục project)
cd android && ./gradlew tasks
```

### Lỗi "Invalid Gradle JDK configuration"

Trong Android Studio:

- **File → Settings → Build, Execution, Deployment → Build Tools → Gradle**
- **Gradle JDK** → chọn **"jbr-21 Android Studio default JDK"** hoặc click **"Use Embedded JDK"**

---

## Lưu ý

- File `android/settings.gradle` và `android/app/build.gradle` có thể bị **overwrite** khi chạy `npx expo prebuild`. Nếu chạy prebuild, cần apply lại hardcode node path.
- Nếu không muốn hardcode, có thể mở Android Studio từ terminal để kế thừa shell PATH:
  ```bash
  open -a "Android Studio" android/
  ```
