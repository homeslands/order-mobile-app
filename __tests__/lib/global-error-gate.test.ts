import { resolveGlobalErrorCode } from '@/lib/global-error-gate'

const withCode = (statusCode: number) => ({
  response: { data: { statusCode } },
})
const networkError = new Error('Network Error')

describe('resolveGlobalErrorCode', () => {
  it('skips everything when skipGlobalError is true', () => {
    expect(
      resolveGlobalErrorCode({ skipGlobalError: true }, withCode(500)),
    ).toBeNull()
  })

  it('skips a code listed in skipGlobalErrorCodes', () => {
    expect(
      resolveGlobalErrorCode(
        { skipGlobalErrorCodes: [401, 403] },
        withCode(401),
      ),
    ).toBeNull()
  })

  it('returns a code NOT listed in skipGlobalErrorCodes', () => {
    expect(
      resolveGlobalErrorCode(
        { skipGlobalErrorCodes: [401, 403] },
        withCode(500),
      ),
    ).toBe(500)
  })

  it('returns the code when there is no meta', () => {
    expect(resolveGlobalErrorCode(undefined, withCode(500))).toBe(500)
  })

  it('returns null for a network error with no status code', () => {
    expect(resolveGlobalErrorCode(undefined, networkError)).toBeNull()
  })
})
