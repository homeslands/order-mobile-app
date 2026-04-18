import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  getGiftCardBySlug,
  getGiftCards,
  getUserGiftCardBySlug,
  getUserGiftCards,
} from '@/api'
import { QUERYKEY } from '@/constants'
import type {
  IApiResponse,
  IGetGiftCardsRequest,
  IGiftCard,
  IGiftCardDetail,
  IGiftCardGetRequest,
  IPaginationResponse,
} from '@/types'

export const useGiftCards = (
  params?: IGetGiftCardsRequest,
  options?: { enabled?: boolean },
) => {
  return useQuery<
    IApiResponse<IPaginationResponse<IGiftCard>>,
    Error,
    IPaginationResponse<IGiftCard>
  >({
    queryKey: [QUERYKEY.giftCards, params],
    queryFn: () => getGiftCards(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: options?.enabled !== false,
  })
}

export const useGiftCardBySlug = (slug: string | null | undefined) => {
  return useQuery<IApiResponse<IGiftCard>, Error, IGiftCard>({
    queryKey: [QUERYKEY.giftCards, slug],
    queryFn: () => getGiftCardBySlug(slug!),
    select: (data) => data.result,
    enabled: !!slug,
  })
}

export const useUserGiftCards = (
  params: IGiftCardGetRequest,
  options?: { enabled?: boolean },
) => {
  const hasCustomer = !!params.customerSlug
  return useQuery<
    IApiResponse<IPaginationResponse<IGiftCardDetail>>,
    Error,
    IPaginationResponse<IGiftCardDetail>
  >({
    queryKey: [QUERYKEY.userGiftCards, params],
    queryFn: () => getUserGiftCards(params),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: options?.enabled !== false && hasCustomer,
  })
}

export const useUserGiftCardBySlug = (
  userSlug: string | null | undefined,
  giftCardSlug: string | null | undefined,
) => {
  return useQuery<IApiResponse<IGiftCardDetail>, Error, IGiftCardDetail>({
    queryKey: [QUERYKEY.giftCardDetail, userSlug, giftCardSlug],
    queryFn: () => getUserGiftCardBySlug(userSlug!, giftCardSlug!),
    select: (data) => data.result,
    enabled: !!userSlug && !!giftCardSlug,
  })
}
