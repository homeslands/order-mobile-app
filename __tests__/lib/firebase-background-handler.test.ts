import * as Notifications from 'expo-notifications'

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: () => ({ setBackgroundMessageHandler: jest.fn() }),
}))

jest.mock('expo-notifications', () => ({
  getBadgeCountAsync: jest.fn(),
  setBadgeCountAsync: jest.fn().mockResolvedValue(undefined),
}))

// Import after mocks — triggers module-level setBackgroundMessageHandler call
import { incrementBadgeForBackgroundMessage } from '../../lib/firebase-background-handler'

describe('incrementBadgeForBackgroundMessage', () => {
  beforeEach(() => jest.clearAllMocks())

  it('sets badge to current + 1', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(2)
    await incrementBadgeForBackgroundMessage()
    expect(Notifications.getBadgeCountAsync).toHaveBeenCalledTimes(1)
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(3)
  })

  it('sets badge to 1 when current is 0', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(0)
    await incrementBadgeForBackgroundMessage()
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(1)
  })

  it('does not throw when getBadgeCountAsync fails', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockRejectedValue(
      new Error('badge unavailable'),
    )
    await expect(incrementBadgeForBackgroundMessage()).resolves.toBeUndefined()
    expect(Notifications.setBadgeCountAsync).not.toHaveBeenCalled()
  })

  it('does not throw when setBadgeCountAsync fails', async () => {
    ;(Notifications.getBadgeCountAsync as jest.Mock).mockResolvedValue(1)
    ;(Notifications.setBadgeCountAsync as jest.Mock).mockRejectedValue(
      new Error('bridge error'),
    )
    await expect(incrementBadgeForBackgroundMessage()).resolves.toBeUndefined()
  })
})
