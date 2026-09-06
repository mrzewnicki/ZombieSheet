import type { MusicChannel } from '@/types'
import { MUSIC_CHANNELS } from '@/utils/musicPlayback'

export type LocalChannelVolumes = Record<MusicChannel, number> & {
  /** Overall device gain applied on top of per-channel volumes. */
  master: number
  /** When true, output is silent but preferred levels stay stored. */
  muted: boolean
}

const DEFAULT_LOCAL: LocalChannelVolumes = {
  master: 1,
  muted: false,
  ambient: 1,
  music: 1,
  effects: 1,
}

/** User-scoped browser prefs (shared across games on this device). */
function storageKey(uid: string): string {
  return `musicLocalVol_v2_${uid}`
}

/** Legacy per-game key — still read once for migration. */
function legacyStorageKey(gameId: string, uid: string): string {
  return `musicLocalVol_${gameId}_${uid}`
}

function clamp(value: unknown, fallback = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

function parseVolumes(raw: string | null): LocalChannelVolumes | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next = { ...DEFAULT_LOCAL }
    next.master = clamp(parsed.master, DEFAULT_LOCAL.master)
    next.muted = parsed.muted === true
      || (parsed.muted == null && next.master <= 0.001)
    // If an older mute wrote master to 0, treat as muted at full preferred level.
    if (next.muted && next.master <= 0.001) next.master = 1
    for (const channel of MUSIC_CHANNELS) {
      next[channel] = clamp(parsed[channel], DEFAULT_LOCAL[channel])
    }
    return next
  } catch {
    return null
  }
}

export function loadLocalChannelVolumes(gameId: string, uid: string): LocalChannelVolumes {
  if (!uid) return { ...DEFAULT_LOCAL }
  try {
    const current = parseVolumes(localStorage.getItem(storageKey(uid)))
    if (current) return current

    if (gameId) {
      const legacy = parseVolumes(localStorage.getItem(legacyStorageKey(gameId, uid)))
      if (legacy) {
        saveLocalChannelVolumes(gameId, uid, legacy)
        return legacy
      }
    }
    return { ...DEFAULT_LOCAL }
  } catch {
    return { ...DEFAULT_LOCAL }
  }
}

export function saveLocalChannelVolumes(
  gameId: string,
  uid: string,
  volumes: LocalChannelVolumes,
): void {
  if (!uid) return
  try {
    const payload: LocalChannelVolumes = {
      master: clamp(volumes.master),
      muted: volumes.muted === true,
      ambient: clamp(volumes.ambient),
      music: clamp(volumes.music),
      effects: clamp(volumes.effects),
    }
    const serialized = JSON.stringify(payload)
    localStorage.setItem(storageKey(uid), serialized)
    if (gameId) {
      localStorage.setItem(legacyStorageKey(gameId, uid), serialized)
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function effectiveLocalVolume(volumes: LocalChannelVolumes, channel: MusicChannel): number {
  if (volumes.muted) return 0
  return Math.min(1, Math.max(0, volumes.master * volumes[channel]))
}
