# Invoice Download Fix & UX Simplification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the broken PDF invoice download (crashes during file write) and simplify the UI to a single loading button + toast.

**Architecture:** The bug is in `utils/download-pdf.ts` — `writableStream()` from the expo-file-system new API fails on React Native. Replace it with `LegacyFS.writeAsStringAsync` (base64 encoding), which is the correct migration path per expo docs. Remove the progress-tracking store from the invoice download flow entirely; the store stays intact for the chef-area feature that uses it separately.

**Tech Stack:** `expo-file-system/legacy` (`writeAsStringAsync`, `documentDirectory`), React `useState`, `useMutation` from TanStack React Query.

---

### Task 1: Fix `utils/download-pdf.ts`

**Files:**

- Modify: `utils/download-pdf.ts`

**Context:**
Current implementation uses `new File(Paths.document, name)` + `writableStream().getWriter()` from expo-file-system new API. This crashes because `writableStream` is unreliable in React Native Hermes. The fix: import `expo-file-system/legacy`, convert ArrayBuffer → base64, write with `LegacyFS.writeAsStringAsync`. The function signature simplifies to `(data: ArrayBuffer, fileName: string): Promise<void>` — throw on error, caller handles toast. Remove all `useDownloadStore` updates from this utility (the store is only needed by the chef-area hook, not here).

- [ ] **Step 1: Replace the entire file content**

```typescript
import * as LegacyFS from 'expo-file-system/legacy'
import { Platform } from 'react-native'

/**
 * Write an ArrayBuffer as a PDF to the app's document directory.
 * Throws on failure — caller is responsible for error handling and toasts.
 *
 * Saved to:
 *   iOS  — Files app > On My iPhone > [app name]
 *   Android — app internal storage (Android/data/[package]/files)
 */
export async function downloadAndSavePDF(
  data: ArrayBuffer,
  fileName: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    throw new Error('PDF download not supported on web')
  }

  const fileUri = `${LegacyFS.documentDirectory}${fileName}.pdf`

  const uint8Array = new Uint8Array(data)
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  const base64 = btoa(binary)

  await LegacyFS.writeAsStringAsync(fileUri, base64, {
    encoding: LegacyFS.EncodingType.Base64,
  })
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors in `utils/download-pdf.ts`.

- [ ] **Step 3: Commit**

```bash
git add utils/download-pdf.ts
git commit -m "fix(payment): replace writableStream with LegacyFS.writeAsStringAsync for PDF save"
```

---

### Task 2: Clean up `api/order.ts` — `exportPublicOrderInvoice`

**Files:**

- Modify: `api/order.ts:231-267`

**Context:**
`exportPublicOrderInvoice` currently calls `useDownloadStore.getState()` to set `fileName`, `isDownloading`, `progress`, and `reset()`. These store updates were only for the progress UI which is now removed. The store should not be touched here. Keep only the HTTP call and return the ArrayBuffer. Remove `onDownloadProgress` callback (no UI reads it anymore).

Note: `exportOrderInvoice` (the authenticated version above it, line 199) is a separate function used elsewhere — do NOT modify it.

- [ ] **Step 1: Replace `exportPublicOrderInvoice` (lines ~231–267)**

Find the function:

```typescript
export async function exportPublicOrderInvoice(
  order: string,
): Promise<ArrayBuffer> {
  const { setProgress, setFileName, setIsDownloading, reset } =
    useDownloadStore.getState()
  // ... store setup ...
```

Replace with:

```typescript
export async function exportPublicOrderInvoice(
  order: string,
): Promise<ArrayBuffer> {
  const response = await http.post<ArrayBuffer>(
    `/invoice/export/public`,
    { order },
    {
      responseType: 'arraybuffer',
      headers: {
        Accept: 'application/pdf',
      },
      doNotShowLoading: true,
    } as AxiosRequestConfig,
  )
  return response.data as ArrayBuffer
}
```

- [ ] **Step 2: Check if `useDownloadStore` import in `api/order.ts` is still needed**

Search the file for any remaining `useDownloadStore` reference:

```bash
grep -n "useDownloadStore" api/order.ts
```

If no other references, remove the `useDownloadStore` import line from `api/order.ts`. If other functions still use it (e.g. `exportOrderInvoice`), leave the import.

- [ ] **Step 3: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add api/order.ts
git commit -m "fix(payment): remove download store side-effects from exportPublicOrderInvoice"
```

---

### Task 3: Simplify `app/payment/payment-invoice-section.tsx`

**Files:**

- Modify: `app/payment/payment-invoice-section.tsx`

**Context:**
Current component has three inline UI blocks — `downloadCard` (progress bar), `processingRow`, and `successCard` — all driven by `useDownloadStore`. These are being removed. Replace with:

- Local `const [isSaving, setIsSaving] = useState(false)`
- `isLoading = isExportingInvoice || isSaving` for button disabled state
- `ActivityIndicator` inside the button when loading
- Toast for success (`common.downloadSuccess`) and error (`toast.invoiceExportError`)
- `handleDownload` wraps `downloadAndSavePDF` in try/finally to manage `isSaving`

The `InvoiceTemplate` preview and the download button are kept. Everything else (three cards + their styles) is removed.

Note: `downloadAndSavePDF` now returns `Promise<void>` and throws on error — the caller must wrap it in try/catch.

- [ ] **Step 1: Replace the entire file**

```typescript
import { FileDown } from 'lucide-react-native'
import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { InvoiceTemplate } from '@/components/profile'
import { colors } from '@/constants'
import { useExportPublicOrderInvoice, useOrderBySlug } from '@/hooks'
import { OrderStatus } from '@/types'
import { downloadAndSavePDF, showToast } from '@/utils'

export const InvoiceSection = React.memo(function InvoiceSection({
  order,
  primaryColor,
  isDark,
}: {
  order: NonNullable<ReturnType<typeof useOrderBySlug>['data']>['result']
  primaryColor: string
  isDark: boolean
}) {
  const { t: tCommon } = useTranslation('common')
  const { t } = useTranslation('menu')
  const { t: tToast } = useTranslation('toast')
  const { mutate: exportInvoice, isPending: isExportingInvoice } =
    useExportPublicOrderInvoice()
  const [isSaving, setIsSaving] = useState(false)

  const isLoading = isExportingInvoice || isSaving

  const handleDownload = useCallback(() => {
    if (!order?.slug || isLoading) return
    exportInvoice(order.slug, {
      onSuccess: async (data) => {
        const name = `TRENDCoffee-invoice-${order.slug}-${Date.now()}`
        setIsSaving(true)
        try {
          await downloadAndSavePDF(data, name)
          showToast(tCommon('common.downloadSuccess'))
        } catch {
          showToast(tToast('toast.invoiceExportError'))
        } finally {
          setIsSaving(false)
        }
      },
      onError: () => showToast(tToast('toast.invoiceExportError')),
    })
  }, [order?.slug, isLoading, exportInvoice, tCommon, tToast])

  if (!order || order.status !== OrderStatus.PAID) return null

  return (
    <View style={invoiceStyles.invoiceSection}>
      <Text
        style={[
          invoiceStyles.invoiceTitle,
          { color: isDark ? colors.gray[400] : colors.gray[600] },
        ]}
      >
        {t('order.invoice')}
      </Text>
      <InvoiceTemplate order={order} />
      <Pressable
        onPress={handleDownload}
        disabled={isLoading}
        style={[
          invoiceStyles.downloadBtn,
          { backgroundColor: isLoading ? colors.gray[400] : primaryColor },
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={colors.white.light} />
        ) : (
          <FileDown size={18} color={colors.white.light} />
        )}
        <Text style={invoiceStyles.downloadBtnText}>
          {isLoading
            ? tCommon('common.downloading')
            : tCommon('common.downloadPDF')}
        </Text>
      </Pressable>
    </View>
  )
})

export const invoiceStyles = StyleSheet.create({
  invoiceSection: { marginBottom: 16 },
  invoiceTitle: { fontSize: 18, textAlign: 'center', marginBottom: 16 },
  downloadBtn: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  downloadBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.white.light,
  },
})
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors in `app/payment/payment-invoice-section.tsx`.

- [ ] **Step 3: Verify lint**

```bash
npm run lint
```

Expected: no errors or warnings related to the changed files.

- [ ] **Step 4: Commit**

```bash
git add app/payment/payment-invoice-section.tsx
git commit -m "fix(payment): simplify invoice download UI — remove progress cards, add loading button"
```
