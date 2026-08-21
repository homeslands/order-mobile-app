import {
  MENU_QUERY_SKIP_CODES,
  resolveGlobalErrorCode,
} from '@/lib/global-error-gate'

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

describe('MENU_QUERY_SKIP_CODES', () => {
  // 117002 "Menu not found" là câu trả lời của backend cho catalog không có món
  // hôm nay. Màn menu bắn một query mỗi catalog nên nếu không chặn, một chi
  // nhánh có 5 catalog rỗng sẽ bắn 5 toast dù thực đơn vẫn hiện bình thường.
  it.each([401, 403, 117002])('chặn toast cho mã %i', (code) => {
    expect(
      resolveGlobalErrorCode({ skipGlobalErrorCodes: MENU_QUERY_SKIP_CODES }, withCode(code)),
    ).toBeNull()
  })

  it('vẫn để lộ lỗi thật của query menu', () => {
    expect(
      resolveGlobalErrorCode({ skipGlobalErrorCodes: MENU_QUERY_SKIP_CODES }, withCode(500)),
    ).toBe(500)
  })
})
