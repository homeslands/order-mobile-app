/**
 * Singleton QueryClient — shared across the entire app.
 * Passed to <QueryClientProvider> in app/_layout.tsx.
 *
 * Global error handlers translate API error codes to toast messages.
 */

import {
  MutationCache,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query'
import { resolveGlobalErrorCode } from '@/lib/global-error-gate'
import { showErrorToast } from '@/utils/toast'

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
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
