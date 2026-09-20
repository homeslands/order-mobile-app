import { withFrameCappedTiming } from '@/lib/transitions/frame-capped-timing'

type Anim = {
  current: number
  onStart: (a: Anim, value: number, now: number) => void
  onFrame: (a: Anim, now: number) => boolean
}

/**
 * Tuỳ môi trường, `defineAnimation` trả về thẳng animation hoặc trả về hàm tạo
 * ra nó. Nhận cả hai để test không phụ thuộc chi tiết nội bộ của Reanimated.
 */
function build(to: number, duration: number, maxFrameMs: number): Anim {
  const made = withFrameCappedTiming(to, { duration, maxFrameMs }) as unknown
  return typeof made === 'function' ? (made as () => Anim)() : (made as Anim)
}

/** Chạy animation với các mốc thời gian cho trước, trả về vị trí từng khung. */
function run(anim: Anim, from: number, times: number[]): number[] {
  anim.onStart(anim, from, 0)
  return times.map((t) => {
    anim.onFrame(anim, t)
    return anim.current
  })
}

describe('withFrameCappedTiming', () => {
  it('đi hết quãng đường khi các khung hình đều đặn', () => {
    const anim = build(100, 200, 20)
    const times = [16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208]
    const out = run(anim, 0, times)

    expect(out[out.length - 1]).toBe(100)
    // Đơn điệu tăng ở nửa đầu; nửa sau đường cong vượt đích rồi lùi lại.
    const rising = out.slice(0, 5)
    rising.forEach((v, i) => {
      if (i > 0) expect(v).toBeGreaterThan(rising[i - 1])
    })
  })

  it('một cú đơ dài chỉ tiêu tốn đúng một bước bị kẹp', () => {
    const smooth = build(100, 200, 20)
    const stalled = build(100, 200, 20)

    // Khung đầu giống nhau, sau đó bản "stalled" mất 150ms không vẽ được.
    smooth.onStart(smooth, 0, 0)
    smooth.onFrame(smooth, 16)
    smooth.onFrame(smooth, 32)

    stalled.onStart(stalled, 0, 0)
    stalled.onFrame(stalled, 16)
    stalled.onFrame(stalled, 182)

    // Không kẹp thì 182ms trên tổng 200ms đã đưa nó tới sát 100. Có kẹp thì
    // cú đơ chỉ đáng giá đúng một bước 20ms.
    expect(stalled.current).toBeLessThan(70)
    expect(stalled.current).toBeGreaterThan(smooth.current)
  })

  it('không bao giờ nhảy quá một bước dù đơ bao lâu', () => {
    const anim = build(300, 300, 20)
    anim.onStart(anim, 0, 0)
    anim.onFrame(anim, 16)
    const afterFirst = anim.current

    anim.onFrame(anim, 5000)
    const jump = anim.current - afterFirst

    // Một bước 20ms rơi đúng đoạn dốc nhất của đường cong ⇒ ~28% quãng đường,
    // tức không hơn một khung hình chạy bình thường. Không kẹp thì là 97%.
    expect(jump).toBeLessThan(300 * 0.3)
  })

  it('báo kết thúc và dừng đúng ở đích', () => {
    const anim = build(50, 100, 20)
    anim.onStart(anim, 0, 0)
    let finished = false
    for (let t = 16; t <= 400 && !finished; t += 16) {
      finished = anim.onFrame(anim, t)
    }
    expect(finished).toBe(true)
    expect(anim.current).toBe(50)
  })
})
