import {
  IApiResponse,
  IChefArea,
  IChefAreaProduct,
  IChefOrders,
  IChefSpecificOrder,
  ICreateChefAreaProductRequest,
  ICreateChefAreaRequest,
  ICreateChefOrderRequest,
  ICreatePrinterForChefAreaRequest,
  IGetChefOrderRequest,
  IPaginationResponse,
  IPrinterForChefArea,
  IUpdateChefAreaProductRequest,
  IUpdateChefAreaRequest,
  IUpdateChefOrderItemStatusRequest,
  IUpdateChefOrderStatusRequest,
  IUpdatePrinterForChefAreaRequest,
} from '@/types'
import { http } from '@/utils'

export type ChefAreaDownloadCallbacks = {
  onProgress?: (percent: number) => void
}

export async function getChefAreas(
  branch: string,
): Promise<IApiResponse<IChefArea[]>> {
  const response = await http.get<IApiResponse<IChefArea[]>>(`/chef-area/`, {
    // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
    doNotShowLoading: true,
    params: { branch },
  })
  // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
  return response.data
}

export async function createChefArea(
  data: ICreateChefAreaRequest,
): Promise<IApiResponse<IChefArea>> {
  const response = await http.post<IApiResponse<IChefArea>>('/chef-area', data)
  return response.data
}

export async function getChefAreaBySlug(
  slug: string,
): Promise<IApiResponse<IChefArea>> {
  const response = await http.get<IApiResponse<IChefArea>>(`/chef-area/specific/${slug}`)
  return response.data
}

export async function updateChefArea(
  data: IUpdateChefAreaRequest,
): Promise<IApiResponse<IChefArea>> {
  const response = await http.patch<IApiResponse<IChefArea>>(`/chef-area/${data.slug}`, data)
  return response.data
}

export async function deleteChefArea(slug: string): Promise<void> {
  await http.delete<IApiResponse<IChefArea>>(`/chef-area/${slug}`)
}

export async function exportChefOrder(
  slug: string,
  callbacks?: ChefAreaDownloadCallbacks,
): Promise<Blob> {
  const response = await http.get<Blob>(`/chef-order/${slug}/export`, {
    responseType: 'blob',
    headers: { Accept: 'application/pdf' },
    onDownloadProgress: callbacks?.onProgress
      ? (e) => {
          const p = Math.round((e.loaded * 100) / (e.total ?? 1))
          callbacks.onProgress?.(p)
        }
      : undefined,
  })
  return response.data
}

export async function getAllChefAreaProducts(
  chefArea: string,
): Promise<IApiResponse<IChefAreaProduct[]>> {
  const response = await http.get<IApiResponse<IChefAreaProduct[]>>(`/product-chef-area`, {
    params: { chefArea },
  })
  return response.data
}

export async function getChefAreaSpecificProduct(
  chefAreaProduct: string,
): Promise<IApiResponse<IChefAreaProduct[]>> {
  const response = await http.get<IApiResponse<IChefAreaProduct[]>>(
    `/product-chef-area/specific/${chefAreaProduct}`,
  )
  return response.data
}

export async function addProductToChefArea(
  data: ICreateChefAreaProductRequest,
): Promise<IApiResponse<IChefAreaProduct>> {
  const response = await http.post<IApiResponse<IChefAreaProduct>>('/product-chef-area', { data })
  return response.data
}

export async function addMultipleProductsToChefArea(
  data: ICreateChefAreaProductRequest,
): Promise<IApiResponse<IChefAreaProduct[]>> {
  const response = await http.post<IApiResponse<IChefAreaProduct[]>>('/product-chef-area/multi', data)
  return response.data
}

export async function updateProductInChefArea(
  data: IUpdateChefAreaProductRequest,
): Promise<IApiResponse<IChefAreaProduct>> {
  const response = await http.patch<IApiResponse<IChefAreaProduct>>(
    `/product-chef-area/${data.chefAreaProduct}`,
    data,
  )
  return response.data
}

export async function removeProductFromChefArea(
  chefAreaProduct: string,
): Promise<void> {
  await http.delete<IApiResponse<IChefAreaProduct>>(`/product-chef-area/${chefAreaProduct}`)
}

export async function getChefOrders(
  data: IGetChefOrderRequest,
): Promise<IApiResponse<IPaginationResponse<IChefOrders>>> {
  const response = await http.get<
    IApiResponse<IPaginationResponse<IChefOrders>>
  >(`/chef-order`, {
    // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
    doNotShowLoading: true,
    params: data,
  })
  // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
  return response.data
}

export async function getSpecificChefOrder(
  slug: string,
): Promise<IApiResponse<IChefSpecificOrder>> {
  const response = await http.get<IApiResponse<IChefSpecificOrder>>(`/chef-order/specific/${slug}`, {
    // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
    doNotShowLoading: true,
  })
  return response.data as IApiResponse<IChefSpecificOrder>
}

export async function createChefOrder(
  data: ICreateChefOrderRequest,
): Promise<IApiResponse<IChefOrders>> {
  const response = await http.post<IApiResponse<IChefOrders>>('/chef-order', data)
  return response.data
}

export async function updateChefOrderStatus(
  params: IUpdateChefOrderStatusRequest,
): Promise<IApiResponse<IChefOrders>> {
  const response = await http.patch<IApiResponse<IChefOrders>>(`/chef-order/${params.slug}`, {
    status: params.status,
  })
  return response.data
}

export async function updateChefOrderItemStatus(
  params: IUpdateChefOrderItemStatusRequest,
): Promise<IApiResponse<IChefOrders>> {
  const response = await http.patch<IApiResponse<IChefOrders>>(`/chef-order-item/${params.slug}`, {
    status: params.status,
  })
  return response.data
}

export async function exportManualChefOrderTicket(
  slug: string,
  callbacks?: ChefAreaDownloadCallbacks,
): Promise<Blob> {
  const response = await http.get<Blob>(
    `/chef-order/${slug}/export-manual/tickets`,
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      onDownloadProgress: callbacks?.onProgress
        ? (e) => {
            const p = Math.round((e.loaded * 100) / (e.total ?? 1))
            callbacks.onProgress?.(p)
          }
        : undefined,
      // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
      doNotShowLoading: true,
    },
  )
  return response.data as Blob
}

export async function exportAutoChefOrderTicket(
  slug: string,
  callbacks?: ChefAreaDownloadCallbacks,
): Promise<Blob> {
  const response = await http.get<Blob>(
    `/chef-order/${slug}/export-auto/tickets`,
    {
      responseType: 'blob',
      headers: { Accept: 'application/pdf' },
      onDownloadProgress: callbacks?.onProgress
        ? (e) => {
            const p = Math.round((e.loaded * 100) / (e.total ?? 1))
            callbacks.onProgress?.(p)
          }
        : undefined,
      // @ts-expect-error doNotShowLoading is not in AxiosRequestConfig
      doNotShowLoading: true,
    },
  )
  return response.data as Blob
}

export async function getPrinterForChefArea(
  slug: string,
): Promise<IApiResponse<IPrinterForChefArea[]>> {
  const response = await http.get<IApiResponse<IPrinterForChefArea[]>>(`/chef-area/${slug}/printers`)
  return response.data
}

export async function createPrinterForChefArea(
  data: ICreatePrinterForChefAreaRequest,
): Promise<IApiResponse<IPrinterForChefArea[]>> {
  const response = await http.post<IApiResponse<IPrinterForChefArea[]>>(`/chef-area/${data.slug}/printer`,
    data,)
  return response.data
}

export async function updatePrinterForChefArea(
  data: IUpdatePrinterForChefAreaRequest,
): Promise<IApiResponse<IPrinterForChefArea[]>> {
  const response = await http.patch<IApiResponse<IPrinterForChefArea[]>>(
    `/chef-area/${data.slug}/printer/${data.printerSlug}`,
    data,
  )
  return response.data
}

export async function deletePrinterForChefArea(
  slug: string,
  printerSlug: string,
): Promise<void> {
  await http.delete<IApiResponse<IPrinterForChefArea[]>>(`/chef-area/${slug}/printer/${printerSlug}`)
}

export async function togglePrinterForChefArea(
  slug: string,
  printerSlug: string,
): Promise<IApiResponse<IPrinterForChefArea[]>> {
  const response = await http.patch<IApiResponse<IPrinterForChefArea[]>>(`/chef-area/${slug}/printer/${printerSlug}/toggle`)
  return response.data
}

export async function pingPrinterForChefArea(
  slug: string,
  printerSlug: string,
): Promise<IApiResponse<{ success: boolean }>> {
  const response = await http.post<IApiResponse<{ success: boolean }>>(
    `/chef-area/${slug}/printer/${printerSlug}/ping`,
  )
  return response.data
}

export async function testExportTickets(
  slug: string,
  maxCount: number,
  type: string
): Promise<IApiResponse<{ success: boolean }>> {
  const response = await http.post<IApiResponse<{ success: boolean }>>(`/chef-order/${slug}/test-export/tickets/${maxCount}/${type}`,)
  return response.data
}

export async function reprintFailedInvoicePrinterJobs(
  slug: string,
): Promise<IApiResponse<{ success: boolean }>> {
  const response = await http.patch<IApiResponse<{ success: boolean }>>(`/orders/${slug}/re-print-failed-invoice-printer-jobs`)
  return response.data
}

export async function reprintFailedChefOrderPrinterJobs(
  slug: string,
): Promise<IApiResponse<{ success: boolean }>> {
  const response = await http.patch<IApiResponse<{ success: boolean }>>(`/chef-order/${slug}/re-print-failed-chef-order-printer-jobs`)
  return response.data
}

export async function reprintFailedLabelPrinterJobs(
  slug: string,
): Promise<IApiResponse<{ success: boolean }>> {
  const response = await http.patch<IApiResponse<{ success: boolean }>>(`/chef-order/${slug}/re-print-failed-label-printer-jobs`)
  return response.data
}
