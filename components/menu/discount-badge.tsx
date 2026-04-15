import React from 'react'

import { Badge } from '@/components/ui'

interface DiscountBadgeProps {
  value: number
  label: string
}

/** Badge hiển thị phần trăm giảm giá — memo để tránh re-render khi parent scroll */
export const DiscountBadge = React.memo(function DiscountBadge({
  value,
  label,
}: DiscountBadgeProps) {
  return (
    <Badge className="bg-red-600 text-xs">
      {label} {value}%
    </Badge>
  )
})
