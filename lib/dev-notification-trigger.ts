/**
 * Dev-only helper to simulate an ORDER_NEEDS_READY_TO_GET notification
 * arriving while the app is in foreground.
 *
 * Usage (Metro / Flipper console):
 *   global.__devTriggerOrderReady()
 *   global.__devTriggerOrderReady({ referenceNumber: 'TEST-001', branchName: 'Q1' })
 */
if (__DEV__) {
  const trigger = async (opts?: {
    referenceNumber?: string
    branchName?: string
    orderSlug?: string
  }) => {
    const { useNotificationStore } = await import(
      '@/stores/notification.store'
    )
    const { playOrderReadySound } = await import('@/lib/notification-sound')
    const { NotificationMessageCode } = await import(
      '@/constants/notification.constant'
    )

    const slug = `dev-order-ready-${Date.now()}`
    useNotificationStore.getState().addNotification(
      {
        notification: {
          title: 'Đơn của bạn đã sẵn sàng!',
          body: 'Vui lòng đến quầy để nhận đơn',
        },
        data: {
          slug,
          message: NotificationMessageCode.ORDER_NEEDS_READY_TO_GET,
          order: opts?.orderSlug ?? 'dev-order-slug',
          referenceNumber: opts?.referenceNumber ?? 'DEV-999',
          branchName: opts?.branchName ?? 'Chi nhánh Dev',
        },
        messageId: slug,
      },
      { markAsRead: false },
    )

    await playOrderReadySound()
  }

  ;(
    global as unknown as Record<string, unknown>
  ).__devTriggerOrderReady = trigger
}

export {}
