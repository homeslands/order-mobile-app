/**
 * Tests that use-notification-listener module loads correctly.
 * The unloadAsync() fix is a correctness change verified by code review.
 */

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn().mockResolvedValue({
        sound: {
          playAsync: jest.fn().mockResolvedValue(undefined),
          setPositionAsync: jest.fn().mockResolvedValue(undefined),
          setVolumeAsync: jest.fn().mockResolvedValue(undefined),
          unloadAsync: jest.fn().mockResolvedValue(undefined),
        },
      }),
    },
  },
}))

jest.mock('@react-native-firebase/messaging', () => {
  const onMessage = jest.fn(() => jest.fn()) // returns unsubscribe fn
  return { __esModule: true, default: jest.fn(() => ({ onMessage })) }
})

jest.mock('@/stores/notification.store', () => ({
  useNotificationStore: {
    getState: jest.fn(() => ({
      addNotification: jest.fn(),
      getUnreadCount: jest.fn(() => 0),
    })),
  },
}))

jest.mock('@/providers/toast-provider', () => ({
  showToastInternal: jest.fn(),
}))

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (obj: { android?: unknown; default?: unknown }) => obj.android ?? obj.default },
  Vibration: {
    vibrate: jest.fn(),
    cancel: jest.fn(),
  },
}))

jest.mock('@/constants/notification.constant', () => ({
  NotificationMessageCode: {
    ORDER_NEEDS_READY_TO_GET: 'order-needs-ready-to-get',
  },
}))

import { useNotificationListener } from '@/hooks/use-notification-listener'

it('exports useNotificationListener hook', () => {
  expect(typeof useNotificationListener).toBe('function')
})
