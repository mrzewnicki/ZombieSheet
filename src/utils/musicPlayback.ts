import type { Timestamp } from 'firebase/firestore'
import type {
  MusicChannel,
  MusicLoopMode,
  MusicPlaybackSource,
  MusicPlaybackState,
  MusicPlaybackStatus,
  MusicPlaylist,
  MusicTrack,
} from '@/types'
import { normalizeWaveformPeaks } from '@/utils/musicWaveform'

export const MUSIC_CHANNELS: MusicChannel[] = ['ambient', 'music', 'effects']

export const MUSIC_TRACKS_COLLECTION = 'musicTracks'
export const MUSIC_PLAYLISTS_COLLECTION = 'musicPlaylists'
export const MUSIC_PLAYBACK_COLLECTION = 'musicPlayback'
export const MUSIC_CHANNELS_COLLECTION = 'musicChannels'
export const MUSIC_PRESENCE_COLLECTION = 'musicPresence'

export const MUSIC_MAX_BYTES = 20 * 1024 * 1024
export const MUSIC_ALLOWED_MIME = [
  'audio/mpeg',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/aac',
] as const

export function musicTrackStoragePath(
  gameId: string,
  trackId: string,
  contentType: string,
): string {
  let ext = 'mp3'
  if (contentType === 'audio/webm') ext = 'webm'
  else if (
    contentType === 'audio/mp4'
    || contentType === 'audio/x-m4a'
    || contentType === 'audio/aac'
  ) {
    ext = 'm4a'
  }
  return `games/${gameId}/music/${trackId}.${ext}`
}

export function musicFileRejectReason(file: File): 'size' | 'format' | null {
  if (file.size > MUSIC_MAX_BYTES) return 'size'
  if ((MUSIC_ALLOWED_MIME as readonly string[]).includes(file.type)) return null
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.mp3') || lower.endsWith('.webm') || lower.endsWith('.m4a')) return null
  return 'format'
}

export function isAllowedMusicFile(file: File): boolean {
  return musicFileRejectReason(file) == null
}

export function resolveMusicContentType(file: File): string {
  const lower = file.name.toLowerCase()
  if (file.type === 'audio/webm' || lower.endsWith('.webm')) return 'audio/webm'
  if (
    file.type === 'audio/mp4'
    || file.type === 'audio/x-m4a'
    || file.type === 'audio/aac'
    || lower.endsWith('.m4a')
  ) {
    return 'audio/mp4'
  }
  return 'audio/mpeg'
}

export const DEFAULT_TRACK_VOLUME = 1
/** Default RMS target for loudness matching (~typical mastered level). */
export const DEFAULT_LOUDNESS_TARGET = 0.2
export const LOUDNESS_MATCH_MIN_GAIN = 0.15
export const LOUDNESS_MATCH_MAX_GAIN = 3

export function isMusicChannel(value: unknown): value is MusicChannel {
  return value === 'ambient' || value === 'music' || value === 'effects'
}

export function isMusicLoopMode(value: unknown): value is MusicLoopMode {
  return value === 'off' || value === 'track' || value === 'playlist'
}

export function clampTrackVolume(value: unknown, fallback = DEFAULT_TRACK_VOLUME): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

export function clampLoudnessTarget(value: unknown, fallback = DEFAULT_LOUDNESS_TARGET): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(1, Math.max(0, value))
}

export function clampLoudnessRms(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined
  return Math.min(1, Math.max(0.0001, value))
}

/** Gain so track RMS moves toward target. target ≤ 0 → matching off. */
export function loudnessMatchGain(
  target: number,
  trackRms: number | undefined,
): number {
  if (!(target > 0)) return 1
  if (!(trackRms && trackRms > 0.0001)) return 1
  const raw = target / trackRms
  return Math.min(LOUDNESS_MATCH_MAX_GAIN, Math.max(LOUDNESS_MATCH_MIN_GAIN, raw))
}

export function normalizeChannelLoudnessTarget(raw: unknown): number {
  if (raw && typeof raw === 'object' && 'loudnessTarget' in raw) {
    return clampLoudnessTarget((raw as { loudnessTarget: unknown }).loudnessTarget)
  }
  if (typeof raw === 'number') return clampLoudnessTarget(raw)
  return DEFAULT_LOUDNESS_TARGET
}

export function idlePlaybackState(channel: MusicChannel): MusicPlaybackState {
  return {
    channel,
    status: 'idle',
    source: 'track',
    trackId: '',
    loopMode: 'off',
    trackVolume: DEFAULT_TRACK_VOLUME,
    positionMs: 0,
    startedAt: null,
  }
}

function asStatus(value: unknown): MusicPlaybackStatus {
  if (value === 'playing' || value === 'paused' || value === 'idle') return value
  return 'idle'
}

function asSource(value: unknown): MusicPlaybackSource {
  return value === 'playlist' ? 'playlist' : 'track'
}

function asTimestamp(value: unknown): Timestamp | null {
  if (
    value
    && typeof value === 'object'
    && 'toMillis' in value
    && typeof (value as Timestamp).toMillis === 'function'
  ) {
    return value as Timestamp
  }
  return null
}

export function normalizeMusicPlaybackState(
  channel: MusicChannel,
  raw: Record<string, unknown> | null | undefined,
): MusicPlaybackState {
  if (!raw) return idlePlaybackState(channel)
  const trackId = typeof raw.trackId === 'string' ? raw.trackId : ''
  const status = asStatus(raw.status)
  const positionMs =
    typeof raw.positionMs === 'number' && Number.isFinite(raw.positionMs)
      ? Math.max(0, Math.trunc(raw.positionMs))
      : 0

  return {
    channel,
    status: trackId ? status : 'idle',
    source: asSource(raw.source),
    trackId,
    playlistId: typeof raw.playlistId === 'string' ? raw.playlistId : undefined,
    playlistIndex:
      typeof raw.playlistIndex === 'number' && Number.isFinite(raw.playlistIndex)
        ? Math.max(0, Math.trunc(raw.playlistIndex))
        : undefined,
    loopMode: isMusicLoopMode(raw.loopMode) ? raw.loopMode : 'off',
    trackVolume: clampTrackVolume(raw.trackVolume),
    positionMs,
    startedAt: asTimestamp(raw.startedAt),
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  }
}

/** Current playback position in ms based on status + startedAt. */
export function computePositionMs(
  state: Pick<MusicPlaybackState, 'status' | 'positionMs' | 'startedAt'>,
  nowMs: number = Date.now(),
): number {
  if (state.status !== 'playing') return Math.max(0, state.positionMs)
  const started = state.startedAt?.toMillis?.()
  if (typeof started !== 'number') return Math.max(0, state.positionMs)
  return Math.max(0, state.positionMs + (nowMs - started))
}

export function normalizeTrackLoopMode(value: unknown): Exclude<MusicLoopMode, 'playlist'> {
  return value === 'track' ? 'track' : 'off'
}

export function normalizePlaylistLoopMode(value: unknown): Exclude<MusicLoopMode, 'track'> {
  return value === 'playlist' ? 'playlist' : 'off'
}

export function musicTrackPayload(
  track: Omit<MusicTrack, 'id' | 'createdAt'>,
): Omit<MusicTrack, 'id' | 'createdAt'> {
  return {
    name: track.name.trim(),
    storagePath: track.storagePath,
    contentType: track.contentType,
    sizeBytes: Math.max(0, Math.trunc(track.sizeBytes)),
    ...(typeof track.durationMs === 'number' ? { durationMs: Math.max(0, Math.trunc(track.durationMs)) } : {}),
    ...(track.waveformPeaks && track.waveformPeaks.length >= 2
      ? { waveformPeaks: track.waveformPeaks }
      : {}),
    ...(typeof track.loudnessRms === 'number' ? { loudnessRms: clampLoudnessRms(track.loudnessRms) } : {}),
    loopMode: normalizeTrackLoopMode(track.loopMode),
    createdBy: track.createdBy,
  }
}

export function musicPlaylistPayload(
  playlist: Omit<MusicPlaylist, 'id' | 'createdAt'>,
): Omit<MusicPlaylist, 'id' | 'createdAt'> {
  return {
    name: playlist.name.trim(),
    trackIds: playlist.trackIds.filter((id) => typeof id === 'string' && id.length > 0),
    loopMode: normalizePlaylistLoopMode(playlist.loopMode),
    createdBy: playlist.createdBy,
  }
}

export function musicPlaybackPayload(
  state: MusicPlaybackState,
  updatedBy: string,
): Record<string, unknown> {
  return {
    status: state.status,
    source: state.source,
    trackId: state.trackId,
    playlistId: state.playlistId ?? null,
    playlistIndex: state.playlistIndex ?? null,
    loopMode: state.loopMode,
    trackVolume: clampTrackVolume(state.trackVolume),
    positionMs: Math.max(0, Math.trunc(state.positionMs)),
    startedAt: state.startedAt ?? null,
    updatedBy,
  }
}

export function musicChannelSettingsPayload(
  loudnessTarget: number,
  updatedBy: string,
): Record<string, unknown> {
  return {
    loudnessTarget: clampLoudnessTarget(loudnessTarget),
    updatedBy,
  }
}

export function normalizeMusicTrack(
  id: string,
  raw: Record<string, unknown>,
): MusicTrack | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const storagePath = typeof raw.storagePath === 'string' ? raw.storagePath : ''
  const contentType = typeof raw.contentType === 'string' ? raw.contentType : ''
  if (!storagePath) return null
  return {
    id,
    name: name || id,
    storagePath,
    contentType,
    sizeBytes: typeof raw.sizeBytes === 'number' ? Math.max(0, Math.trunc(raw.sizeBytes)) : 0,
    durationMs:
      typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs)
        ? Math.max(0, Math.trunc(raw.durationMs))
        : undefined,
    waveformPeaks: normalizeWaveformPeaks(raw.waveformPeaks),
    loudnessRms: clampLoudnessRms(raw.loudnessRms),
    loopMode: normalizeTrackLoopMode(raw.loopMode),
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    createdAt: asTimestamp(raw.createdAt) ?? undefined,
  }
}

export function normalizeMusicPlaylist(
  id: string,
  raw: Record<string, unknown>,
): MusicPlaylist | null {
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const trackIds = Array.isArray(raw.trackIds)
    ? raw.trackIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : []
  return {
    id,
    name: name || id,
    trackIds,
    loopMode: normalizePlaylistLoopMode(raw.loopMode),
    createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : '',
    createdAt: asTimestamp(raw.createdAt) ?? undefined,
  }
}

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

/** Manual prev/next within a playlist (wraps). */
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

export function formatDurationMs(ms: number | undefined): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) return '—'
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
