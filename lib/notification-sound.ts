/**
 * Shared cache for the foreground notification sound (notification.mp3).
 *
 * Design:
 * - Singleton Audio.Sound instance — created once, reused for every shot.
 * - In-flight playback counter prevents unloadAsync() during playAsync().
 * - preloadNotificationSound() can be called at app startup to eliminate
 *   first-shot load latency (100-300ms on cold start).
 * - disposeNotificationSound() waits for active playbacks to finish before
 *   unloading, so logout / unmount never races a sound shot.
 */
import { Audio, type AVPlaybackSource } from 'expo-av'

const SOUND_VOLUME = 0.5

let cachedSound: Audio.Sound | null = null
let loadPromise: Promise<Audio.Sound> | null = null
let activePlaybacks = 0
let pendingDispose = false

async function getSound(): Promise<Audio.Sound> {
  if (cachedSound) return cachedSound
  if (!loadPromise) {
    loadPromise = Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/assets/sound/notification.mp3') as AVPlaybackSource,
    )
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

/** Fire-and-forget preload — call once at app startup. */
export function preloadNotificationSound(): void {
  getSound().catch((e) => {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound preload failed:', e)
  })
}

export async function playNotificationSound(): Promise<void> {
  // Refuse to play during teardown — otherwise we might increment the counter
  // *after* dispose started waiting, blocking shutdown.
  if (pendingDispose) return
  activePlaybacks++
  try {
    const sound = await getSound()
    await sound.setPositionAsync(0)
    await sound.setVolumeAsync(SOUND_VOLUME)
    await sound.playAsync()
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[Audio] Notification sound playback failed:', e)
  } finally {
    activePlaybacks--
  }
}

/**
 * Unload the cached sound. Waits up to 1500ms for in-flight playbacks to
 * finish so we never unload while playAsync() is mid-flight. Caller should
 * await this if it cares about completion (logout flow).
 */
export async function disposeNotificationSound(): Promise<void> {
  pendingDispose = true
  const deadline = Date.now() + 1500
  while (activePlaybacks > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50))
  }
  const s = cachedSound
  cachedSound = null
  pendingDispose = false
  if (s) await s.unloadAsync().catch(() => {})
}
