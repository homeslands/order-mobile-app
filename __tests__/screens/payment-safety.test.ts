// Khoá các sửa lỗi luồng tiền ở màn Thanh toán: không gửi lệnh trả hai lần,
// lỗi thì kiểm tra lại với server, không báo "chưa thanh toán" khi chính lần
// kiểm tra bị lỗi, không xoá QR khách đang quét vì một lần tải lại lỗi.
// Màn quá nặng để render trong test nên kiểm trên mã nguồn.
import * as fs from 'fs'
import * as path from 'path'

function read(rel: string) {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

const page = read('app/payment/[order].tsx')
const dialog = read('app/payment/payment-point-confirm-dialog.tsx')
const loyalty = read('app/payment/loyalty-points-input.tsx')
// Đọc nguyên văn: file có chuỗi 'image/*' — bộ lọc comment /* */ sẽ cắt nhầm.
const download = fs.readFileSync(
  path.resolve(__dirname, '../..', 'utils/download-image.ts'),
  'utf-8',
)

function block(src: string, start: string, len = 3000) {
  const i = src.indexOf(start)
  expect(i).toBeGreaterThan(-1)
  return src.slice(i, i + len)
}

it('PS1 không gửi lệnh trả hai lần: khoá trước khi gửi, mở khoá khi xong', () => {
  const exec = block(page, 'const executePayment = useCallback(')
  expect(exec).toMatch(/if \(payingRef\.current\) return/)
  expect(exec).toMatch(/payingRef\.current = true[\s\S]*initiatePayment\(/)
  expect(exec).toMatch(/onSettled:[\s\S]*payingRef\.current = false/)
})

it('PS2 hộp xác nhận trả bằng điểm tắt nút Xác nhận khi đang gửi', () => {
  expect(dialog).toMatch(/disabled=\{isBusy\}/)
  expect(page).toMatch(
    /<PointConfirmDialog[\s\S]{0,400}isBusy=\{isInitiatingPayment\}/,
  )
})

it('PS3 trả lỗi: tải lại đơn (và số dư) để biết thật sự đã trả chưa', () => {
  const exec = block(page, 'const executePayment = useCallback(')
  const onError = exec.slice(exec.indexOf('onError:'))
  expect(onError).toMatch(/refetchOrder\(\)/)
  expect(onError).toMatch(/refetchCoinBalance\(\)/)
})

it('PS4 "Kiểm tra thanh toán" lỗi thì báo không kiểm tra được, không báo "chưa thanh toán"', () => {
  const check = block(page, 'const handleCheckPayment = useCallback(', 800)
  expect(check).toMatch(/res\.isError/)
  expect(check).toMatch(/order\.checkPaymentFailed/)
})

it('PS5 lỗi tải lại khi đã có đơn: không thay cả màn (giữ QR)', () => {
  expect(page).toMatch(/if \(isOrderError && !order\)/)
})

it('PS6 bấm Thanh toán với đơn đã trả: có phản hồi, không im lặng', () => {
  const submit = block(page, 'const handlePaymentSubmit = useCallback(', 1500)
  expect(submit).toMatch(/order\.alreadyPaidUpdating/)
})

it('PS7 lỗi dùng / huỷ điểm: không che lý do thật từ server', () => {
  expect(loyalty).toMatch(/extractStatusCode\(error\) == null/)
})

it('PS8 tải ảnh QR có hạn chờ, không treo mãi', () => {
  expect(download).toMatch(/AbortController/)
})
