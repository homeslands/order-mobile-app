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
import { showErrorToast } from '@/utils/toast'

function extractStatusCode(error: unknown): number | null {
  const err = error as {
    response?: { data?: { statusCode?: number; code?: number } }
  }
  return err?.response?.data?.statusCode ?? err?.response?.data?.code ?? null
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.skipGlobalError) return
      const code = extractStatusCode(error)
      if (code) showErrorToast(code)
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.options.onError) return
      if (mutation.meta?.skipGlobalError) return
      const code = extractStatusCode(error)
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
