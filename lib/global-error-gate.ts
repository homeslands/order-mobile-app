/**
 * Pure gate for the global React Query error toast.
 *
 * - `skipGlobalError: true` — suppress the toast for ALL error codes (used by
 *   invisible background prefetches).
 * - `skipGlobalErrorCodes: number[]` — suppress the toast only for the listed
 *   codes (used by visible menu queries; see MENU_QUERY_SKIP_CODES below).
 */
/**
 * Codes suppressed for menu queries.
 *
 * - 401 / 403 — self-healing auth states that fall back to the public menu.
 * - 117002 "Menu not found" — the backend answers 400 for a catalog with no
 *   items today, which is a normal state, not a user-facing error. The menu
 *   screen fans out one query per catalog, so a branch with 5 empty catalogs
 *   would otherwise fire 5 toasts while the menu renders fine from the rest.
 *
 * A real 500 / network error still surfaces.
 */
export const MENU_QUERY_SKIP_CODES = [401, 403, 117002]

export function extractStatusCode(error: unknown): number | null {
  const err = error as {
    response?: { data?: { statusCode?: number; code?: number } }
  }
  return err?.response?.data?.statusCode ?? err?.response?.data?.code ?? null
}

export function resolveGlobalErrorCode(
  meta: Record<string, unknown> | undefined,
  error: unknown,
): number | null {
  if (meta?.skipGlobalError) return null
  const code = extractStatusCode(error)
  if (code == null) return null
  const skipCodes = meta?.skipGlobalErrorCodes as number[] | undefined
  if (skipCodes?.includes(code)) return null
  return code
}
