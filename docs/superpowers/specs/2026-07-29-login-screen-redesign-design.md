# Thiết kế lại màn đăng nhập

**Ngày:** 2026-07-29
**Trạng thái:** đã duyệt, chờ lập kế hoạch triển khai

## Bối cảnh

Màn đăng nhập hiện tại (`app/auth/login.tsx` + `components/auth/login-form.tsx`) có 3 vấn đề người dùng nêu:

1. **Bố cục & khoảng cách chưa đẹp** — `ScrollView` không có `flexGrow: 1` nên nội dung dồn lên đỉnh, để lại vùng trống chết phía dưới trên máy màn dài. Các khoảng cách `pt-12` / `mb-8` / `mb-6` / `mb-4` đặt tay, không theo thang nào.
2. **Cụm link cuối màn rối** — 3 link chữ ("Quên mật khẩu", "Đăng ký", "Quay lại trang chủ") xếp chồng, ngang hàng nhau về mặt thị giác, không rõ đâu là hành động chính.
3. **Trống trải, thiếu nhận diện thương hiệu** — không logo, không hình ảnh, chỉ có tiêu đề chữ và 2 ô nhập.

Kèm theo là một nhóm yêu cầu chức năng mới: phản hồi lỗi bằng animation, haptic, hỗ trợ trình quản lý mật khẩu, và chống nhảy layout khi mở bàn phím.

### Phụ thuộc vào công việc chưa commit

Spec này xây trên phần sửa `useMirroredField` đang nằm trong working tree (chưa commit):

- `hooks/use-mirrored-field.ts` — hook mirror + debounce, tách ra từ `FormInput`
- `components/form/form-input.tsx`, `components/input/password-input-field.tsx`, `components/input/password-rules-input.tsx` — đã chuyển sang dùng hook
- `__tests__/components/form/form-input.test.tsx`, `__tests__/components/input/password-input-field.test.tsx`

## Phạm vi

**Trong phạm vi**

- `app/auth/login.tsx` — dựng lại toàn bộ phần khung màn
- `components/auth/login-form.tsx` — thu hẹp còn thuần form
- `components/auth/login-sheet-portal.tsx` — bù lại phần tiêu đề/footer bị lấy khỏi `LoginForm`
- `components/input/password-input-field.tsx` — haptic, autofill, `autoCorrect`/`spellCheck`
- `components/form/form-input.tsx` — viền đỏ theo `invalid` thay vì theo chuỗi lỗi
- `hooks/use-mirrored-field.ts` — bỏ debounce
- `constants/motion.ts` — thêm preset `SHAKE`

**Ngoài phạm vi**

- Đăng nhập bằng mạng xã hội, sinh trắc học, ghi nhớ đăng nhập
- Associated Domains / `apple-app-site-association` để chia sẻ mật khẩu với website
- Thay ảnh `assets/images/auth/login-background.jpg` (không dùng trong hướng đã chọn)
- Chuyển nút submit sang `Button` dùng chung — xem phần "Quyết định không làm"

## Hướng đã chọn

Đã cân nhắc 3 hướng đưa thương hiệu vào màn (xem mockup trong `.superpowers/brainstorm/`):

| Hướng | Nội dung | Kết quả |
|---|---|---|
| A | Logo gọn ở đầu màn, không ảnh | **Chọn** |
| B | Hero ảnh `login-background.jpg` + form trên card bo góc | Loại — ảnh stock flat-lay tông mùa thu, không mang nhận diện riêng của Trend Coffee |
| C | Dải gradient màu primary thay ảnh | Loại — nặng nề về thị giác so với nhu cầu |

Cả 3 hướng đều xử lý giống nhau 2 vấn đề đầu (vùng trống chết, cụm link rối), nên lựa chọn chỉ nằm ở phần thương hiệu.

## Ranh giới component

Nguyên nhân gốc khiến bố cục khó chỉnh: `LoginForm` đang ôm cả tiêu đề màn, form, và 3 link điều hướng, đồng thời được render ở **bốn ngữ cảnh** — full screen (`app/auth/login.tsx`), bottom sheet 90% (`login-sheet-portal.tsx`), và trạng thái chưa đăng nhập của hai màn Hồ sơ (`app/(tabs)/profile/index.tsx`, `app/profile/index.tsx`). Vì thế `pt-12` và "Quay lại trang chủ" vô nghĩa khi nằm trong sheet nhưng không gỡ được.

| Đơn vị | Chịu trách nhiệm | Không chứa |
|---|---|---|
| `LoginForm` | 2 ô nhập, link "Quên mật khẩu", nút Đăng nhập, gọi mutation, animation lắc | tiêu đề, logo, link đăng ký, nút thoát |
| `LoginPanel` | nút X (nếu có `onClose`), logo (nếu `showLogo`), tiêu đề/mô tả, `<LoginForm>`, footer "Đăng ký ngay", lề ngang | safe area, vùng cuộn, nền |
| `app/auth/login.tsx`, `login-sheet-portal.tsx`, hai màn Hồ sơ | safe area, vùng cuộn (`ScrollView` / `BottomSheetScrollView` / không cuộn), nền | chrome đăng nhập |

Sau khi tách, đổi bố cục màn login không còn đụng tới bottom sheet.

**Đánh đổi:** bắt buộc phải sửa `login-sheet-portal.tsx`, vì nó đang hưởng "miễn phí" tiêu đề và link đăng ký nằm sẵn trong `LoginForm`. Ngoài màn login, hai màn Hồ sơ (`app/(tabs)/profile/index.tsx`, `app/profile/index.tsx`) cũng bị ảnh hưởng — trạng thái chưa đăng nhập của chúng render `LoginForm` trần, không có chrome nào.

## Bố cục

```
ScreenContainer edges={['top','bottom']}
└ KeyboardAvoidingView  behavior={ios ? 'padding' : undefined}
  └ ScrollView contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
    └ View flex-1, px-6
      ├ nút X          34×34, hitSlop 8
      ├ logo           120×32, contentFit="contain"
      ├ "Đăng nhập" + mô tả
      ├ <LoginForm />
      ├ View flex-1    spacer co giãn
      └ footer         "Chưa có tài khoản? Đăng ký ngay"
```

Thang khoảng cách thay cho các số đặt tay hiện tại:

| Vị trí | px |
|---|---|
| X → logo | 24 |
| logo → tiêu đề | 24 |
| tiêu đề → mô tả | 8 |
| mô tả → ô đầu tiên | 28 |
| giữa 2 ô | 16 |
| ô mật khẩu → "Quên mật khẩu?" | 9 |
| "Quên mật khẩu?" → nút Đăng nhập | 22 |
| nút → footer | co giãn, tối thiểu 24 |

`flexGrow: 1` cộng spacer là thứ xử lý vùng trống chết: màn cao thì spacer nở ra đẩy footer xuống đáy; màn thấp hoặc bàn phím bật lên thì spacer co về 0 và nội dung cuộn bình thường.

**"Quên mật khẩu?"** chuyển từ hàng label sang **dưới ô mật khẩu, căn trái**. Hàng label chỉ còn chữ "Mật khẩu".

## Nút thoát

Login được mở bằng hai kiểu khác nhau:

- **Có back stack** (`push`): `app/(tabs)/gift-card.tsx:201`, `:416`, `app/(tabs)/menu/product/[id].tsx:261`, `app/order/[id].tsx:153`
- **Không có gì để back về** (`replace` / `Redirect`): `app/onboarding.tsx:197`, `components/auth/register-phone-form.tsx:45,81,136`, `app/auth/forgot-password.tsx:394`, `components/form/reset-password-form.tsx:114`, `components/form/forgot-password-identity-form.tsx:63`, `app/gift-card/checkout/index.tsx:398`

Nút back thuần sẽ chết ở nhóm thứ hai. Ngược lại, nhóm `push` vốn đã có sẵn đường thoát của hệ điều hành (vuốt cạnh trên iOS, back cứng trên Android). Chỗ thật sự cần một nút trên màn hình chính là nhóm `replace`: vào từ onboarding hoặc luồng đăng ký rồi đổi ý thì không có cách nào ra để xem tiếp với tư cách khách.

**Quyết định:** một nút X ở góc trên trái, luôn hiện, hành vi thích ứng:

```ts
router.canGoBack() ? router.back() : router.replace('/(tabs)/home')
```

Pattern này đã dùng trong codebase tại `app/cart/index.tsx:45`. Nút X thay thế hoàn toàn dòng "Quay lại trang chủ" — đó là thứ cho phép rút cụm link cuối màn xuống còn một dòng.

## Thương hiệu

`Images.Brand.Logo` (sáng) / `Images.Brand.LogoWhite` (tối), 120×32, `contentFit="contain"`, render bằng `expo-image` giống `components/layout/tab-header.tsx:68`.

`logo.png` đã là lockup hoàn chỉnh (chữ TREND cam + COFFEE nâu + swoosh) nên **không** thêm chữ "Trend Coffee" bên cạnh. Logo giữ kích thước cố định, không nhân với `useFontScale`, để header không vỡ khi người dùng đặt cỡ chữ lớn.

## Phản hồi khi sai thông tin

Khi `useLogin` trả lỗi:

1. Bật trạng thái invalid cho **cả 2 ô** → viền đỏ (`border-destructive`)
2. Chạy animation lắc
3. Phát haptic light đúng thời điểm bắt đầu lắc
4. Toast lỗi giữ nguyên như hiện tại (do global error handler của QueryCache đảm nhiệm)

**Animation lắc**

- Thêm preset `SHAKE` vào `constants/motion.ts` — biên độ 8px, 4 nhịp ~50ms, dùng `withTiming` trong `withSequence`. Không hardcode thông số tại chỗ dùng, theo quy ước trong `CLAUDE.md`.
- Bọc **cả 2 ô cùng nhãn của chúng trong một `Animated.View`** và lắc chung, thay vì lắc rời từng ô: đọc ra như một khối báo lỗi có chủ đích, và chỉ cần một shared value.
- Link "Quên mật khẩu" và nút Đăng nhập nằm ngoài khối lắc, đứng yên.

**Không hiện chữ lỗi dưới ô.** Chữ lỗi làm đổi chiều cao ô, đá thẳng vào yêu cầu chống nhảy layout. Nội dung lỗi đã nằm trong toast.

**Hệ quả kỹ thuật:** `FormInput` hiện quyết định viền đỏ bằng `!!error?.message`, nên `setError` với message rỗng sẽ không đổi viền. Phải chuyển sang xét `fieldState.invalid`.

Viền đỏ tự xóa khi người dùng sửa bất kỳ ô nào, không đợi submit lại.

## Haptic

Light impact tại 2 điểm:

- Nút ẩn/hiện mật khẩu trong `PasswordInputField`
- Thời điểm kích hoạt animation lắc

Dùng đúng pattern sẵn có: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})` (`components/navigation/pressable-with-feedback.tsx:37`).

`PasswordInputField` dùng ở 5 màn (login, đăng ký, quên mật khẩu, đổi mật khẩu, xóa tài khoản) nên haptic của nút mắt sẽ áp dụng toàn app — đây là chủ ý, không phải tác dụng phụ.

## Trình quản lý mật khẩu, paste, bàn phím

| Ô | Thuộc tính |
|---|---|
| SĐT | `textContentType="username"`, `autoComplete="tel"`, `importantForAutofill="yes"`, `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}`, `keyboardType="number-pad"` |
| Mật khẩu | `textContentType="password"`, `autoComplete="password"`, `importantForAutofill="yes"`, `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}` |

`PasswordInputField` hiện **thiếu** `autoCorrect` và `spellCheck` — phải bổ sung.

Cặp `username` + `password` trong cùng một màn là điều kiện để iOS và Android nhận diện đây là biểu mẫu đăng nhập và đề nghị lưu.

**Paste:** không set `contextMenuHidden` ở bất kỳ ô nào, giữ nguyên menu ngữ cảnh của hệ thống.

**Chống nhảy layout khi mở bàn phím:** nguyên nhân hiện tại là `KeyboardAvoidingView behavior="height"` trên Android chồng lên `adjustResize` mà Expo đã bật mặc định (`app.json` không khai `softwareKeyboardLayoutMode`), thành ra xử lý hai lần. Sửa thành `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`. Cộng với việc không render chữ lỗi và spacer `flex-1` hấp thụ phần chiều cao đổi.

## Bỏ debounce

Autofill xung đột trực tiếp với debounce 300ms trong `useMirroredField`: trình quản lý mật khẩu bơm text vào cả 2 ô rồi người dùng bấm Đăng nhập ngay, nhưng giá trị mới chỉ nằm ở state cục bộ, chưa vào React Hook Form → submit rỗng, báo lỗi validate oan. Ô mật khẩu thường không blur nên cũng không có gì flush.

**Quyết định:** bỏ hẳn debounce, đẩy vào form ngay mỗi ký tự.

Lý do: lớp mirror (`lastPushedRef` + local state) mới là thứ chống giật và chống mất ký tự; debounce chỉ để tránh chạy Zod mỗi phím, mà schema login chỉ có 2 phép kiểm tra chuỗi. Bỏ debounce thì không còn khoảng lệch nào giữa form và ô nhập, không cần cơ chế flush, ít code hơn.

**Giữ nguyên** `lastPushedRef` — nó độc lập với debounce và vẫn cần để chặn tiếng vọng từ React Hook Form ghi đè ký tự vừa gõ.

**Ảnh hưởng:** 5 form đang dùng `FormInput` / `PasswordInputField` / `PasswordRulesInput` chuyển sang đẩy mỗi ký tự. Hai file test hiện có phải bỏ phần `advanceTimersByTime`.

## Quyết định không làm

**Không chuyển nút submit sang `Button` dùng chung.** `Button` trong `components/ui/button.tsx` là `rounded-full`, đặt cạnh các ô nhập `rounded-lg` sẽ lệch. Nút hiện tại (`rounded-lg`) ăn nhập hơn với phần còn lại của màn. Người dùng cũng không nêu đây là vấn đề. Ghi nhận là điểm không đồng nhất giữa các màn auth (`reset-password-form.tsx` có dùng `Button`), để xử lý riêng nếu cần.

## Kiểm thử

| Kiểm thử | Cách |
|---|---|
| Nút X có back stack | mock `router.canGoBack() → true`, assert gọi `back()` |
| Nút X không có stack | mock `→ false`, assert `replace('/(tabs)/home')` |
| Autofill điền cả chuỗi | bắn `onChangeText('0901234567')` một lần, assert form nhận ngay, submit đúng giá trị |
| Sai thông tin | mock mutation lỗi, assert 2 ô vào trạng thái invalid và haptic được gọi |
| Sửa lại ô | assert trạng thái invalid được xóa |
| Hồi quy mirror | sửa 2 file test hiện có, bỏ `advanceTimersByTime` |

Animation lắc không assert được từng frame trong jest. Chỉ test được là nó **được kích hoạt**; dáng lắc thực tế phải kiểm bằng mắt trên máy thật.

## Giới hạn đã biết

- **Độ mượt của ô nhập chỉ verify được trên máy thật.** Jest gộp mọi update thành đồng bộ nên không tái hiện được độ trễ vài frame vốn là nguyên nhân gây giật. Bộ test chỉ chống hồi quy cho logic mirror.
- **iCloud Keychain chia sẻ mật khẩu với website** cần Associated Domains + `apple-app-site-association` trên server. Không có nó thì autofill vẫn chạy nhưng giới hạn trong mật khẩu đã lưu cho riêng app.
- **`i18n` key `login.goBackToHome`** không còn dùng trong UI sau thay đổi này. Giữ lại trong file dịch, không xóa.
- **Chrome đăng nhập giờ nằm ở một chỗ (`LoginPanel`)**: đổi nó ảnh hưởng cả bốn màn render `LoginForm` — full screen, bottom sheet, và hai màn Hồ sơ ở trạng thái chưa đăng nhập.
