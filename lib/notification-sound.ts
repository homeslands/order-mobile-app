/**
 * Foreground notification sounds.
 *
 * Each sound is a singleton Audio.Sound — created once, reused per shot.
 * preload*() at app startup eliminates first-shot load latency (100-300ms).
 */
import { Audio, type AVPlaybackSource } from 'expo-av'

const SOUND_VOLUME = 0.5

function createSoundPlayer(source: AVPlaybackSource) {
  let cachedSound: Audio.Sound | null = null
  let loadPromise: Promise<Audio.Sound> | null = null
  let activePlaybacks = 0
  let pendingDispose = false

  async function getSound(): Promise<Audio.Sound> {
    if (cachedSound) return cachedSound
    if (!loadPromise) {
      loadPromise = Audio.Sound.createAsync(source)
        .then(({ sound }) => {
          cachedSound = sound
          return sound
        })
        .finally(() => {
          loadPromise = null
        })
    }
    return loadPromise
  }

  return {
    preload(): void {
      getSound().catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('[Audio] Sound preload failed:', e)
      })
    },

    async play(): Promise<void> {
      if (pendingDispose) return
      activePlaybacks++
      try {
        const sound = await getSound()
        await sound.setPositionAsync(0)
        await sound.setVolumeAsync(SOUND_VOLUME)
        await sound.playAsync()
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Audio] Sound playback failed:', e)
      } finally {
        activePlaybacks--
      }
    },

    async dispose(): Promise<void> {
      pendingDispose = true
      const deadline = Date.now() + 1500
      while (activePlaybacks > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50))
      }
      const s = cachedSound
      cachedSound = null
      pendingDispose = false
      if (s) await s.unloadAsync().catch(() => {})
    },
  }
}

const notificationPlayer = createSoundPlayer(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/assets/sound/notification.mp3') as AVPlaybackSource,
)

const orderReadyPlayer = createSoundPlayer(
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@/assets/sound/railway_ingle.mp3') as AVPlaybackSource,
)

export const preloadNotificationSound = () => notificationPlayer.preload()
export const playNotificationSound = () => notificationPlayer.play()
export const disposeNotificationSound = () => notificationPlayer.dispose()

export const preloadOrderReadySound = () => orderReadyPlayer.preload()
export const playOrderReadySound = () => orderReadyPlayer.play()
