// Sửa đơn — các lỗi làm sai đơn / mất tiền. Kiểm trên mã nguồn.
import * as fs from 'fs'
import * as path from 'path'

const read = (rel: string) =>
  fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

const confirm = read(
  'app/update-order/components/confirm-update-order-dialog.tsx',
)
const screen = read('app/update-order/[slug].tsx')
const footer = read('app/update-order/components/update-order-footer.tsx')
const content = read(
  'app/update-order/components/update-order-content-native.tsx',
)
const flow = read('stores/order-flow.store.ts')

describe('Gửi thay đổi', () => {
  it('US1 chặn bấm hai lần bằng ref (state chưa kịp render lại)', () => {
    expect(confirm).toMatch(/submittingRef\.current\) return/)
    expect(confirm).toMatch(/submittingRef\.current = true/)
  })

  it('US2 hỏng giữa chừng: tải lại đơn từ server, dựng lại bản nháp', () => {
    const fail = confirm.slice(confirm.indexOf('} catch'))
    expect(fail).toMatch(/hasApplied/)
    expect(fail).toMatch(/fetchQuery\(/)
    expect(fail).toMatch(/initializeUpdating\(/)
    expect(fail).toMatch(/order\.updateOrderPartialFailed/)
  })

  it('US3 không gửi bản nháp của đơn khác', () => {
    expect(confirm).toMatch(/originalOrder\.slug !== orderSlug/)
  })

  it('US4 màn đã đóng thì không tự chuyển sang thanh toán', () => {
    expect(confirm).toMatch(
      /if \(isMountedRef\.current\)[\s\S]{0,40}navigateNative\.replace/,
    )
  })

  it('US5 lưu xong làm mới cả danh sách đơn', () => {
    expect(confirm).toMatch(/queryKey: \['orders'\]/)
  })

  it('US6 báo màn đang gửi (để hết giờ / polling không chen vào)', () => {
    expect(confirm).toMatch(/setSubmitting\(true\)/)
    expect(confirm).toMatch(/setSubmitting\(false\)/)
  })
})

describe('Màn sửa đơn', () => {
  it('US7 chỉ hiện khi bản nháp đúng là của đơn đang mở', () => {
    expect(screen).toMatch(/draftSlug === slug/)
  })

  it('US8 tải đơn lỗi thì báo lỗi + thử lại, không hiện bản nháp cũ', () => {
    expect(screen).toMatch(/<QueryErrorState/)
  })

  it('US9 rời màn thì xoá bản nháp', () => {
    expect(screen).toMatch(/return \(\) => clearUpdatingData\(\)/)
  })

  it('US10 đang gửi thì không hết giờ, không polling', () => {
    expect(screen).toMatch(/isExpired && !isSubmitting/)
    expect(screen).toMatch(
      /!isOrderPending \|\| !isDataLoaded \|\| isExpired \|\| isSubmitting/,
    )
  })

  it('US11 đơn đổi trạng thái (đã trả / huỷ) thì báo rõ, không âm thầm xoá sửa đổi', () => {
    expect(screen).toMatch(/toast\.orderNoLongerEditable/)
    expect(screen).not.toMatch(/setShouldReinitialize/)
  })
})

describe('Thanh dưới & thẻ món', () => {
  it('US12 không cho xác nhận đơn 0 món', () => {
    expect(footer).toMatch(/orderItems\.length === 0/)
  })

  it('US13 thanh dưới và sheet xác nhận cùng một chỗ tính tiền', () => {
    expect(footer).toMatch(/useUpdateOrderPayable\(\)/)
    expect(confirm).toMatch(/useUpdateOrderPayable\(\)/)
    expect(footer).not.toMatch(/subTotalBeforeDiscount/)
  })

  it('US14 ô số lượng / ghi chú theo đúng món khi FlashList tái dùng ô', () => {
    expect(content).toMatch(/useRecyclingState<number \| null>/)
    expect(content).toMatch(/useRecyclingState\(item\.note/)
  })

  it('US15 sheet loại đơn theo cờ khoá loại đơn', () => {
    const sheet = read(
      'app/update-order/components/simple-order-type-sheet-in-update-order.tsx',
    )
    expect(sheet).toMatch(/useOrderTypeOptionsForUpdateOrder\(\)/)
  })
})

describe('Giỏ sau khi sửa đơn', () => {
  it('US16 xoá bản nháp thì giỏ về lại bước đặt món (badge không còn 0)', () => {
    const clear = flow.slice(flow.indexOf('clearUpdatingData: () =>'))
    expect(clear.slice(0, 500)).toMatch(/OrderFlowStep\.ORDERING/)
  })

  it('US17 mở lại app khi đang ở bước sửa đơn thì về bước đặt món', () => {
    const rehydrate = flow.slice(flow.indexOf('onRehydrateStorage'))
    expect(rehydrate).toMatch(
      /currentStep === OrderFlowStep\.UPDATING[\s\S]{0,80}OrderFlowStep\.ORDERING/,
    )
  })
})

describe('Xoá món khi sửa đơn', () => {
  it('US18 vuốt để xoá như giỏ, bỏ dialog xác nhận (vỡ giao diện)', () => {
    expect(content).toMatch(/<CartSwipeable/)
    expect(content).not.toMatch(/RemoveOrderItemInUpdateOrderDialog/)
  })

  it('US19 còn một món thì không vuốt xoá được (đơn 0 món không lưu được)', () => {
    expect(content).toMatch(/canDelete = totalOrderItems > 1/)
  })
})
