import { IApiResponse, ICatalog } from '@/types'
import { http } from '@/utils'

export async function getCatalog(): Promise<IApiResponse<ICatalog[]>> {
    const response = await http.get<IApiResponse<ICatalog[]>>('/catalogs')
    if (!response || !response.data) throw new Error('No data found')
    return response.data
  }

