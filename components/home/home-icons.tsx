/**
 * Bộ icon hai tông cho các lối tắt trên Home.
 *
 * Vẽ riêng thay cho bộ lucide có sẵn: nét khung, nét nhấn cho chi tiết nhận
 * diện, và mảng lót bên trong — màu do nơi dùng truyền vào, từ design token. Mỗi icon có một chi tiết riêng (thẻ
 * có hình người, ly có hơi nóng, hộp quà có nơ) — bộ icon nét đều nhau là thứ
 * làm màn hình trông như dựng từ template.
 *
 * Toạ độ trên khung 24×24, giống lucide, để đổi kích cỡ không lệch nét.
 */
import { memo, type ReactNode } from 'react'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

export type HomeIconProps = {
  size: number
  /** Nét khung. */
  stroke: string
  /** Nét chi tiết nhận diện. */
  accent: string
  /** Mảng lót bên trong. */
  fill: string
}

const STROKE_WIDTH = 1.6

function Frame({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  )
}

/** Mã định danh — thẻ thành viên có hình người. */
export const MemberIdIcon = memo(function MemberIdIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Rect
        x={3}
        y={5}
        width={18}
        height={14}
        rx={3}
        fill={fill}
        stroke={stroke}
      />
      <Circle cx={9} cy={11} r={2} stroke={accent} />
      <Path d="M6.5 15.5c.6-1.3 1.5-2 2.5-2s1.9.7 2.5 2" stroke={accent} />
      <Path d="M14 10h4M14 13.5h3" stroke={stroke} />
    </Frame>
  )
})

/** Quét QR trả đơn — khung quét bao một mã. */
export const ScanPayIcon = memo(function ScanPayIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M3 8V6a3 3 0 0 1 3-3h2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2"
        stroke={stroke}
      />
      <Rect
        x={7.5}
        y={7.5}
        width={9}
        height={9}
        rx={2}
        fill={fill}
        stroke={accent}
      />
      <Path d="M10.5 10.5h3v3h-3z" fill={accent} stroke="none" />
    </Frame>
  )
})

/** Thanh toán Xu — mã QR có đồng xu ở góc. */
export const CoinPaymentIcon = memo(function CoinPaymentIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Rect x={3} y={3} width={7} height={7} rx={1.5} stroke={stroke} />
      <Rect x={3} y={14} width={7} height={7} rx={1.5} stroke={stroke} />
      <Rect x={14} y={3} width={7} height={7} rx={1.5} stroke={stroke} />
      <Circle cx={17.5} cy={17.5} r={4} fill={fill} stroke={accent} />
      <Path d="M17.5 15.8v3.4" stroke={accent} />
    </Frame>
  )
})

/** Đặt món — ly có hơi nóng. */
export const OrderIcon = memo(function OrderIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"
        fill={fill}
        stroke={stroke}
      />
      <Path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" stroke={stroke} />
      <Path
        d="M8 3.5c-.6.8-.6 1.7 0 2.5M12 3.5c-.6.8-.6 1.7 0 2.5"
        stroke={accent}
      />
    </Frame>
  )
})

/** Đổi thẻ quà tặng — hộp quà có nơ. */
export const RedeemGiftIcon = memo(function RedeemGiftIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Rect
        x={4}
        y={11}
        width={16}
        height={9}
        rx={2}
        fill={fill}
        stroke={stroke}
      />
      <Rect x={3} y={7.5} width={18} height={4} rx={1.5} stroke={stroke} />
      <Path d="M12 7.5V20" stroke={accent} />
      <Path
        d="M12 7.5C10.5 4 7 3.8 7 6c0 1.3 1.6 1.5 5 1.5zM12 7.5c1.5-3.5 5-3.7 5-1.5 0 1.3-1.6 1.5-5 1.5z"
        stroke={accent}
      />
    </Frame>
  )
})

/** Lịch sử đơn — bảng kẹp giấy có danh sách. */
export const OrderHistoryIcon = memo(function OrderHistoryIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Rect
        x={5}
        y={4}
        width={14}
        height={17}
        rx={2.5}
        fill={fill}
        stroke={stroke}
      />
      <Rect
        x={9}
        y={2.5}
        width={6}
        height={3.5}
        rx={1.2}
        fill={fill}
        stroke={stroke}
      />
      <Path d="M9 11h6M9 15h4" stroke={accent} />
    </Frame>
  )
})

/**
 * Thẻ quà (tab Gift Card) — tấm thẻ có dải ruy băng và nơ. Khác hộp quà của
 * "Đổi thẻ quà tặng" để hai ô về thẻ quà không mang cùng một hình.
 */
export const GiftCardIcon = memo(function GiftCardIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Rect
        x={2.5}
        y={5.5}
        width={19}
        height={13}
        rx={2.5}
        fill={fill}
        stroke={stroke}
      />
      <Path d="M9 5.5v13" stroke={accent} />
      <Path
        d="M9 10C7.8 8.2 5.5 8.3 5.5 9.6c0 1 1.4 1.2 3.5 1.2M9 10c1.2-1.8 3.5-1.7 3.5-.4 0 1-1.4 1.2-3.5 1.2"
        stroke={accent}
      />
      <Path d="M14.5 14.5h4" stroke={stroke} />
    </Frame>
  )
})

/** Liên hệ — ống nghe có sóng. */
export const HotlineIcon = memo(function HotlineIcon({
  size,
  stroke,
  accent,
  fill,
}: HomeIconProps) {
  return (
    <Frame size={size}>
      <Path
        d="M20 16.4v2.7a1.8 1.8 0 0 1-2 1.8 17.8 17.8 0 0 1-7.8-2.8 17.5 17.5 0 0 1-5.4-5.4A17.8 17.8 0 0 1 2 4.9 1.8 1.8 0 0 1 3.8 3h2.7a1.8 1.8 0 0 1 1.8 1.5c.1.9.3 1.7.6 2.5a1.8 1.8 0 0 1-.4 1.9L7.3 10.1a14.4 14.4 0 0 0 5.4 5.4l1.2-1.2a1.8 1.8 0 0 1 1.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 0 1 1.7 1.9z"
        fill={fill}
        stroke={stroke}
      />
      <Path
        d="M14.5 3.5a6 6 0 0 1 5.5 5.5M14.5 7a2.5 2.5 0 0 1 2 2"
        stroke={accent}
      />
    </Frame>
  )
})
