# Auth Password UX Improvement Design

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Cải thiện UX nhập mật khẩu trên tất cả màn có password input — thêm show/hide toggle còn thiếu, redesign `PasswordRulesInput` sang strength bar + rule tags, tạo `PasswordInputField` nhẹ cho các ô không cần rules.

**Scope:** Login, Register, Forgot Password (Reset), Change Password. Không thay đổi phone number input (giữ nguyên format 10 digits).

---

## Architecture

### 2 component password

| Component                       | Mục đích                                             | Screens                                                                              |
| ------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `PasswordRulesInput` (cập nhật) | Ô tạo/đổi mật khẩu mới — có strength bar + rule tags | Register (new), Reset Password (new), Change Password (new)                          |
| `PasswordInputField` (mới)      | Ô nhập mật khẩu thông thường — chỉ show/hide toggle  | Login, Register (confirm), Reset Password (confirm), Change Password (old + confirm) |

### Files tạo mới

- `components/input/password-input-field.tsx`

### Files sửa

- `components/input/password-rules-input.tsx` — redesign UI
- `components/auth/login-form.tsx`
- `components/auth/register-form.tsx`
- `components/form/reset-password-form.tsx`
- `app/profile/change-password.tsx`

### Files không đổi

- `hooks/use-password-rules.ts` — logic tính strength giữ nguyên
- `schemas/auth.schema.ts` — validation rules giữ nguyên
- `components/form/forgot-password-identity-form.tsx` — phone input không đổi

---

## Component Specs

### `PasswordInputField` (mới)

File: `components/input/password-input-field.tsx`

Props:

```tsx
interface PasswordInputFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  disabled?: boolean
  error?: string
}
```

Behavior:

- `TextInput` với `secureTextEntry` toggle qua local `useState(false)`
- Icon `Eye` / `EyeOff` từ `lucide-react-native`, absolute right-12
- Border đổi màu khi error: `border-red-500` thay vì `border-gray-300`
- Error text hiển thị bên dưới khi `error` prop có giá trị
- Style: `bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 pr-12 text-base text-gray-900 dark:text-white` — đồng nhất với `Input` component hiện tại (NativeWind, BeVietnamPro font)
- Không dùng React Hook Form controller bên trong — consumer tự wrap bằng `Controller`

### `PasswordRulesInput` (redesign)

File: `components/input/password-rules-input.tsx`

Props giữ nguyên interface hiện tại (`value`, `onChange`, `placeholder`, `disabled`, `rules`, `strength`, `labels`, `showRules`).

**UI thay đổi** — thay bullet list text bằng:

1. **Strength bar** — 3 segment ngang, mỗi segment `h-1 rounded-full`, gap 4:
   - `strength = 'weak'` → 1 segment đỏ (`bg-red-500`), 2 còn lại xám
   - `strength = 'medium'` → 2 segment vàng (`bg-amber-500`), 1 còn lại xám
   - `strength = 'strong'` → 3 segment xanh (`bg-green-500`)
   - Khi chưa touched: tất cả xám

2. **Rule tags hàng ngang** — `flex-row flex-wrap gap-1.5`, cùng hàng với strength label:
   - Tag met: `bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs` + prefix `✓`
   - Tag unmet: `bg-gray-100 text-gray-400 rounded-full px-2 py-0.5 text-xs` + prefix `✗`
   - 3 tags: `8+ ký tự`, `Chữ cái`, `Số`

3. **Strength label** — bên phải hàng tags, `text-xs font-semibold`:
   - weak: `text-red-500`
   - medium: `text-amber-500`
   - strong: `text-green-600`

4. **Hiển thị điều kiện:** `showRules && touched` — giữ nguyên logic, chỉ thay UI.

---

## Screen Migration

### Login — `components/auth/login-form.tsx`

- Ô **Mật khẩu**: thay `FormInput` với show/hide thủ công → `PasswordInputField` bọc trong `Controller`
- Không cần `PasswordRulesInput` (login không validate password format phía client)

### Register — `components/auth/register-form.tsx`

- Ô **Mật khẩu mới**: giữ `PasswordRulesInput`, UI tự động cập nhật theo redesign
- Ô **Xác nhận mật khẩu**: thay `FormInput` → `PasswordInputField` bọc trong `Controller`

### Reset Password — `components/form/reset-password-form.tsx`

- Ô **Mật khẩu mới**: giữ `PasswordRulesInput`, UI tự động cập nhật
- Ô **Xác nhận mật khẩu**: thay `TextInput` thuần → `PasswordInputField` bọc trong `Controller` (fix inconsistency hiện tại — ô này đang thiếu show/hide)

### Change Password — `app/profile/change-password.tsx`

- Ô **Mật khẩu cũ**: thay `Input` thuần → `PasswordInputField`
- Ô **Mật khẩu mới**: thay `Input` thuần → `PasswordRulesInput`
- Ô **Xác nhận mật khẩu**: thay `Input` thuần → `PasswordInputField`
- Màn này hiện không dùng React Hook Form — cần wrap với `Controller` hoặc dùng props trực tiếp tùy theo cách state được quản lý

---

## Visual States

### PasswordRulesInput

| Trạng thái               | Bar            | Tags              | Label                  |
| ------------------------ | -------------- | ----------------- | ---------------------- |
| Chưa nhập (`!touched`)   | 3 segment xám  | Ẩn                | Ẩn                     |
| Yếu (< 2 rules met)      | 1 đỏ + 2 xám   | Hiện, unmet = xám | "Yếu" đỏ               |
| Trung bình (2 rules met) | 2 vàng + 1 xám | Hiện, met = xanh  | "Trung bình" vàng      |
| Mạnh (3 rules met)       | 3 xanh         | Hiện, tất cả xanh | "Mạnh" xanh            |
| Lỗi validation           | Giữ nguyên bar | Giữ nguyên tags   | Error text đỏ bên dưới |

### PasswordInputField

| Trạng thái    | Border            | Eye icon      |
| ------------- | ----------------- | ------------- |
| Default       | `border-gray-300` | Eye (ẩn)      |
| Focused       | `border-primary`  | Eye (ẩn)      |
| Show password | `border-primary`  | EyeOff (hiện) |
| Error         | `border-red-500`  | Eye           |

---

## i18n

Các label strength/rules đã được i18n qua `usePasswordRules` hook hiện tại. Không cần thêm key mới.

Nếu `change-password.tsx` chưa dùng i18n cho password labels, thêm vào namespace `profile` các key:

- `changePassword.oldPassword`
- `changePassword.newPassword`
- `changePassword.confirmPassword`

---

## Không trong scope

- Thay đổi Zod validation schema
- Thay đổi phone number format
- Auto-advance giữa các ô
- Password strength algorithm (giữ nguyên `usePasswordRules`)
- Màn verify-phone, verify-email (không có password input)
