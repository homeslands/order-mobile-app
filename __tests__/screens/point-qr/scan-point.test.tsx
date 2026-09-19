// Use cases S1–S10 cho màn quét QR trả xu (app/payment/scan-point.tsx).
// Dùng QrCamera thật (chỉ mock expo-camera) để đi trọn luồng: camera bắn mã →
// parse → xem trước → điều hướng / báo lỗi.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react-native'

import { getPointPaymentQr } from '@/api/payment'
import ScanPointScreen from '@/app/payment/scan-point'
import { wasPointQrScanned } from '@/utils/point-qr-handoff'

let mockOnBarcodeScanned: ((r: { data: string }) => void) | null = null

jest.mock('expo-camera', () => ({
  CameraView: (props: { onBarcodeScanned?: (r: { data: string }) => void }) => {
    mockOnBarcodeScanned = props.onBarcodeScanned ?? null
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createElement: h } = require('react')
    const { View } = require('react-native')
    /* eslint-enable @typescript-eslint/no-require-imports */
    return h(View, { testID: 'camera-view' })
  },
  useCameraPermissions: () => [
    { granted: true, canAskAgain: true },
    jest.fn(() => Promise.resolve()),
  ],
}))

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}))

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))

jest.mock('@/components/ui/text', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Text: require('react-native').Text,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  initialWindowMetrics: undefined,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'vi' },
  }),
}))

const mockRouter = {
  back: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  canGoBack: jest.fn(() => true),
}
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}))

jest.mock('@/api/payment', () => ({
  getPointPaymentQr: jest.fn(),
  payPointPaymentQr: jest.fn(),
}))

const VALID_QR =
  '00020101021238830011ORDER.POINT0164b7f1fce44fd4a7ddcc4b4711b6b6f13340622dccaa1a8a1a2af26a9633b4ad2a54061600005802VN6228011081992a6895071041d5f0f994630466C9'

const qr = (status: 'initiate' | 'completed' | 'cancelled') => ({
  result: {
    slug: 'q1',
    code: 'c',
    amount: 6400,
    status,
    orderSlug: 'ord-1',
    branchName: 'Q1',
    createdAt: '2026-09-19T00:00:00Z',
  },
})

const axiosErr = (status: number, statusCode?: number) => ({
  isAxiosError: true,
  response: { status, data: statusCode ? { statusCode } : {} },
})

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let queryClient: QueryClient

function renderScreen() {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ScanPointScreen />
    </QueryClientProvider>,
  )
}

async function scan(data: string) {
  await act(async () => {
    mockOnBarcodeScanned?.({ data })
  })
}

beforeEach(() => {
  mockOnBarcodeScanned = null
  jest.clearAllMocks()
})

afterEach(() => {
  queryClient?.clear()
})

describe('scan-point use cases', () => {
  it('S1 non-point QR shows local error, no API call, no navigation', async () => {
    const samples = [
      // VietQR ngân hàng (010212 nhưng không có ORDER.POINT)
      '00020101021238570010A00000072701270006970403011300110123456780208QRIBFTTA53037045802VN6304ABCD',
      'https://trendcoffee.vn/menu',
      'VOUCHER-SUMMER-2026',
    ]
    for (const raw of samples) {
      const view = renderScreen()
      await scan(raw)
      expect(screen.getByText('pointQr.scan.rejectedTitle')).toBeTruthy()
      view.unmount()
    }
    expect(getPointPaymentQr).not.toHaveBeenCalled()
    expect(mockRouter.replace).not.toHaveBeenCalled()
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('S2 valid QR with initiate marks scanned and replaces to confirm', async () => {
    jest.mocked(getPointPaymentQr).mockResolvedValue(qr('initiate') as never)
    renderScreen()
    await scan(VALID_QR)
    expect(getPointPaymentQr).toHaveBeenCalledWith(VALID_QR)
    expect(wasPointQrScanned(VALID_QR)).toBe(true)
    expect(mockRouter.replace).toHaveBeenCalledTimes(1)
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/payment/point-confirm',
      params: { qrData: VALID_QR },
    })
  })

  it('S3 preview completed shows alreadyPaid, no navigation', async () => {
    jest.mocked(getPointPaymentQr).mockResolvedValue(qr('completed') as never)
    renderScreen()
    await scan(VALID_QR)
    expect(screen.getByText('pointQr.errors.alreadyPaid')).toBeTruthy()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('S4 preview cancelled shows cancelled, no navigation', async () => {
    jest.mocked(getPointPaymentQr).mockResolvedValue(qr('cancelled') as never)
    renderScreen()
    await scan(VALID_QR)
    expect(screen.getByText('pointQr.errors.cancelled')).toBeTruthy()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('S5 preview 160206/160212/160213 show matching errors', async () => {
    const cases: [number, string][] = [
      [160206, 'notFound'],
      [160212, 'invalid'],
      [160213, 'mismatch'],
    ]
    for (const [code, kind] of cases) {
      jest.mocked(getPointPaymentQr).mockRejectedValueOnce(axiosErr(400, code))
      const view = renderScreen()
      await scan(VALID_QR)
      expect(screen.getByText(`pointQr.errors.${kind}`)).toBeTruthy()
      view.unmount()
      queryClient.clear()
    }
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('S6 preview network error shows network', async () => {
    jest.mocked(getPointPaymentQr).mockRejectedValue({ isAxiosError: true })
    renderScreen()
    await scan(VALID_QR)
    expect(screen.getByText('pointQr.errors.network')).toBeTruthy()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('S7 retry returns to idle and a new scan works', async () => {
    jest
      .mocked(getPointPaymentQr)
      .mockRejectedValueOnce({ isAxiosError: true })
      .mockResolvedValueOnce(qr('initiate') as never)
    renderScreen()
    await scan(VALID_QR)
    expect(screen.getByText('pointQr.errors.network')).toBeTruthy()

    fireEvent.press(screen.getByText('pointQr.scan.retry'))
    expect(screen.queryByText('pointQr.errors.network')).toBeNull()
    expect(screen.getByText('pointQr.scan.hint')).toBeTruthy()

    await scan(VALID_QR)
    expect(getPointPaymentQr).toHaveBeenCalledTimes(2)
    expect(mockRouter.replace).toHaveBeenCalledWith({
      pathname: '/payment/point-confirm',
      params: { qrData: VALID_QR },
    })
  })

  it('S8 close while preview in flight: back, and no replace on late initiate', async () => {
    const d = deferred<ReturnType<typeof qr>>()
    jest.mocked(getPointPaymentQr).mockReturnValue(d.promise as never)
    renderScreen()
    await scan(VALID_QR)
    expect(screen.getByText('pointQr.scan.checking')).toBeTruthy()

    fireEvent.press(screen.getByLabelText('pointQr.scan.close'))
    expect(mockRouter.back).toHaveBeenCalledTimes(1)

    await act(async () => {
      d.resolve(qr('initiate'))
      await d.promise
    })
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('S9 unmount while preview in flight: late resolve does not navigate', async () => {
    const d = deferred<ReturnType<typeof qr>>()
    jest.mocked(getPointPaymentQr).mockReturnValue(d.promise as never)
    const view = renderScreen()
    await scan(VALID_QR)
    view.unmount()

    await act(async () => {
      d.resolve(qr('initiate'))
      await d.promise
    })
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })

  it('S10 preview 401 shows unauthorized, 403 shows forbidden', async () => {
    jest.mocked(getPointPaymentQr).mockRejectedValueOnce(axiosErr(401))
    let view = renderScreen()
    await scan(VALID_QR)
    expect(screen.getByText('pointQr.errors.unauthorized')).toBeTruthy()
    view.unmount()
    queryClient.clear()

    jest.mocked(getPointPaymentQr).mockRejectedValueOnce(axiosErr(403))
    view = renderScreen()
    await scan(VALID_QR)
    expect(screen.getByText('pointQr.errors.forbidden')).toBeTruthy()
    view.unmount()
    expect(mockRouter.replace).not.toHaveBeenCalled()
  })
})
