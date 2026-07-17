# [INFRA] Product image thumbnails / resize service

**Type:** Performance · Infrastructure · Data-quality
**Priority:** High (causes visible scroll frame drops on the Menu and other product-image lists)
**Owner:** Backend / DevOps + Mobile
**Created:** 2026-07-15

## Problem

Product images are served at **full upload resolution (up to 1080×1080, ~165–200KB, one outlier 1.7MB)** directly from a **raw S3 bucket** (`trendcoffee.s3.ap-southeast-1.amazonaws.com`) with **no resize support** (`?w=` is ignored — byte-identical response). The mobile app displays them in **128pt (~384px) thumbnails**, so every list cell composites/uploads a ~1080px GPU texture that is ~18× larger (by area) than needed.

## Evidence (measured 2026-07-15)

Menu list, one branch:

| Catalog | Items | Avg image | Dimensions |
|---|---|---|---|
| món ăn | 47 | 34KB | ~554px |
| cà phê | 15 | 170KB | 1080×1080 |
| món bánh | 10 | 176KB | 1080×1080 |
| sinh tố | 8 | 440KB | 1080px (one **1.7MB**) |
| món trà | 16 | 175KB | 1080×1080 |

- `?w=384` on the S3 URL returns the **identical** bytes → S3 does not resize.
- Sizes are **wildly inconsistent** (225px → 1080px, mixed formats incl. non-JPEG) → there is no thumbnail pipeline today; this is also a data-quality issue.

## Root cause (confirmed by isolation testing in-app)

Ruled OUT via diagnostics: image **decode** (disabling images → smooth), rounded-corner **clipping** (removing `overflow:hidden` + `borderRadius` → still dropped). Confirmed IN: routing the same images through a **384px resize proxy → scroll became smooth**. So the cost is **compositing/uploading the oversized GPU textures every frame during scroll**, and it scales with source pixel size. `expo-image`'s `allowDownscaling`/`enforceEarlyResizing` do not fully mitigate it on Android for these source sizes.

## Fix

Serve **resized thumbnails** and consume them through the app's existing single source of truth, `utils/product-image-url.ts` → `getProductImageUrl(path, { maxWidth })`.

### Backend / infra — pick ONE

1. **Server-side thumbnail on upload (preferred, most robust):** generate 1–2 derivative sizes (e.g. 384px + 768px) when a product image is uploaded; expose their URLs (or a naming convention) in the API. No per-request compute.
2. **Self-host `imgproxy` / `thumbor`:** put a small resize service (one container) in front of S3; `getProductImageUrl` builds `…/resize?url=<s3>&w=384`. On-demand + CDN-cached.
3. **Managed:** Cloudinary / imgix / Cloudflare Images fronting S3.

> A public proxy (e.g. images.weserv.nl) was used ONLY as an in-app diagnostic. Do **not** ship it to production (third-party dependency, rate limits, sends URLs off-platform).

### Mobile — after a resize path exists

1. `getProductImageUrl(path, { maxWidth })` routes through the resize service. Define shared presets:
   - `THUMB = 384` (list/grid cells)
   - `HERO = <screen width>` (detail/full-screen — cap, don't send 1080 blindly)
2. Also normalize the 1.7MB outlier / non-standard formats server-side.

## Migration checklist (mobile — apply `THUMB` unless noted)

**Already using `getProductImageUrl` → fixed automatically once the util routes through resize:**
- [ ] `app/(tabs)/menu/index.tsx` (menu list) — pass `{ maxWidth: THUMB }`
- [ ] `hooks/use-viewable-menu-prefetch.ts` (must match menu THUMB so prefetch warms the right URL)
- [ ] `components/cart/cart-display-item.ts`
- [ ] `components/gift-card/gift-card-list-item.tsx`, `gift-card-cart-item.tsx`
- [ ] `app/(tabs)/menu-detail/[slug].tsx` — hero uses `HERO`

**Rendering `product.image` directly → migrate to `getProductImageUrl` (same scroll-drop risk):**
- [ ] `app/update-order/components/client-menu-item-for-update-order.tsx` + `update-order-menus.tsx` (menu list — same pattern, HIGH priority)
- [ ] `components/menu/slider-related-products.tsx`
- [ ] `app/profile/order-product-item.tsx` (order history)
- [ ] `app/order/[id].tsx` (order detail items)
- [ ] `app/payment/payment-product-item.tsx`
- [ ] `components/menu/client-menu-item.tsx`, `menu-item-quantity-control.tsx`

**Larger on purpose (use `HERO`, still cap):**
- [ ] `app/(tabs)/menu/product/[id].tsx` (product detail hero)
- [ ] `components/home/swipper-banner.tsx` (banner — full width)

## Acceptance criteria

- Menu (and the HIGH-priority lists above) scroll at 60fps through fully-loaded images on a mid-tier Android device, fast and slow.
- Thumbnail payload per list image ≤ ~30KB (from ~165KB).
- No image exceeds a sane max (kill the 1.7MB outlier).
- No third-party public proxy in the production build.

## Notes

- The mobile-side client mitigations attempted (defer-decode-until-scroll-settles) were reverted: they added pop-in UX and did **not** fix re-scroll drops, because the cost is texture size, not decode. The resize service is the real fix.
- The Menu screen already received unrelated perf cleanups (ref-stable FlashList props, staggered image reveal, lazy hero URLs) — those stay; this ticket is only about image size.
