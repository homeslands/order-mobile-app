import {
  IApiResponse,
  ICardOrderGetRequest,
  ICardOrderRequest,
  ICardOrderResponse,
  IPaginationResponse,
} from '@/types'
import { CardOrderPaymentMethod } from '@/constants'
import { http } from '@/utils'

export async function createCardOrder(
  data: ICardOrderRequest,
): Promise<IApiResponse<ICardOrderResponse>> {
  const response = await http.post<IApiResponse<ICardOrderResponse>>(
    '/card-order',
    data,
  )
  return response.data
}

export async function getCardOrders(
  params?: ICardOrderGetRequest,
): Promise<IApiResponse<IPaginationResponse<ICardOrderResponse>>> {
  const { size, ...rest } = params ?? {}
  const queryParams = size !== undefined ? { ...rest, limit: size } : rest
  const response = await http.get<
    IApiResponse<IPaginationResponse<ICardOrderResponse>>
  >('/card-order', { params: queryParams })
  return response.data
}

export async function getCardOrderBySlug(
  slug: string,
): Promise<IApiResponse<ICardOrderResponse>> {
  const response = await http.get<IApiResponse<ICardOrderResponse>>(
    `/card-order/${slug}`,
  )
  return response.data
}

export async function cancelCardOrder(
  slug: string,
): Promise<IApiResponse<void>> {
  const response = await http.post<IApiResponse<void>>(
    `/card-order/${slug}/cancel`,
  )
  return response.data
}

export interface IInitiateCardOrderPaymentRequest {
  cardorderSlug: string
  paymentMethod: CardOrderPaymentMethod
  cashierSlug?: string
}

export async function resendGiftCardSms(
  orderSlug: string,
  recipientId: string,
): Promise<IApiResponse<void>> {
  const response = await http.post<IApiResponse<void>>(
    `/card-order/${orderSlug}/resend-sms/${recipientId}`,
  )
  return response.data
}

export async function initiateCardOrderPayment(
  data: IInitiateCardOrderPaymentRequest,
): Promise<IApiResponse<ICardOrderResponse>> {
  const { cardorderSlug, ...body } = data
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[initiateCardOrderPayment] POST /card-order/payment/initiate', JSON.stringify({ cardorderSlug, ...body }, null, 2))
  }
  try {
    const response = await http.post<IApiResponse<ICardOrderResponse>>(
      '/card-order/payment/initiate',
      { cardorderSlug, ...body },
    )
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[initiateCardOrderPayment] response:', JSON.stringify(response.data, null, 2))
    }
    return response.data
  } catch (error: unknown) {
    const e = error as { response?: { status?: number; data?: unknown } }
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[initiateCardOrderPayment] error:', e?.response?.status, JSON.stringify(e?.response?.data, null, 2))
    }
    throw error
  }
}
