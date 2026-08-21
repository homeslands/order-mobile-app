/**
 * Lọc chuỗi đọc được từ camera thành slug voucher.
 *
 * Hợp đồng do backend chốt: **QR chứa đúng `voucher.slug`, không gì khác** —
 * không URL, không code, không tiền tố.
 *
 * Lưu ý: slug KHÁC code. Ô nhập tay trong sheet nhận `code` (chuỗi in ở dòng
 * "Code" trên nhãn), còn camera nhận `slug`. `/voucher/specific` tra bằng hai
 * tham số khác nhau, truyền nhầm là 404 — nên bên gọi phải dùng đúng `slug`
 * cho giá trị hàm này trả về.
 *
 * Client KHÔNG phán định dạng slug: độ dài và bộ ký tự thật là chuyện của
 * server, mọi quy tắc hình dạng đặt ở đây đều là phỏng đoán có thể chặn oan.
 * Hàm chỉ loại những QR **chắc chắn không phải slug**: mang scheme khác
 * (wifi, vCard, mailto, tel, URL), có khoảng trắng, hoặc dài quá mức — để
 * tránh một vòng gọi mạng vô nghĩa.
 */

// Bất kỳ QR nào mở đầu bằng một scheme (`wifi:`, `begin:`, `mailto:`, `tel:`,
// `geo:`, `https:`…) đều là định dạng khác. Slug không có dạng này.
const URI_SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i

/**
 * Biên trên để chặn rác (vCard, JSON, payload dài), KHÔNG phải luật độ dài
 * slug. Đặt rộng rãi vì độ dài thật chưa được backend xác nhận — slug quan sát
 * được dài 10 ký tự (`b3644671ed`).
 */
const MAX_LENGTH = 64

/** Trả về slug nguyên văn, hoặc null nếu chuỗi chắc chắn không phải slug. */
export function parseScannedVoucher(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Có scheme → QR thuộc định dạng khác (wifi, danh thiếp, đường dẫn web…).
  if (URI_SCHEME_RE.test(trimmed)) return null

  // Slug không bao giờ chứa khoảng trắng hay xuống dòng.
  if (/\s/.test(trimmed)) return null

  if (trimmed.length > MAX_LENGTH) return null

  // Giữ nguyên hoa thường — slug phân biệt hoa thường.
  return trimmed
}
