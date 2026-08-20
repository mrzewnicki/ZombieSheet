import type { MusicChannel } from '@/types'
import { MUSIC_CHANNELS } from '@/utils/musicPlayback'

export type LocalChannelVolumes = Record<MusicChannel, number>

const DEFAULT_LOCAL: LocalChannelVolumes = {
  ambient: 1,
  music: 1,
  effects: 1,
}

function storageKey(gameId: string, uid: string): string {
  return `musicLocalVol_${gameId}_${uid}`
}

function clamp(value: unknown, fallback = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

export function loadLocalChannelVolumes(gameId: string, uid: string): LocalChannelVolumes {
  if (!gameId || !uid) return { ...DEFAULT_LOCAL }
  try {
    const raw = localStorage.getItem(storageKey(gameId, uid))
    if (!raw) return { ...DEFAULT_LOCAL }
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = { ...DEFAULT_LOCAL }
    for (const channel of MUSIC_CHANNELS) {
      next[channel] = clamp(parsed[channel], DEFAULT_LOCAL[channel])
    }
    return next
  } catch {
    return { ...DEFAULT_LOCAL }
  }
}

export function saveLocalChannelVolumes(
  gameId: string,
  uid: string,
  volumes: LocalChannelVolumes,
): void {
  if (!gameId || !uid) return
  try {
    const payload: LocalChannelVolumes = {
      ambient: clamp(volumes.ambient),
      music: clamp(volumes.music),
      effects: clamp(volumes.effects),
    }
    localStorage.setItem(storageKey(gameId, uid), JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}
