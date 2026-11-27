/**
 * Singleton QueryClient — shared across the entire app.
 * Passed to <QueryClientProvider> in app/_layout.tsx.
 *
 * Global error handlers translate API error codes to toast messages.
 */

import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { resolveGlobalErrorCode } from '@/lib/global-error-gate'
import { SessionRefreshError } from '@/utils/http'
import { showErrorToast } from '@/utils/toast'

// Session already dead: a retry goes out without a token, gets a 401 and adds
// a second toast on top of the session-expired one
const retryQuery = (failureCount: number, error: unknown): boolean => {
  if (error instanceof SessionRefreshError && error.reason === 'invalid') {
    return false
  }
  return failureCount < 1
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const code = resolveGlobalErrorCode(query.meta, error)
      if (code) showErrorToast(code)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return
      const code = resolveGlobalErrorCode(mutation.meta, error)
      if (code) showErrorToast(code)
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: retryQuery,
      refetchOnWindowFocus: false,
    },
  },
})
