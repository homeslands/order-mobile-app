/**
 * Pure gate for the global React Query error toast.
 *
 * - `skipGlobalError: true` — suppress the toast for ALL error codes (used by
 *   invisible background prefetches).
 * - `skipGlobalErrorCodes: number[]` — suppress the toast only for the listed
 *   codes (used by visible menu queries: [401, 403] are self-healing auth
 *   states that fall back to the public menu, so they must not toast — but a
 *   real 500 / network error still surfaces).
 */
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
