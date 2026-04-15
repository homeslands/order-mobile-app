import { useQuery } from '@tanstack/react-query'

import { getUsers } from '@/api'
import { QUERYKEY } from '@/constants'

const PHONE_REGEX = /^0[0-9]{9,10}$/

export function useUserByPhone(phone: string) {
  const isValid = PHONE_REGEX.test(phone)
  return useQuery({
    queryKey: [QUERYKEY.profile, 'byPhone', phone],
    queryFn: () =>
      getUsers({ phonenumber: phone, page: 1, size: 1, order: 'ASC' }),
    select: (data) => data.result?.items?.[0] ?? null,
    enabled: isValid,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  })
}
