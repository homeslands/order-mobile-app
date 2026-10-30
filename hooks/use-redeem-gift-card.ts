import { useMutation, useQueryClient } from '@tanstack/react-query'

import { redeemGiftCard } from '@/api'
import { QUERYKEY } from '@/constants'
import { loyaltyPointsTotalQueryOptions } from '@/hooks/use-loyalty-point'
import type {
  IApiResponse,
  IUseGiftCardRequest,
  IUseGiftCardResponse,
} from '@/types'

export const useRedeemGiftCard = () => {
  const queryClient = useQueryClient()

  return useMutation<
    IApiResponse<IUseGiftCardResponse>,
    Error,
    IUseGiftCardRequest
  >({
    mutationFn: (data) => redeemGiftCard(data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: loyaltyPointsTotalQueryOptions(variables.userSlug).queryKey,
      })
      void queryClient.invalidateQueries({ queryKey: [QUERYKEY.userGiftCards] })
      void queryClient.invalidateQueries({
        queryKey: [QUERYKEY.profile, 'balance', variables.userSlug],
      })
    },
  })
}
