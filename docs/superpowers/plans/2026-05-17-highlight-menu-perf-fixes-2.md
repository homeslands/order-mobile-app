# Highlight Menu Bug Fixes (Round 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 vấn đề còn lại trong `HighlightMenuCarousel` sau lần optimize đầu: menu screen render với filter sai (C1), filter bị mất khi catalog chưa load (C2), và observer không cần thiết từ `useQuery` (H1).

**Architecture:** Tất cả thay đổi trong một file duy nhất `components/home/highlight-menu.tsx`. Task 1 sửa `handleItemPress` — đổi từ `getQueryData` + `scheduleTransitionTask` sang `ensureQueryData` async + navigate trước. Task 2 đổi `useQuery({ notifyOnChangeProps: [] })` thành `prefetchQuery` trong `useEffect` — không tạo observer.

**Tech Stack:** React Query v5 (`ensureQueryData`, `prefetchQuery`), Zustand, Expo Router, `useEffect`.

---

## File Map

| File | Action | Trách nhiệm |
|------|--------|-------------|
| `components/home/highlight-menu.tsx` | Modify | Cả 2 tasks |

---

### Task 1: Sửa handleItemPress — ensureQueryData + setMenuFilter trước navigate

**Files:**
- Modify: `components/home/highlight-menu.tsx:16, 23, 312–330`

**Bối cảnh:**

Có 2 bugs trong `handleItemPress` hiện tại:

**C1 (menu flash):** `setMenuFilter` được gọi qua `scheduleTransitionTask` sau khi `router.push`. Menu screen mount với filter cũ → fetch sai → flash khi filter mới được áp dụng. `setMenuFilter` là Zustand update đơn thuần (<1ms), không cần queue.

**C2 (filter mất khi cache lạnh):** `getQueryData` trả về `undefined` nếu catalog chưa fetch xong → `matched` là `undefined` → filter bị xoá. Cần `ensureQueryData` để await fetch nếu cache trống.

**Fix kết hợp C1 + C2:**
1. Gọi `router.push` trước (responsive UX)
2. Dùng `ensureQueryData` — resolve ngay từ cache nếu warm (microtask, chạy trước render tiếp theo), hoặc await network nếu cold
3. Set filter trong `.then()` — khi cache warm, `.then()` là microtask chạy trước menu screen fetch đầu tiên
4. Bỏ `scheduleTransitionTask` — không còn dùng

- [ ] **Step 1: Cập nhật imports**

Xoá `useQuery` khỏi import react-query (Task 2 sẽ bỏ hẳn). Xoá `scheduleTransitionTask`. Kết quả:

```tsx
// Dòng 16 — đổi:
import { useQueryClient } from '@tanstack/react-query'

// Dòng 23 — xoá hoàn toàn dòng này:
import { scheduleTransitionTask } from '@/lib/navigation'
```

File imports sau khi sửa (chỉ phần liên quan, giữ nguyên tất cả import khác):

```tsx
import { useQueryClient } from '@tanstack/react-query'

import { getCatalog } from '@/api'
import { Images } from '@/assets/images'
import { QUERYKEY } from '@/constants'
import type { IApiResponse, ICatalog } from '@/types'
import { useSetMenuFilter } from '@/stores/selectors/menu-filter.selectors'
```

- [ ] **Step 2: Thay thế toàn bộ `handleItemPress`**

Tìm `handleItemPress` (line ~312) và thay thế:

```tsx
// Xoá:
const handleItemPress = useCallback(
  (catalogSearch: string) => {
    const cached = queryClient.getQueryData<IApiResponse<ICatalog[]>>(
      [QUERYKEY.catalog],
    )
    const catalogs = cached?.result ?? []
    const matched = catalogs.find((c) =>
      c.name.toLowerCase().includes(catalogSearch.toLowerCase()),
    )
    router.push('/(tabs)/menu' as never)
    scheduleTransitionTask(() => {
      setMenuFilter((prev) => ({
        ...prev,
        catalog: matched?.slug ?? undefined,
      }))
    })
  },
  [queryClient, setMenuFilter, router],
)

// Thêm:
const handleItemPress = useCallback(
  (catalogSearch: string) => {
    // Navigate trước để UX responsive. ensureQueryData resolve sync từ cache
    // (microtask) nên setMenuFilter chạy trước menu screen fetch đầu tiên.
    router.push('/(tabs)/menu' as never)
    queryClient
      .ensureQueryData<IApiResponse<ICatalog[]>>({
        queryKey: QUERYKEY.catalog,
        queryFn: getCatalog,
      })
      .then((res) => {
        const matched = res.result?.find((c) =>
          c.name.toLowerCase().includes(catalogSearch.toLowerCase()),
        )
        setMenuFilter((prev) => ({
          ...prev,
          catalog: matched?.slug ?? undefined,
        }))
      })
      .catch(() => {
        // Catalog fetch failed — menu hiển thị không filter, chấp nhận được
      })
  },
  [queryClient, setMenuFilter, router],
)
```

Lưu ý: `getCatalog` là module-level function, không phải reactive value — không cần trong dep array.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "fix(home): use ensureQueryData and navigate-first for highlight menu press"
```

---

### Task 2: Đổi useQuery observer thành prefetchQuery trong useEffect

**Files:**
- Modify: `components/home/highlight-menu.tsx:16, 240–246`

**Bối cảnh:**

`useQuery({ notifyOnChangeProps: [] })` hiện tại tạo một React Query observer — subscriber gắn vào query lifecycle. Mỗi lần `HighlightMenuCarousel` mount, observer mới được đăng ký. Observer này không cần thiết vì:
- `notifyOnChangeProps: []` đã đảm bảo component không re-render
- Nhưng observer vẫn chiếm memory và trigger refetch theo `staleTime`/`refetchOnMount`

Thay bằng `queryClient.prefetchQuery` trong `useEffect`:
- Chỉ chạy 1 lần khi mount (dep `[queryClient]` — queryClient là singleton, không đổi)
- Không tạo observer — không subscription, không memory overhead
- Nếu cache đã có data, `prefetchQuery` no-op

- [ ] **Step 1: Cập nhật import react-query**

Sau Task 1, `useQuery` đã bị xoá. Đảm bảo dòng 16 là:

```tsx
import { useQueryClient } from '@tanstack/react-query'
```

Nếu chưa thay, thay ngay. Nếu đã thay từ Task 1, bỏ qua.

- [ ] **Step 2: Thay `useQuery(...)` thành `useEffect` + `prefetchQuery`**

Tìm block `useQuery` trong `HighlightMenuCarousel` (line ~240–246):

```tsx
// Xoá:
// Populate catalog cache silently — notifyOnChangeProps: [] ensures this
// query never triggers a re-render when data arrives or refetches.
useQuery({
  queryKey: QUERYKEY.catalog,
  queryFn: getCatalog,
  notifyOnChangeProps: [],
})

// Thêm:
// Warm catalog cache on mount — prefetchQuery không tạo observer,
// không re-render. No-op nếu cache còn fresh.
useEffect(() => {
  queryClient.prefetchQuery({
    queryKey: QUERYKEY.catalog,
    queryFn: getCatalog,
  })
}, [queryClient])
```

Lưu ý: `useEffect` đã có trong import từ 'react' (line 5) — không cần thêm.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Verify tests**

```bash
npm test
```

Expected: 69 passed, 0 failed.

- [ ] **Step 5: Commit**

```bash
git add components/home/highlight-menu.tsx
git commit -m "perf(home): replace useQuery observer with prefetchQuery for catalog cache warm"
```

---

## Self-Review

**Spec coverage:**
- ✅ C1 (menu flash): `setMenuFilter` set trong `.then()` — với cache warm là microtask trước menu render đầu tiên
- ✅ C2 (filter mất khi cache lạnh): `ensureQueryData` await fetch nếu `getQueryData` sẽ miss
- ✅ H1 (observer thừa): `useQuery` → `prefetchQuery` trong `useEffect`, không subscription

**Placeholder scan:** Không có TBD/TODO. Tất cả code đầy đủ.

**Type consistency:**
- `ensureQueryData<IApiResponse<ICatalog[]>>` — type match với `getCatalog(): Promise<IApiResponse<ICatalog[]>>`
- `res.result` là `ICatalog[]` — `find` trả về `ICatalog | undefined`, `matched?.slug` là `string | undefined` ✓
- `setMenuFilter` nhận `(prev) => ({ ...prev, catalog: matched?.slug ?? undefined })` — khớp với type `IMenuFilter` có `catalog?: string` ✓
- Dep array `[queryClient, setMenuFilter, router]` — `getCatalog` là module constant, không cần dep ✓
