// Use cases C1–C23 cho màn xác nhận / trả / biên lai QR xu
// (app/payment/point-confirm.tsx). Mock ở ranh giới API, QueryClient thật
// (retry: false) để các hook chạy thật.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import dayjs from 'dayjs'
import { ActivityIndicator, StyleSheet } from 'react-native'

import { getBalance, getOrderBySlug } from '@/api'
import { getPointPaymentQr, payPointPaymentQr } from '@/api/payment'
import PointConfirmScreen from '@/app/payment/point-confirm'
import { Text as RNText } from '@/components/ui/text'
import { colors } from '@/constants'
import { pointPaymentQrKey } from '@/hooks/use-point-payment-qr'
import { markPointQrScanned } from '@/utils/point-qr-handoff'
import { showErrorToast } from '@/utils/toast'

jest.mock('react-native-reanimated', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('react-native-reanimated/mock'),
)

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  initialWindowMetrics: undefined,
}))

jest.mock('@/components/navigation/floating-header', () => ({
  FloatingHeader: ({ title, onBack }: { title: string; onBack: () => void }) => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createElement: h } = require('react')
    const { Pressable, Text } = require('react-native')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return h(
      Pressable,
      { testID: 'header-back', onPress: onBack },
      h(Text, null, `header:${title}`),
    )
  },
}))

// t(key) trả key; có bảng mockDict để dịch vài key khi case cần định dạng
// thật (đơn vị "xu"). Tham số nội suy nối vào cuối: "key[amount=6.400]".
let mockLanguage = 'vi'
const mockDict: Record<string, string> = { 'pointQr.confirm.unit': 'xu' }
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => {} },
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      const base = mockDict[key] ?? key
      if (opts && typeof opts === 'object') {
        const parts = Object.entries(opts as Record<string, unknown>)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(',')
        return `${base}[${parts}]`
      }
      return base
    },
    i18n: { language: mockLanguage },
  }),
}))

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  canGoBack: jest.fn(() => true),
}
let mockParams: { qrData?: string } = {}
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: () => null },
}))

jest.mock('@/api/payment', () => ({
  getPointPaymentQr: jest.fn(),
  payPointPaymentQr: jest.fn(),
}))

jest.mock('@/api', () => ({
  getBalance: jest.fn(),
  getOrderBySlug: jest.fn(),
}))

let mockUserSlug: string | undefined = 'user-b'
jest.mock('@/stores', () => ({
  useUserStore: (selector: (s: unknown) => unknown) =>
    selector({ userInfo: mockUserSlug ? { slug: mockUserSlug } : null }),
}))

jest.mock('@/utils/toast', () => ({
  showErrorToast: jest.fn(),
  showToast: jest.fn(),
  showErrorToastMessage: jest.fn(),
}))

const VALID_QR =
  '00020101021238830011ORDER.POINT0164b7f1fce44fd4a7ddcc4b4711b6b6f13340622dccaa1a8a1a2af26a9633b4ad2a54061600005802VN6228011081992a6895071041d5f0f994630466C9'

const PAID_AT = '2026-09-19T08:30:00Z'

type Status = 'initiate' | 'completed' | 'cancelled'
const qrResult = (status: Status, extra: Record<string, unknown> = {}) => ({
  slug: 'q1',
  code: 'c',
  amount: 6400,
  status,
  orderSlug: 'ord-1',
  branchName: 'Q1 Branch',
  createdAt: '2026-09-19T00:00:00Z',
  ...extra,
})
const qr = (status: Status, extra?: Record<string, unknown>) => ({
  result: qrResult(status, extra),
})

const axiosErr = (status: number, statusCode?: number) => ({
  isAxiosError: true,
  response: { status, data: statusCode ? { statusCode } : {} },
})
const NETWORK = { isAxiosError: true }

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const balanceOf = (points: number) => ({ result: { points } })
const orderOf = (ownerSlug: string, referenceNumber: number | null = null) => ({
  result: { slug: 'ord-1', referenceNumber, owner: { slug: ownerSlug } },
})

let queryClient: QueryClient

function renderScreen() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <PointConfirmScreen />
    </QueryClientProvider>,
  )
}

async function renderReady() {
  const view = renderScreen()
  await screen.findByText('pointQr.confirm.pay')
  // Chờ số dư và đơn về.
  await waitFor(() => expect(screen.queryByText('—')).toBeNull())
  return view
}

function payButton() {
  return screen.getByRole('button', { name: 'pointQr.confirm.pay' })
}

// Pressable đặt accessibilityState.disabled theo prop disabled.
function isDisabled(el: { props: Record<string, unknown> }) {
  return (
    (el.props.accessibilityState as { disabled?: boolean } | undefined)
      ?.disabled === true
  )
}

// Tìm onPress của Pressable bao quanh một Text.
function pressHandler(el: { parent: unknown; props: Record<string, unknown> }) {
  let node: { parent: unknown; props: Record<string, unknown> } | null = el
  while (node) {
    if (typeof node.props.onPress === 'function') {
      return node.props.onPress as () => void
    }
    node = node.parent as typeof node
  }
  throw new Error('no onPress')
}

async function openAndConfirm() {
  fireEvent.press(payButton())
  await act(async () => {
    fireEvent.press(screen.getByText('common:common.confirm'))
  })
}

// jest-expo cài các global lười (winter runtime) khi có module expo được nạp
// giữa chừng test. Nếu lần đọc đầu rơi vào lúc môi trường test đã đóng thì
// cả suite sập với "import outside of the scope" — đọc trước khi đóng.
afterEach(() => {
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

beforeEach(() => {
  jest.clearAllMocks()
  mockLanguage = 'vi'
  mockUserSlug = 'user-b'
  mockParams = { qrData: VALID_QR }
  mockRouter.canGoBack.mockReturnValue(true)
  markPointQrScanned(VALID_QR)
  jest.mocked(getPointPaymentQr).mockResolvedValue(qr('initiate') as never)
  jest.mocked(getBalance).mockResolvedValue(balanceOf(390600) as never)
  jest.mocked(getOrderBySlug).mockResolvedValue(orderOf('user-a') as never)
})

afterEach(() => {
  queryClient?.clear()
})

describe('point-confirm use cases', () => {
  it('C1 no qrData shows invalid with rescan + close', async () => {
    mockParams = {}
    renderScreen()
    expect(screen.getByText('pointQr.errors.invalid')).toBeTruthy()
    expect(screen.getByText('pointQr.confirm.rescan')).toBeTruthy()
    expect(screen.getByText('pointQr.confirm.close')).toBeTruthy()
    expect(screen.queryByText('pointQr.confirm.pay')).toBeNull()
  })

  it('C2 qrData not marked scanned (deep link) shows invalid, no pay button', async () => {
    // Mã khác chưa từng đi qua màn quét — Set trong point-qr-handoff chưa có.
    const DEEP_LINK_QR = VALID_QR.replace('66C9', '0000')
    mockParams = { qrData: DEEP_LINK_QR }
    renderScreen()
    await act(async () => {})
    expect(screen.getByText('pointQr.errors.invalid')).toBeTruthy()
    expect(screen.queryByText('pointQr.confirm.pay')).toBeNull()
  })

  it('C3 preview pending shows loading, no pay button', async () => {
    jest.mocked(getPointPaymentQr).mockReturnValue(new Promise(() => {}))
    renderScreen()
    await act(async () => {})
    expect(screen.queryByText('pointQr.confirm.pay')).toBeNull()
    expect(screen.queryByText('pointQr.errors.invalid')).toBeNull()
    expect(screen.UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0)
  })

  it('C4 happy render shows ticket with correct amounts and words', async () => {
    // Giá trị thật của key merchant là "TREND Coffee".
    expect(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/i18n/vi/payment.json').pointQr.confirm.merchant,
    ).toBe('TREND Coffee')

    const view = await renderReady()
    expect(screen.getByText('pointQr.confirm.merchant')).toBeTruthy()
    expect(screen.getByText('Q1 Branch')).toBeTruthy()
    expect(screen.getByText('ord-1')).toBeTruthy()
    expect(
      screen.getByText('pointQr.confirm.balanceLine[amount=390.600]'),
    ).toBeTruthy()
    expect(screen.getByText('384.200 xu')).toBeTruthy()
    expect(screen.getByText('6.400 xu')).toBeTruthy()
    expect(screen.getByText('(Sáu nghìn bốn trăm xu)')).toBeTruthy()
    expect(isDisabled(payButton())).toBe(false)

    // Không có hai dấu cách liền nhau trong bất kỳ chuỗi số nào.
    const texts = screen
      .UNSAFE_getAllByType(RNText)
      .map((n) => [n.props.children].flat(Infinity).filter((c) => typeof c === 'string' || typeof c === 'number').join(''))
    for (const s of texts) {
      if (/\d/.test(s)) expect(s).not.toMatch(/ {2}/)
    }
    view.unmount()
    queryClient.clear()

    // referenceNumber có → "#<ref>".
    jest.mocked(getOrderBySlug).mockResolvedValue(orderOf('user-a', 123) as never)
    await renderReady()
    await screen.findByText('#123')
    expect(screen.queryByText('ord-1')).toBeNull()
  })

  it('C5 insufficient balance shows short in danger and disables pay', async () => {
    jest.mocked(getBalance).mockResolvedValue(balanceOf(4200) as never)
    await renderReady()
    const short = screen.getByText('pointQr.confirm.short[amount=2.200]')
    expect(StyleSheet.flatten(short.props.style).color).toBe(
      colors.destructive.light,
    )
    expect(isDisabled(payButton())).toBe(true)
  })

  it('C6 balance loading shows dash and disables pay', async () => {
    jest.mocked(getBalance).mockReturnValue(new Promise(() => {}))
    renderScreen()
    await screen.findByText('pointQr.confirm.pay')
    expect(screen.getByText('—')).toBeTruthy()
    expect(isDisabled(payButton())).toBe(true)
  })

  it('C7 balance error shows network + check again that refetches balance', async () => {
    jest.mocked(getBalance).mockRejectedValue(NETWORK)
    renderScreen()
    await screen.findByText('pointQr.errors.network')
    const calls = jest.mocked(getBalance).mock.calls.length
    jest.mocked(getBalance).mockResolvedValue(balanceOf(390600) as never)
    await act(async () => {
      fireEvent.press(screen.getByText('pointQr.confirm.checkAgain'))
    })
    expect(jest.mocked(getBalance).mock.calls.length).toBe(calls + 1)
    await screen.findByText('pointQr.confirm.pay')
  })

  it('C8 cached preview completed/cancelled shows alreadyPaid/cancelled', async () => {
    for (const [status, key] of [
      ['completed', 'pointQr.errors.alreadyPaid'],
      ['cancelled', 'pointQr.errors.cancelled'],
    ] as const) {
      jest.mocked(getPointPaymentQr).mockResolvedValue(qr(status) as never)
      queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      })
      queryClient.setQueryData(pointPaymentQrKey(VALID_QR), qrResult(status))
      const view = render(
        <QueryClientProvider client={queryClient}>
          <PointConfirmScreen />
        </QueryClientProvider>,
      )
      expect(screen.getByText(key)).toBeTruthy()
      expect(screen.queryByText('pointQr.confirm.pay')).toBeNull()
      await act(async () => {})
      view.unmount()
      queryClient.clear()
    }
  })

  it('C9 preview error 160213 shows mismatch', async () => {
    jest.mocked(getPointPaymentQr).mockRejectedValue(axiosErr(400, 160213))
    renderScreen()
    expect(await screen.findByText('pointQr.errors.mismatch')).toBeTruthy()
  })

  it('C10 pay opens dialog; cancel closes it without calling pay', async () => {
    await renderReady()
    fireEvent.press(payButton())
    expect(
      screen.getByText('paymentMethod.confirmPointPaymentTitle'),
    ).toBeTruthy()
    await act(async () => {
      fireEvent.press(screen.getByText('common:common.cancel'))
    })
    expect(
      screen.queryByText('paymentMethod.confirmPointPaymentTitle'),
    ).toBeNull()
    expect(payPointPaymentQr).not.toHaveBeenCalled()
  })

  it('C11 confirm pays once and shows receipt', async () => {
    jest
      .mocked(payPointPaymentQr)
      .mockResolvedValue(qr('completed', { paidAt: PAID_AT }) as never)
    await renderReady()
    await openAndConfirm()
    expect(payPointPaymentQr).toHaveBeenCalledTimes(1)
    expect(payPointPaymentQr).toHaveBeenCalledWith(VALID_QR)
    await screen.findByText('pointQr.confirm.successTitleOther')
    expect(screen.getByText('6.400 xu')).toBeTruthy()
    expect(screen.getByText('384.200 xu')).toBeTruthy()
    expect(
      screen.getByText(dayjs(PAID_AT).format('HH:mm · DD/MM/YYYY')),
    ).toBeTruthy()
    expect(screen.getByText('pointQr.confirm.order')).toBeTruthy()
    expect(screen.getByText('ord-1')).toBeTruthy()
    expect(screen.getByText('header:pointQr.confirm.receiptTitle')).toBeTruthy()
  })

  it('C12 two quick confirm taps call pay once', async () => {
    const d = deferred<ReturnType<typeof qr>>()
    jest.mocked(payPointPaymentQr).mockReturnValue(d.promise as never)
    await renderReady()
    fireEvent.press(payButton())
    const confirm = pressHandler(
      screen.getByText('common:common.confirm') as never,
    )
    await act(async () => {
      confirm()
      confirm()
    })
    // Nút chân trang (đang quay spinner) bấm tiếp cũng không gọi thêm.
    fireEvent.press(screen.getByRole('button'))
    await act(async () => {
      d.resolve(qr('completed', { paidAt: PAID_AT }))
      await d.promise
    })
    expect(payPointPaymentQr).toHaveBeenCalledTimes(1)
    await screen.findByText('pointQr.confirm.successTitleOther')
  })

  it('C13 pay rejects 160207/160208/160209/160213 shows failed + rescan', async () => {
    const cases: [number, string][] = [
      [160207, 'alreadyPaid'],
      [160208, 'cancelled'],
      [160209, 'orderChanged'],
      [160213, 'mismatch'],
    ]
    for (const [code, kind] of cases) {
      mockRouter.replace.mockClear()
      jest.mocked(payPointPaymentQr).mockRejectedValueOnce(axiosErr(400, code))
      const view = await renderReady()
      await openAndConfirm()
      await screen.findByText(`pointQr.errors.${kind}`)
      fireEvent.press(screen.getByText('pointQr.confirm.rescan'))
      expect(mockRouter.replace).toHaveBeenCalledWith('/payment/scan-point')
      view.unmount()
      queryClient.clear()
    }
  })

  it('C14 pay rejects 158205 toasts, stays on confirm, refetches balance', async () => {
    jest.mocked(payPointPaymentQr).mockRejectedValue(axiosErr(400, 158205))
    await renderReady()
    const before = jest.mocked(getBalance).mock.calls.length
    await openAndConfirm()
    expect(showErrorToast).toHaveBeenCalledWith(158205)
    await waitFor(() => expect(payButton()).toBeTruthy())
    expect(screen.getByText('pointQr.confirm.pay')).toBeTruthy()
    await waitFor(() =>
      expect(jest.mocked(getBalance).mock.calls.length).toBeGreaterThan(before),
    )
  })

  it('C15a network error → recheck initiate → safeToRetry, retry pays again', async () => {
    jest.mocked(payPointPaymentQr).mockRejectedValueOnce(NETWORK)
    await renderReady()
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.safeToRetry')
    expect(getPointPaymentQr).toHaveBeenCalledTimes(2)
    jest
      .mocked(payPointPaymentQr)
      .mockResolvedValueOnce(qr('completed', { paidAt: PAID_AT }) as never)
    await act(async () => {
      fireEvent.press(screen.getByText('pointQr.confirm.retry'))
    })
    expect(payPointPaymentQr).toHaveBeenCalledTimes(2)
    await screen.findByText('pointQr.confirm.successTitleOther')
  })

  it('C15b network error → recheck completed → maybePaid, view history, no retry', async () => {
    jest.mocked(payPointPaymentQr).mockRejectedValueOnce(NETWORK)
    await renderReady()
    jest.mocked(getPointPaymentQr).mockResolvedValue(qr('completed') as never)
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.maybePaid')
    expect(screen.queryByText('pointQr.confirm.retry')).toBeNull()
    expect(screen.queryByText('pointQr.confirm.pay')).toBeNull()
    fireEvent.press(screen.getByText('pointQr.confirm.viewHistory'))
    expect(mockRouter.replace).toHaveBeenCalledWith('/profile/coin-hub')
  })

  it('C15c network error → recheck network → stillOffline with check again', async () => {
    jest.mocked(payPointPaymentQr).mockRejectedValueOnce(NETWORK)
    await renderReady()
    jest.mocked(getPointPaymentQr).mockRejectedValue(NETWORK)
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.stillOffline')
    const calls = jest.mocked(getPointPaymentQr).mock.calls.length
    await act(async () => {
      fireEvent.press(screen.getByText('pointQr.confirm.checkAgain'))
    })
    expect(jest.mocked(getPointPaymentQr).mock.calls.length).toBe(calls + 1)
    expect(payPointPaymentQr).toHaveBeenCalledTimes(1)
  })

  it('C16 pay 500 unknown code takes the recheck path', async () => {
    jest.mocked(payPointPaymentQr).mockRejectedValueOnce(axiosErr(500, 999999))
    await renderReady()
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.safeToRetry')
    expect(getPointPaymentQr).toHaveBeenCalledTimes(2)
  })

  it('C17 network error → recheck cancelled → failed cancelled', async () => {
    jest.mocked(payPointPaymentQr).mockRejectedValueOnce(NETWORK)
    await renderReady()
    jest.mocked(getPointPaymentQr).mockResolvedValue(qr('cancelled') as never)
    await openAndConfirm()
    await screen.findByText('pointQr.errors.cancelled')
    expect(screen.getByText('pointQr.confirm.rescan')).toBeTruthy()
  })

  it('C18 header back is ignored while paying', async () => {
    jest.mocked(payPointPaymentQr).mockReturnValue(new Promise(() => {}))
    await renderReady()
    await openAndConfirm()
    fireEvent.press(screen.getByTestId('header-back'))
    expect(mockRouter.back).not.toHaveBeenCalled()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('C19 own order: mine texts and view order', async () => {
    jest.mocked(getOrderBySlug).mockResolvedValue(orderOf('user-b') as never)
    jest
      .mocked(payPointPaymentQr)
      .mockResolvedValue(qr('completed', { paidAt: PAID_AT }) as never)
    await renderReady()
    await screen.findByText('pointQr.confirm.loyaltyNoteMine')
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.successTitle')
    expect(screen.getByText('pointQr.confirm.orderedBy')).toBeTruthy()
    expect(screen.getByText('pointQr.confirm.orderedByYou')).toBeTruthy()
    fireEvent.press(screen.getByText('pointQr.confirm.viewOrder'))
    expect(mockRouter.replace).toHaveBeenCalledWith('/order/ord-1')
  })

  it('C20 other order: other texts and view history', async () => {
    jest
      .mocked(payPointPaymentQr)
      .mockResolvedValue(qr('completed', { paidAt: PAID_AT }) as never)
    await renderReady()
    await screen.findByText('pointQr.confirm.loyaltyNoteOther')
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.successTitleOther')
    expect(screen.getByText('pointQr.confirm.orderedByOther')).toBeTruthy()
    expect(screen.queryByText('pointQr.confirm.viewOrder')).toBeNull()
    fireEvent.press(screen.getByText('pointQr.confirm.viewHistory'))
    expect(mockRouter.replace).toHaveBeenCalledWith('/profile/coin-hub')
  })

  it('C21 order fetch fails: neutral loyalty text, no orderedBy row', async () => {
    jest.mocked(getOrderBySlug).mockRejectedValue(axiosErr(500))
    jest
      .mocked(payPointPaymentQr)
      .mockResolvedValue(qr('completed', { paidAt: PAID_AT }) as never)
    await renderReady()
    await waitFor(() =>
      expect(getOrderBySlug).toHaveBeenCalledWith('ord-1'),
    )
    await act(async () => {})
    expect(screen.getByText('pointQr.confirm.loyaltyNote')).toBeTruthy()
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.successTitle')
    expect(screen.queryByText('pointQr.confirm.orderedBy')).toBeNull()
  })

  it('C22 receipt Done: back when canGoBack, replace profile otherwise', async () => {
    jest
      .mocked(payPointPaymentQr)
      .mockResolvedValue(qr('completed', { paidAt: PAID_AT }) as never)
    let view = await renderReady()
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.done')
    fireEvent.press(screen.getByText('pointQr.confirm.done'))
    expect(mockRouter.back).toHaveBeenCalledTimes(1)
    view.unmount()
    queryClient.clear()

    mockRouter.canGoBack.mockReturnValue(false)
    view = await renderReady()
    await openAndConfirm()
    await screen.findByText('pointQr.confirm.done')
    fireEvent.press(screen.getByText('pointQr.confirm.done'))
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile')
    expect(mockRouter.back).toHaveBeenCalledTimes(1)
  })

  it('C23 English hides the words line', async () => {
    mockLanguage = 'en'
    await renderReady()
    expect(screen.getByText('6.400 xu')).toBeTruthy()
    expect(screen.queryByText(/nghìn/)).toBeNull()
  })
})
