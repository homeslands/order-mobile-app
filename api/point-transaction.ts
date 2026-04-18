import {
  IApiResponse,
  IAnalyzePointTransaction,
  IPaginationResponse,
  IPointTransaction,
  IPointTransactionQuery,
} from '@/types'
import { http } from '@/utils'

export async function getPointTransactions(
  params: IPointTransactionQuery,
): Promise<IApiResponse<IPaginationResponse<IPointTransaction>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IPointTransaction>>
  >('/point-transaction', { params })
  return response.data
}

export async function getPointTransactionAnalysis(
  userSlug: string,
): Promise<IApiResponse<IAnalyzePointTransaction>> {
  const response = await http.get<IApiResponse<IAnalyzePointTransaction>>(
    '/point-transaction/analysis',
    { params: { userSlug } },
  )
  return response.data
}
