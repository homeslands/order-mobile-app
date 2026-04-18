import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  cancelCardOrder,
  createCardOrder,
  getCardOrderBySlug,
  getCardOrders,
  initiateCardOrderPayment,
  resendGiftCardSms,
  type IInitiateCardOrderPaymentRequest,
} from '@/api'
import { QUERYKEY } from '@/constants'
import type {
  IApiResponse,
  ICardOrderGetRequest,
  ICardOrderRequest,
  ICardOrderResponse,
  IPaginationResponse,
} from '@/types'

export const useCardOrders = (
  params?: ICardOrderGetRequest,
  options?: { enabled?: boolean },
) => {
  return useQuery<
    IApiResponse<IPaginationResponse<ICardOrderResponse>>,
    Error,
    IPaginationResponse<ICardOrderResponse>
  >({
    queryKey: [QUERYKEY.cardOrder, params],
    queryFn: () => getCardOrders(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: options?.enabled !== false,
  })
}

export const useCardOrdersInfinite = (
  params?: Omit<ICardOrderGetRequest, 'page'>,
  options?: { enabled?: boolean },
) => {
  return useInfiniteQuery({
    queryKey: [QUERYKEY.cardOrder, 'infinite', params],
    queryFn: ({ pageParam }) =>
      getCardOrders({ ...params, page: pageParam as number, size: 20 }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const { page, totalPages } = last.result
      return page < totalPages ? page + 1 : undefined
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: options?.enabled !== false,
  })
}

export const useCardOrderBySlug = (slug: string | null | undefined) => {
  return useQuery<IApiResponse<ICardOrderResponse>, Error, ICardOrderResponse>({
    queryKey: [QUERYKEY.cardOrder, slug],
    queryFn: () => getCardOrderBySlug(slug!),
    select: (data) => data.result,
    enabled: !!slug?.trim(),
    placeholderData: keepPreviousData,
  })
}

export const useCreateCardOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: ICardOrderRequest) => createCardOrder(data),
    // skipGlobalError: per-call onError in checkout/index.tsx handles toast display
    meta: { skipGlobalError: true },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERYKEY.cardOrder] })
    },
  })
}

export const useCancelCardOrder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => cancelCardOrder(slug),
    onSuccess: (_data, slug) => {
      void queryClient.invalidateQueries({
        queryKey: [QUERYKEY.cardOrder, slug],
      })
    },
  })
}

export const useResendGiftCardSms = () => {
  return useMutation({
    mutationFn: ({
      orderSlug,
      recipientId,
    }: {
      orderSlug: string
      recipientId: string
    }) => resendGiftCardSms(orderSlug, recipientId),
  })
}

export const useInitiateCardOrderPayment = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: IInitiateCardOrderPaymentRequest) =>
      initiateCardOrderPayment(data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [QUERYKEY.cardOrder, variables.cardorderSlug],
      })
    },
  })
}
