# navigation-bar-color

Expo Module thay thế `react-native-navigation-bar-color`. Chạy trên **JSI** khi New Architecture bật, **không qua Bridge**.

## Đăng ký module — Không cần Codegen thủ công

Expo Modules sử dụng **expo-modules-autolinking** — module được auto-discover và link khi build. **Không cần chạy Codegen** vì:

1. **expo-module.config.json** — Expo đọc cấu hình và biết module nào cần load
2. **Autolinking** — Expo CLI scan `node_modules` và `package.json` dependencies, tự thêm module vào native build
3. **Expo Module API** — Swift/Kotlin DSL (ModuleDefinition) thay cho Codegen spec

### Các bước đăng ký

1. **Thêm dependency** vào `package.json` root:

```json
{
  "dependencies": {
    "navigation-bar-color": "file:./modules/navigation-bar-color"
  }
}
```

2. **Chạy `npm install`** — link module vào `node_modules`

3. **Development build** — `expo run:android` hoặc `eas build` — autolinking tự thêm module

4. **Expo Go** — Module tùy chỉnh **không chạy** trên Expo Go. Cần development build.

### So sánh với Codegen

| | Expo Module (này) | Codegen TurboModule |
|--|-------------------|---------------------|
| Spec file | Không cần | Cần Native*.ts |
| Chạy Codegen | Không | Cần `generateCodegenArtifacts` |
| Đăng ký | expo-module.config.json | package.json codegenConfig + native |
| New Arch | JSI tự động | JSI qua Codegen |
