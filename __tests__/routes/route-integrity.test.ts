/**
 * Route integrity — bảo vệ khỏi chuỗi route trỏ tới màn không còn tồn tại.
 *
 * Rủi ro cụ thể: route chỉ là chuỗi, nên khi một màn bị đổi tên/di chuyển
 * (vd. `(tabs)/menu/product/[id]` → `product/[id]`), một `router.push('...')`
 * quên cập nhật vẫn compile và test khác vẫn xanh — chỉ lộ ra lúc chạy app.
 *
 * Cơ chế:
 * 1. Duyệt cây `app/` để dựng tập route thật, theo quy tắc expo-router:
 *    - bỏ phần mở rộng file (.ts/.tsx)
 *    - `index` là route của chính thư mục chứa nó
 *    - thư mục trong ngoặc đơn, vd. `(tabs)`, là group — không tính vào
 *      đường dẫn ở dạng "đã strip", nhưng vẫn giữ ở dạng "có prefix group"
 *    - `_layout.tsx` và mọi file/thư mục bắt đầu bằng "_" không phải route
 *    - `[id]` / `[slug]` là tham số động — khớp bất kỳ segment nào khi so
 *    - file không có `export default` (component/helper colocate trong
 *      app/, vd. `app/payment/payment-invoice-section.tsx`) không phải
 *      route thật — expo-router không dựng được screen từ nó
 * 2. Quét `app/ components/ hooks/ lib/ constants/ stores/` tìm route string
 *    literal dạng `router.push('...')`, `router.replace('...')`,
 *    `router.navigate('...')`, `router.dismissTo('...')`, và
 *    `pathname: '...'`.
 * 3. Assert mỗi literal khớp một route thật (cả dạng có prefix group
 *    `/(tabs)/...` lẫn dạng đã strip group `/...`, cho phép tham số động).
 *
 * KHÔNG phủ (giới hạn có chủ đích — ghi rõ để người sau biết ranh giới):
 * - Href truyền qua biến/hằng/field dữ liệu (vd. `TAB_ROUTES.MENU`,
 *   `item.route`) — chỉ bắt string literal trực tiếp trong lời gọi.
 * - Template literal có nội suy (`` `/product/${id}` ``) — chỉ bắt
 *   string literal thuần trong dấu `'` hoặc `"`.
 * - `<Link href="...">`, `<Redirect href="...">`, hoặc bất kỳ API điều
 *   hướng nào khác ngoài `router.push/replace/navigate/dismissTo` và
 *   `pathname:`.
 * - `navigateNative.*` / `navigateWhenUnlocked.*` (wrapper riêng trong
 *   lib/navigation) — vì phần lớn lời gọi ở đó truyền href qua biến.
 */
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const APP_DIR = path.join(ROOT, 'app')
const SCAN_DIRS = ['app', 'components', 'hooks', 'lib', 'constants', 'stores']

// ─── Duyệt cây file (.ts/.tsx) ──────────────────────────────────────────────

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  let files: string[] = []
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files = files.concat(walk(full))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(full)
    }
  }
  return files
}

function hasDefaultExport(content: string): boolean {
  return (
    /(^|\n)\s*export\s+default\b/.test(content) ||
    /export\s*\{[^}]*\bdefault\b[^}]*\}/.test(content)
  )
}

// ─── 1. Dựng tập route thật từ app/ ─────────────────────────────────────────

interface RouteEntry {
  /** Đường dẫn giữ nguyên group, vd. '/(tabs)/menu' */
  withGroup: string
  /** Đường dẫn đã strip group, vd. '/menu' (khớp usePathname() thật) */
  stripped: string
}

function buildRoutes(): RouteEntry[] {
  const files = walk(APP_DIR)
  const routes: RouteEntry[] = []

  for (const file of files) {
    const rel = path.relative(APP_DIR, file) // vd. '(tabs)/menu/index.tsx'
    const segments = rel.split(path.sep)

    // _layout.tsx và mọi segment bắt đầu bằng "_" không phải route
    if (segments.some((seg) => seg.startsWith('_'))) continue

    const fileName = segments[segments.length - 1]
    const baseName = fileName.replace(/\.(ts|tsx)$/, '')
    const dirSegments = segments.slice(0, -1)

    // Colocated helper/component không có default export → không phải route
    const content = fs.readFileSync(file, 'utf-8')
    if (!hasDefaultExport(content)) continue

    const withGroupSegments = [...dirSegments]
    const strippedSegments = dirSegments.filter((seg) => !/^\(.*\)$/.test(seg))

    if (baseName !== 'index') {
      withGroupSegments.push(baseName)
      strippedSegments.push(baseName)
    }

    routes.push({
      withGroup: '/' + withGroupSegments.join('/'),
      stripped: '/' + strippedSegments.join('/'),
    })
  }

  return routes
}

// ─── 2. So khớp một literal path với tập route thật ────────────────────────

function segmentsMatch(routeSeg: string, literalSeg: string): boolean {
  if (/^\[.+\]$/.test(routeSeg)) return true // tham số động khớp bất kỳ giá trị
  return routeSeg === literalSeg
}

function pathMatchesRoute(literalPath: string, routePath: string): boolean {
  const a = literalPath.split('/').filter(Boolean)
  const b = routePath.split('/').filter(Boolean)
  if (a.length !== b.length) return false
  return b.every((seg, i) => segmentsMatch(seg, a[i]))
}

function isRealRoute(literalPath: string, routes: RouteEntry[]): boolean {
  const clean = literalPath.split('?')[0].split('#')[0]
  return routes.some(
    (r) =>
      pathMatchesRoute(clean, r.withGroup) ||
      pathMatchesRoute(clean, r.stripped),
  )
}

// ─── 3. Quét mã tìm route string literal ────────────────────────────────────

interface FoundRoute {
  file: string
  line: number
  value: string
}

const CALL_PATTERN =
  /\brouter\.(?:push|replace|navigate|dismissTo)\(\s*(['"])([^'"]+)\1/g
const PATHNAME_PATTERN = /\bpathname:\s*(['"])([^'"]+)\1/g

function findLiteralRoutes(scanRoot: string): FoundRoute[] {
  const found: FoundRoute[] = []
  const files = walk(scanRoot)
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8')
    for (const pattern of [CALL_PATTERN, PATHNAME_PATTERN]) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(content))) {
        const value = match[2]
        // Chỉ quan tâm route nội bộ (bắt đầu bằng "/"), bỏ URL ngoài/deep link
        if (value.startsWith('/')) {
          const line = content.slice(0, match.index).split('\n').length
          found.push({ file: path.relative(ROOT, file), line, value })
        }
      }
    }
  }
  return found
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('route integrity', () => {
  const routes = buildRoutes()

  it('builds a non-trivial real route set from app/', () => {
    expect(routes.length).toBeGreaterThan(20)
  })

  it('every route string literal found matches a real route in app/', () => {
    const found = SCAN_DIRS.flatMap((dir) =>
      findLiteralRoutes(path.join(ROOT, dir)),
    )
    expect(found.length).toBeGreaterThan(0)

    const invalid = found.filter((f) => !isRealRoute(f.value, routes))

    if (invalid.length > 0) {
      const details = invalid
        .map((f) => `  ${f.file}:${f.line} → '${f.value}'`)
        .join('\n')
      throw new Error(
        `Found ${invalid.length} route literal(s) not matching any real route under app/:\n${details}`,
      )
    }
  })
})
