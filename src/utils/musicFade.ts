/** Linear fade-in duration after a long silence on a channel. */
export const MUSIC_FADE_IN_MS = 5_000

/**
 * If a channel had no active playback for at least this long, the next play
 * fades in instead of starting at full volume.
 */
export const MUSIC_SILENCE_BEFORE_FADE_MS = 5 * 60 * 1_000

/** True when the next play should fade in (never played, or silence long enough). */
export function shouldFadeInAfterSilence(
  lastActiveAt: number | null | undefined,
  now: number,
  silenceMs = MUSIC_SILENCE_BEFORE_FADE_MS,
): boolean {
  if (lastActiveAt == null) return true
  return now - lastActiveAt >= silenceMs
}

/** Linear 0→1 gain for a fade-in that started `elapsedMs` ago. */
export function fadeInGain(elapsedMs: number, durationMs = MUSIC_FADE_IN_MS): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  if (elapsedMs >= durationMs) return 1
  return elapsedMs / durationMs
}
