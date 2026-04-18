import {
  IApiResponse,
  IGiftCard,
  IGiftCardDetail,
  IGiftCardGetRequest,
  IGetGiftCardsRequest,
  IPaginationResponse,
  IUseGiftCardRequest,
  IUseGiftCardResponse,
} from '@/types'
import { http } from '@/utils'

export async function getGiftCards(
  params?: IGetGiftCardsRequest,
): Promise<IApiResponse<IPaginationResponse<IGiftCard>>> {
  const response = await http.get<IApiResponse<IPaginationResponse<IGiftCard>>>(
    '/card',
    { params },
  )
  return response.data
}

export async function getGiftCardBySlug(
  slug: string,
): Promise<IApiResponse<IGiftCard>> {
  const response = await http.get<IApiResponse<IGiftCard>>(`/card/${slug}`)
  return response.data
}

export async function getUserGiftCards(
  params: IGiftCardGetRequest,
): Promise<IApiResponse<IPaginationResponse<IGiftCardDetail>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IGiftCardDetail>>
  >('/gift-card', { params })
  return response.data
}

export async function getUserGiftCardBySlug(
  _userSlug: string,
  giftCardSlug: string,
): Promise<IApiResponse<IGiftCardDetail>> {
  const response = await http.get<IApiResponse<IGiftCardDetail>>(
    `/gift-card/${giftCardSlug}`,
  )
  return response.data
}

export async function redeemGiftCard(
  data: IUseGiftCardRequest,
): Promise<IApiResponse<IUseGiftCardResponse>> {
  const { serial, code, userSlug } = data
  const response = await http.post<IApiResponse<IUseGiftCardResponse>>(
    '/gift-card/use',
    { serial, code, userSlug },
  )
  return response.data
}
