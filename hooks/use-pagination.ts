import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'

interface PaginationState {
  pageIndex: number
  pageSize: number
}

export const usePagination = ({
  isSearchParams = true,
  defaultPageSize = 10,
}: { isSearchParams?: boolean; defaultPageSize?: number } = {}) => {
  const router = useRouter()
  const searchParams = useLocalSearchParams()
  const page = isSearchParams
    ? parseInt((searchParams.page as string) || '1', 10)
    : 1
  const pageSize = isSearchParams
    ? parseInt((searchParams.size as string) || defaultPageSize.toString(), 10)
    : defaultPageSize
  
  // Only use state when not syncing with URL params
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 1,
    pageSize: defaultPageSize,
  })

  // Compute pagination from URL params when isSearchParams is true, otherwise use state
  const pagination: PaginationState = isSearchParams
    ? { pageIndex: page, pageSize }
    : internalPagination

  const handlePageChange = (pageIndex: number) => {
    if (isSearchParams) {
      const newParams = { ...searchParams, page: pageIndex.toString() }
      router.setParams(newParams)
    } else {
      setInternalPagination((prev) => ({ ...prev, pageIndex }))
    }
  }

  const handlePageSizeChange = (newPageSize: number) => {
    if (isSearchParams) {
      const newParams = { ...searchParams, size: newPageSize.toString(), page: '1' }
      router.setParams(newParams)
    } else {
      setInternalPagination({ pageSize: newPageSize, pageIndex: 1 })
    }
  }

  const setPagination = (newPagination: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    if (isSearchParams) {
      const value = typeof newPagination === 'function' 
        ? newPagination(pagination) 
        : newPagination
      const newParams = { 
        ...searchParams, 
        page: value.pageIndex.toString(),
        size: value.pageSize.toString()
      }
      router.setParams(newParams)
    } else {
      setInternalPagination(newPagination)
    }
  }

  return { pagination, setPagination, handlePageChange, handlePageSizeChange }
}
