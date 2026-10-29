// Sáu icon hai tông vẽ riêng cho Home: render được, và dùng đủ cả ba màu
// (nét khung, nét nhấn, mảng lót) — mất một màu là mất chất "hai tông".
import { render } from '@testing-library/react-native'

import * as Icons from '@/components/home/home-icons'

const TONE = { stroke: '#111111', accent: '#d9861c', fill: '#fbe7cd' }

/** react-native-svg đổi màu hex thành số ARGB trước khi xuống native. */
function argb(hex: string): string {
  return String((0xff000000 | parseInt(hex.slice(1), 16)) >>> 0)
}
const NAMES = [
  'MemberIdIcon',
  'ScanPayIcon',
  'CoinPaymentIcon',
  'OrderIcon',
  'GiftCardIcon',
  'OrderHistoryIcon',
] as const

afterEach(() => {
  // Đọc trước global lười của jest-expo khi môi trường test còn mở.
  const g = globalThis as Record<string, unknown>
  void g.__ExpoImportMetaRegistry
  void g.structuredClone
})

describe('home-icons', () => {
  it.each(NAMES)('%s dùng đủ nét khung, nét nhấn và mảng lót', (name) => {
    const Icon = Icons[name]
    const { toJSON } = render(<Icon size={28} {...TONE} />)
    const json = JSON.stringify(toJSON())
    expect(json).toContain(argb(TONE.stroke))
    expect(json).toContain(argb(TONE.accent))
    expect(json).toContain(argb(TONE.fill))
  })
})
