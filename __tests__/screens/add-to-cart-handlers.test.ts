// Khoá hành vi của hai handler "Thêm vào giỏ" (màn Menu và chi tiết món). Hai
// màn này quá nặng để render trong test nên kiểm trên mã nguồn, như
// menu-perf.test.ts.
import * as fs from 'fs'
import * as path from 'path'

function readSource(rel: string) {
  return fs
    .readFileSync(path.resolve(__dirname, '../..', rel), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

function handlerBody(src: string) {
  const start = src.indexOf('const handleAddToCart = useCallback(')
  expect(start).toBeGreaterThan(-1)
  const end = src.indexOf('\n  }, [', start)
  return src.slice(start, end)
}

describe('chi tiết món', () => {
  const body = handlerBody(readSource('app/product/[id].tsx'))

  it('giỏ chưa khởi tạo thì vẫn thêm món ngay lần bấm đầu', () => {
    expect(body).not.toMatch(/initializeOrdering\(\)\s*return\b/)
    expect(body).toMatch(/addOrderingItem\(/)
  })

  it('không thêm món hết hàng', () => {
    expect(body).toMatch(/if \(!hasStock\) return/)
  })
})

describe('Menu', () => {
  const body = handlerBody(readSource('app/(tabs)/menu/index.tsx'))

  it('không thêm nhanh món hết hàng', () => {
    expect(body).toMatch(/if \(!displayItem\?\.hasStock\) return/)
  })

  it('toast thêm vào giỏ ghi kèm size', () => {
    expect(body).toMatch(/menu\.addedToCartWithSize/)
  })
})
