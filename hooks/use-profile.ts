import { getProfile } from '@/api/profile'
import { useQuery } from '@tanstack/react-query'

export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await getProfile()
      return response
    },
    enabled: false, // Chỉ fetch khi gọi refetch manually
  })
}

