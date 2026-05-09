import { GiftCardType } from '@/constants'
import { z } from 'zod'

export const recipientSchema = z.object({
  recipientSlug: z.string().min(10, 'Vui lòng chọn người nhận từ gợi ý'),
  phone: z
    .string()
    .regex(
      /^0[0-9]{9,10}$/,
      'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0)',
    ),
  name: z.string().optional(),
  quantity: z.number({ message: 'Nhập số lượng hợp lệ' }).min(1, 'Tối thiểu 1'),
  message: z.string().max(200, 'Tối đa 200 ký tự').optional(),
})

export const checkoutSchema = z.object({
  cardOrderType: z.enum([
    GiftCardType.SELF,
    GiftCardType.GIFT,
    GiftCardType.BUY,
  ]),
  recipients: z.array(recipientSchema),
})

export type CheckoutFormValues = z.infer<typeof checkoutSchema>
