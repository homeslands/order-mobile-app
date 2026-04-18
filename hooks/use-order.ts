import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query'

import {
  addNewOrderItem,
  callCustomerToGetOrder,
  createOrder,
  createOrderTracking,
  createOrderWithoutLogin,
  deleteOrder,
  deleteOrderItem,
  deleteOrderWithoutLogin,
  exportOrderInvoice,
  exportPaymentQRCode,
  exportPublicOrderInvoice,
  getAddressByPlaceId,
  getAddressDirection,
  getAddressSuggestions,
  getAllOrders,
  getAllOrdersPublic,
  getAllOrderWithoutLogin,
  getDistanceAndDuration,
  getOrderBySlug,
  getOrderInvoice,
  getOrderProvisionalBill,
  getPrinterEvents,
  getPublicOrderInvoice,
  initiatePayment,
  initiatePublicPayment,
  reprintFailedInvoicePrinterJobs,
  updateNoteOrderItem,
  updateOrderItem,
  updateOrderType,
  updatePublicVoucherInOrder,
  updateVoucherInOrder,
} from '@/api'
import { QUERYKEY } from '@/constants'
import {
  IAddNewOrderItemRequest,
  ICreateOrderRequest,
  ICreateOrderTrackingRequest,
  IGetOrderInvoiceRequest,
  IGetPrinterEventsRequest,
  IInitiatePaymentRequest,
  IOrderItemsParam,
  IOrdersQuery,
  IUpdateNoteRequest,
  IUpdateOrderItemRequest,
  IUpdateOrderTypeRequest,
} from '@/types'
import { useDownloadImage } from './use-download-image'

export const useOrders = (q: IOrdersQuery, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['orders', q],
    queryFn: () => getAllOrders(q),
    placeholderData: keepPreviousData,
    select: (data) => data.result,
    enabled: options?.enabled ?? true,
  })
}

export interface UseOrdersPublicOptions {
  enabled?: boolean
}

export const useOrdersPublic = (options?: UseOrdersPublicOptions) => {
  const enabled = options?.enabled ?? true
  return useQuery({
    queryKey: ['orders-public'],
    queryFn: () => getAllOrdersPublic(),
    placeholderData: keepPreviousData,
    enabled,
  })
}

// Hook
export const useOrderBySlug = (slug: string | null | undefined) => {
  const isValidSlug = !!slug?.trim()

  return useQuery({
    queryKey: ['order', slug],
    queryFn: () => getOrderBySlug(slug!),
    enabled: isValidSlug, // Block fetching if slug is not valid
    placeholderData: keepPreviousData,
  })
}

export const useCallCustomerToGetOrder = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return callCustomerToGetOrder(slug)
    },
  })
}

export const useCreateOrder = () => {
  return useMutation({
    mutationFn: async (data: ICreateOrderRequest) => {
      return createOrder(data)
    },
  })
}

export const useInitiatePayment = () => {
  return useMutation({
    mutationFn: async (data: IInitiatePaymentRequest) => {
      return initiatePayment(data)
    },
  })
}

export const useInitiatePublicPayment = () => {
  return useMutation({
    mutationFn: async (data: IInitiatePaymentRequest) => {
      return initiatePublicPayment(data)
    },
  })
}

export const useCreateOrderTracking = () => {
  return useMutation({
    mutationFn: async (data: ICreateOrderTrackingRequest) => {
      return createOrderTracking(data)
    },
  })
}

export const useGetOrderInvoice = (params: IGetOrderInvoiceRequest) => {
  return useQuery({
    queryKey: ['order-invoice', params],
    queryFn: () => getOrderInvoice(params),
    placeholderData: keepPreviousData,
  })
}

export const useGetPublicOrderInvoice = (order: string) => {
  return useQuery({
    queryKey: ['public-order-invoice', order],
    queryFn: () => getPublicOrderInvoice(order),
  })
}

export const useExportOrderInvoice = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return exportOrderInvoice(slug)
    },
  })
}

export const useExportPublicOrderInvoice = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return exportPublicOrderInvoice(slug)
    },
  })
}

/**
 * Hook to download order-related images (product images, etc.)
 * Uses useDownloadImage hook internally
 */
export const useDownloadOrderImage = () => {
  const { downloadImage } = useDownloadImage()

  const downloadProductImage = async (
    imageUrl: string,
    productName?: string,
  ) => {
    const fileName = productName
      ? `product_${productName.replace(/\s+/g, '_')}`
      : undefined
    return await downloadImage(imageUrl, fileName)
  }

  return {
    downloadProductImage,
    downloadImage, // Expose general download function
  }
}

export const useExportPayment = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return exportPaymentQRCode(slug)
    },
  })
}

export const useGetOrderProvisionalBill = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return getOrderProvisionalBill(slug)
    },
  })
}

//Update order
export const useAddNewOrderItem = () => {
  return useMutation({
    mutationFn: async (data: IAddNewOrderItemRequest) => {
      return addNewOrderItem(data)
    },
  })
}

export const useUpdateOrderItem = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      data,
    }: {
      slug: string
      data: IUpdateOrderItemRequest
    }) => {
      return updateOrderItem(slug, data)
    },
  })
}

export const useUpdateNoteOrderItem = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      data,
    }: {
      slug: string
      data: IUpdateNoteRequest
    }) => {
      return updateNoteOrderItem(slug, data)
    },
  })
}

export const useDeleteOrderItem = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteOrderItem(slug)
    },
  })
}

// update voucher
export const useUpdateVoucherInOrder = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      voucher,
      orderItems,
    }: {
      slug: string
      voucher: string | null
      orderItems: IOrderItemsParam[]
    }) => {
      return updateVoucherInOrder(slug, voucher, orderItems)
    },
  })
}

export const useUpdatePublicVoucherInOrder = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      voucher,
      orderItems,
    }: {
      slug: string
      voucher: string | null
      orderItems: IOrderItemsParam[]
    }) => {
      return updatePublicVoucherInOrder(slug, voucher, orderItems)
    },
  })
}

//Update order type
export const useUpdateOrderType = () => {
  return useMutation({
    mutationFn: async ({
      slug,
      params,
    }: {
      slug: string
      params: IUpdateOrderTypeRequest
    }) => {
      return updateOrderType(slug, params)
    },
  })
}

//Delete order
export const useDeleteOrder = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteOrder(slug)
    },
  })
}

export const useDeletePublicOrder = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return deleteOrderWithoutLogin(slug)
    },
  })
}

// order without login
export const useCreateOrderWithoutLogin = () => {
  return useMutation({
    mutationFn: async (data: ICreateOrderRequest) => {
      return createOrderWithoutLogin(data)
    },
  })
}

export const useGetAllOrderWithoutLogin = () => {
  return useQuery({
    queryKey: ['orders-without-login'],
    queryFn: () => getAllOrderWithoutLogin(),
  })
}

export const useReprintFailedInvoicePrinterJobs = () => {
  return useMutation({
    mutationFn: async (slug: string) => {
      return reprintFailedInvoicePrinterJobs(slug)
    },
  })
}

export const useGetAddressSuggestions = (address: string) => {
  return useQuery({
    queryKey: [QUERYKEY.addressSuggestions, address],
    queryFn: () => getAddressSuggestions(address),
    enabled: !!address,
  })
}

export const useGetAddressByPlaceId = (placeId: string) => {
  return useQuery({
    queryKey: [QUERYKEY.addressByPlaceId, placeId],
    queryFn: () => getAddressByPlaceId(placeId),
    enabled: !!placeId,
  })
}

export const useGetAddressDirection = (
  branch: string,
  lat: number,
  lng: number,
) => {
  return useQuery({
    queryKey: [QUERYKEY.addressDirection, branch, lat, lng],
    queryFn: () => getAddressDirection(branch, lat, lng),
    enabled: !!branch && !!lat && !!lng,
  })
}

export const useGetDistanceAndDuration = (
  branch: string,
  lat: number,
  lng: number,
) => {
  return useQuery({
    queryKey: [QUERYKEY.distanceAndDuration, branch, lat, lng],
    queryFn: () => getDistanceAndDuration(branch, lat, lng),
    enabled: !!branch && !!lat && !!lng,
  })
}

export const useGetPrinterEvents = (params?: IGetPrinterEventsRequest) => {
  // Separate page and size from params for pagination
  const { page: _, size: __, ...baseParams } = params || {}
  const pageSize = params?.size || 10

  return useInfiniteQuery({
    queryKey: [QUERYKEY.printerEvents, baseParams],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await getPrinterEvents({
        params: {
          ...baseParams,
          page: pageParam as number,
          size: pageSize,
        },
      })

      // Response structure: { result: { items: IPrinterEvent[], hasNext, page, ... } }
      return response
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (
        lastPage?.result &&
        typeof lastPage.result === 'object' &&
        'hasNext' in lastPage.result
      ) {
        const paginationResult = lastPage.result as {
          hasNext: boolean
          page: number
        }
        return paginationResult.hasNext ? paginationResult.page + 1 : undefined
      }
      return undefined
    },
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  })
}
