export interface IQRGenerateResponse {
  /** rawToken 64 ký tự hex — nội dung của QR code, FE tự render */
  token: string
  /** ISO 8601 — thời điểm token hết hạn (TTL 60s) */
  expiresAt: string
}
