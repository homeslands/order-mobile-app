// hooks/useMutationWithToast.ts
import { showToast } from '@/utils'
import { type UseMutationOptions } from '@tanstack/react-query'

export function withToast<TData, TVariables>(
  options: UseMutationOptions<TData, unknown, TVariables>,
  messages: {
    success?: string
    error?: string
  },
): UseMutationOptions<TData, unknown, TVariables> {
  return {
    ...options,
    onSuccess: (data, vars, ctx, ...args) => {
      if (messages.success) {
        showToast(messages.success, 'success')
      }
      options.onSuccess?.(data, vars, ctx, ...args)
    },
    onError: (error, vars, ctx, ...args) => {
      if (messages.error) {
        showToast(messages.error, 'error')
      }
      options.onError?.(error, vars, ctx, ...args)
    },  
  }
}
