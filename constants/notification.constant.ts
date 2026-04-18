export enum TOKEN_CHECK_INTERVAL {
  INTERVAL = 1000 * 60 * 60 * 24, // 24 hours
}
export enum TOKEN_REFRESH_THRESHOLD {
  THRESHOLD = 1000 * 60 * 60 * 48, // 48 hours
}

export enum NotificationMessageCode {
  ORDER_NEEDS_PROCESSED = 'order-needs-processed',
  ORDER_NEEDS_DELIVERED = 'order-needs-delivered',
  ORDER_NEEDS_CANCELLED = 'order-needs-cancelled',
  ORDER_NEEDS_READY_TO_GET = 'order-needs-ready-to-get',
  ORDER_BILL_FAILED_PRINTING = 'order-bill-failed-printing',
  ORDER_CHEF_ORDER_FAILED_PRINTING = 'order-chef-order-failed-printing',
  ORDER_LABEL_TICKET_FAILED_PRINTING = 'order-label-ticket-failed-printing',
  ORDER_PAID = 'order-paid',
  CARD_ORDER_PAID = 'card-order-paid',
}

export enum MAX_RETRIES {
  MAX_RETRIES = 3,
}

export enum RETRY_DELAYS {
  RETRY_DELAY_1 = 1000,
  RETRY_DELAY_2 = 5000,
  RETRY_DELAY_3 = 15000,
}

export enum PrinterEventType {
  LABEL_TICKET = 'label-ticket',
  INVOICE = 'invoice',
  CHEF_ORDER = 'chef-order',
}
