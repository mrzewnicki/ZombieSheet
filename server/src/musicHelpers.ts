/**
 * Pure helpers shared between GameRoom and auth layer.
 * Mirror of relevant logic from src/utils/musicPlayback.ts — no Firebase deps.
 */

import type { ChannelState, MusicChannel, MusicLoopMode } from './protocol.js'

export const MUSIC_CHANNELS: MusicChannel[] = ['ambient', 'music', 'effects']

export function idleChannelState(channel: MusicChannel): ChannelState {
  return {
    channel,
    status: 'idle',
    source: 'track',
    trackId: '',
    loopMode: 'off',
    trackVolume: 1,
    positionMs: 0,
    startedAtMs: null,
  }
}

/**
 * Compute live position in ms based on server state.
 * Mirrors src/utils/musicPlayback.ts computePositionMs.
 */
export function computePositionMs(
  state: Pick<ChannelState, 'status' | 'positionMs' | 'startedAtMs' | 'loopMode' | 'durationMs'>,
  nowMs = Date.now(),
): number {
  if (state.status !== 'playing' || state.startedAtMs == null) {
    return Math.max(0, state.positionMs)
  }
  const raw = Math.max(0, state.positionMs + (nowMs - state.startedAtMs))
  const dur = state.durationMs
  if (!(typeof dur === 'number' && dur > 0)) return raw
  if (state.loopMode === 'track') return raw % dur
  if (raw >= dur) return 0
  return raw
}

/**
 * Advance playlist index. Returns null when there is no next track.
 * Mirrors src/utils/musicPlayback.ts nextPlaylistIndex.
 */
export function nextPlaylistIndex(
  trackIds: string[],
  currentIndex: number,
  loopMode: MusicLoopMode,
): number | null {
  if (trackIds.length === 0) return null
  const next = currentIndex + 1
  if (next < trackIds.length) return next
  if (loopMode === 'playlist') return 0
  return null
}

/**
 * Step playlist index by delta (-1 | 1), wrapping.
 * Mirrors src/utils/musicPlayback.ts stepPlaylistIndex.
 */
export function stepPlaylistIndex(
  trackIds: string[],
  currentIndex: number,
  delta: -1 | 1,
): number | null {
  if (trackIds.length === 0) return null
  const len = trackIds.length
  const safe = ((currentIndex % len) + len) % len
  return (safe + delta + len) % len
}

export function clampVolume(v: unknown, fallback = 1): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(1, Math.max(0, v))
}
