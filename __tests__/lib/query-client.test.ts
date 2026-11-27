jest.mock('@/utils/toast', () => ({ showErrorToast: jest.fn() }))

import { AxiosError } from 'axios'

import { queryClient } from '@/lib/query-client'
import { SessionRefreshError } from '@/utils/http'

type RetryFn = (failureCount: number, error: unknown) => boolean

const retry = queryClient.getDefaultOptions().queries?.retry as RetryFn

describe('queryClient — retry mặc định của query', () => {
  it('là hàm (không còn retry: 1 cố định)', () => {
    expect(typeof retry).toBe('function')
  })

  it('phiên đã chết (SessionRefreshError invalid) → không retry', () => {
    expect(retry(0, new SessionRefreshError('invalid'))).toBe(false)
  })

  it('lỗi refresh tạm (transient) → vẫn retry một lần', () => {
    const error = new SessionRefreshError('transient')
    expect(retry(0, error)).toBe(true)
    expect(retry(1, error)).toBe(false)
  })

  it('lỗi khác → retry đúng một lần như cũ', () => {
    const error = new AxiosError('Network Error')
    expect(retry(0, error)).toBe(true)
    expect(retry(1, error)).toBe(false)
  })
})
