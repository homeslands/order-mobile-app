/**
 * Captured at JS bundle load — used to discard notification responses that
 * belong to a previous app session (iOS getLastNotificationResponseAsync
 * returns the OS-cached response across sessions, causing "ghost" taps).
 */
export const APP_LAUNCH_TIME_MS = Date.now()

/** Margin to absorb FCM delivery + native -> JS bridge latency on cold start. */
export const COLD_START_RESPONSE_WINDOW_MS = 30_000

/**
 * Returns true if a notification response with `notificationDateMs` is recent
 * enough relative to this app's launch to be considered a real cold-start tap
 * (not a ghost response from a previous session).
 */
export function isResponseFromThisSession(
  notificationDateMs: number | undefined,
): boolean {
  if (notificationDateMs === undefined) return false
  // Accept if the notification was delivered up to COLD_START_RESPONSE_WINDOW_MS
  // *before* the JS bundle started — covers the gap between OS delivering the
  // tap and React/JS being ready to consume it.
  return notificationDateMs >= APP_LAUNCH_TIME_MS - COLD_START_RESPONSE_WINDOW_MS
}
