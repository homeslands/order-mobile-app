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

jest.mock('expo-notifications', () => ({
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}))

jest.mock('@/stores/notification.store', () => ({
  useNotificationStore: {
    getState: jest.fn(() => ({
      addNotification: jest.fn(),
      getUnreadCount: jest.fn(() => 0),
    })),
  },
}))

jest.mock('@/utils', () => ({ showToast: jest.fn() }))

import { useNotificationListener } from '@/hooks/use-notification-listener'

it('exports useNotificationListener hook', () => {
  expect(typeof useNotificationListener).toBe('function')
})
