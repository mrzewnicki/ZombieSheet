import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getDownloadURL, ref } from 'firebase/storage'
import { db, storage } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useGameRole } from '@/hooks/useGameRole'
import type {
  MusicChannel,
  MusicPlaybackState,
  MusicPlaylist,
  MusicTrack,
} from '@/types'
import {
  loadLocalChannelVolumes,
  saveLocalChannelVolumes,
  type LocalChannelVolumes,
} from '@/utils/musicLocalPrefs'
import {
  DEFAULT_LOUDNESS_TARGET,
  MUSIC_CHANNELS,
  MUSIC_CHANNELS_COLLECTION,
  MUSIC_PLAYBACK_COLLECTION,
  MUSIC_PLAYLISTS_COLLECTION,
  MUSIC_PRESENCE_COLLECTION,
  MUSIC_TRACKS_COLLECTION,
  computePositionMs,
  idlePlaybackState,
  loudnessMatchGain,
  musicPlaybackPayload,
  nextPlaylistIndex,
  normalizeChannelLoudnessTarget,
  normalizeMusicPlaybackState,
  normalizeMusicPlaylist,
  normalizeMusicTrack,
} from '@/utils/musicPlayback'
import { storageUrlForFetch } from '@/utils/musicWaveform'

const PRESENCE_MS = 25_000
const urlCache = new Map<string, string>()

interface ChannelPlayer {
  audio: HTMLAudioElement
  boundTrackId: string | null
}

interface MusicSyncContextValue {
  tracks: MusicTrack[]
  playlists: MusicPlaylist[]
  playback: Record<MusicChannel, MusicPlaybackState>
  /** Per-channel RMS target (0 = matching off). */
  loudnessTargets: Record<MusicChannel, number>
  localVolumes: LocalChannelVolumes
  setLocalVolume: (channel: MusicChannel, value: number) => void
  isGm: boolean
  loading: boolean
}

const MusicSyncContext = createContext<MusicSyncContextValue | null>(null)

export function useMusicSync(): MusicSyncContextValue {
  const ctx = useContext(MusicSyncContext)
  if (!ctx) {
    throw new Error('useMusicSync must be used within MusicSyncProvider')
  }
  return ctx
}

function applyVolume(
  player: ChannelPlayer,
  trackVolume: number,
  localVolume: number,
  matchGain: number,
) {
  const vol = Math.max(0, Math.min(1, trackVolume * localVolume * matchGain))
  player.audio.volume = vol
}

function matchGainFor(
  channel: MusicChannel,
  state: MusicPlaybackState,
  tracks: MusicTrack[],
  loudnessTargets: Record<MusicChannel, number>,
): number {
  const track = tracks.find((t) => t.id === state.trackId)
  return loudnessMatchGain(loudnessTargets[channel] ?? 0, track?.loudnessRms)
}

async function resolveUrl(storagePath: string): Promise<string> {
  const cached = urlCache.get(storagePath)
  if (cached) return cached
  const url = await getDownloadURL(ref(storage, storagePath))
  const playable = storageUrlForFetch(url)
  urlCache.set(storagePath, playable)
  return playable
}

function createPlayer(): ChannelPlayer {
  const audio = new Audio()
  audio.preload = 'auto'
  return { audio, boundTrackId: null }
}

export default function MusicSyncProvider({
  gameId,
  children,
}: {
  gameId: string
  children: ReactNode
}) {
  const { user } = useAuth()
  const { role } = useGameRole(gameId)
  const isGm = role === 'gm'

  const [tracks, setTracks] = useState<MusicTrack[]>([])
  const [playlists, setPlaylists] = useState<MusicPlaylist[]>([])
  const [playback, setPlayback] = useState<Record<MusicChannel, MusicPlaybackState>>(() => ({
    ambient: idlePlaybackState('ambient'),
    music: idlePlaybackState('music'),
    effects: idlePlaybackState('effects'),
  }))
  const [loudnessTargets, setLoudnessTargets] = useState<Record<MusicChannel, number>>(() => ({
    ambient: DEFAULT_LOUDNESS_TARGET,
    music: DEFAULT_LOUDNESS_TARGET,
    effects: DEFAULT_LOUDNESS_TARGET,
  }))
  const [localVolumes, setLocalVolumes] = useState<LocalChannelVolumes>(() =>
    loadLocalChannelVolumes(gameId, user?.uid ?? ''),
  )
  const [loading, setLoading] = useState(true)

  const playersRef = useRef<Partial<Record<MusicChannel, ChannelPlayer>>>({})
  const playbackRef = useRef(playback)
  const tracksRef = useRef(tracks)
  const playlistsRef = useRef(playlists)
  const localVolRef = useRef(localVolumes)
  const loudnessRef = useRef(loudnessTargets)
  const advancingRef = useRef<Partial<Record<MusicChannel, boolean>>>({})

  playbackRef.current = playback
  tracksRef.current = tracks
  playlistsRef.current = playlists
  localVolRef.current = localVolumes
  loudnessRef.current = loudnessTargets

  useEffect(() => {
    if (!user) return
    setLocalVolumes(loadLocalChannelVolumes(gameId, user.uid))
  }, [gameId, user])

  const ensurePlayer = useCallback((channel: MusicChannel): ChannelPlayer => {
    let player = playersRef.current[channel]
    if (!player) {
      player = createPlayer()
      playersRef.current[channel] = player
    }
    return player
  }, [])

  const setLocalVolume = useCallback((channel: MusicChannel, value: number) => {
    setLocalVolumes((prev) => {
      const next = { ...prev, [channel]: Math.min(1, Math.max(0, value)) }
      if (user) saveLocalChannelVolumes(gameId, user.uid, next)
      const player = playersRef.current[channel]
      if (player) {
        const state = playbackRef.current[channel]
        applyVolume(
          player,
          state.trackVolume,
          next[channel],
          matchGainFor(channel, state, tracksRef.current, loudnessRef.current),
        )
      }
      return next
    })
  }, [gameId, user])

  // Presence heartbeat
  useEffect(() => {
    if (!user || !gameId) return
    const uid = user.uid
    const displayName = user.displayName ?? ''
    const presenceRef = doc(db, 'games', gameId, MUSIC_PRESENCE_COLLECTION, uid)

    async function beat() {
      try {
        await setDoc(presenceRef, {
          lastSeen: serverTimestamp(),
          displayName,
        }, { merge: true })
      } catch {
        /* ignore */
      }
    }

    void beat()
    const timer = window.setInterval(() => void beat(), PRESENCE_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [gameId, user])

  // Catalog listeners
  useEffect(() => {
    if (!gameId) return
    setLoading(true)
    let tracksReady = false
    let playlistsReady = false
    const maybeDone = () => {
      if (tracksReady && playlistsReady) setLoading(false)
    }

    const unsubTracks = onSnapshot(
      collection(db, 'games', gameId, MUSIC_TRACKS_COLLECTION),
      (snap) => {
        const next = snap.docs
          .map((d) => normalizeMusicTrack(d.id, d.data() as Record<string, unknown>))
          .filter((t): t is MusicTrack => t != null)
          .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
        setTracks(next)
        tracksReady = true
        maybeDone()
      },
      () => {
        tracksReady = true
        maybeDone()
      },
    )
    const unsubPlaylists = onSnapshot(
      collection(db, 'games', gameId, MUSIC_PLAYLISTS_COLLECTION),
      (snap) => {
        const next = snap.docs
          .map((d) => normalizeMusicPlaylist(d.id, d.data() as Record<string, unknown>))
          .filter((p): p is MusicPlaylist => p != null)
          .sort((a, b) => a.name.localeCompare(b.name, 'pl'))
        setPlaylists(next)
        playlistsReady = true
        maybeDone()
      },
      () => {
        playlistsReady = true
        maybeDone()
      },
    )

    const unsubsPlayback = MUSIC_CHANNELS.map((channel) =>
      onSnapshot(
        doc(db, 'games', gameId, MUSIC_PLAYBACK_COLLECTION, channel),
        (snap) => {
          const next = normalizeMusicPlaybackState(
            channel,
            snap.exists() ? (snap.data() as Record<string, unknown>) : null,
          )
          setPlayback((prev) => ({ ...prev, [channel]: next }))
        },
      )
    )

    const unsubsLoudness = MUSIC_CHANNELS.map((channel) =>
      onSnapshot(
        doc(db, 'games', gameId, MUSIC_CHANNELS_COLLECTION, channel),
        (snap) => {
          const target = snap.exists()
            ? normalizeChannelLoudnessTarget(snap.data() as Record<string, unknown>)
            : DEFAULT_LOUDNESS_TARGET
          setLoudnessTargets((prev) => ({ ...prev, [channel]: target }))
          const player = playersRef.current[channel]
          if (player) {
            const state = playbackRef.current[channel]
            const nextTargets = { ...loudnessRef.current, [channel]: target }
            applyVolume(
              player,
              state.trackVolume,
              localVolRef.current[channel],
              matchGainFor(channel, state, tracksRef.current, nextTargets),
            )
          }
        },
      )
    )

    return () => {
      unsubTracks()
      unsubPlaylists()
      unsubsPlayback.forEach((u) => u())
      unsubsLoudness.forEach((u) => u())
    }
  }, [gameId])

  const advancePlaylist = useCallback(async (channel: MusicChannel) => {
    if (!isGm || !user) return
    if (advancingRef.current[channel]) return
    const state = playbackRef.current[channel]
    if (state.source !== 'playlist' || !state.playlistId) return
    const playlist = playlistsRef.current.find((p) => p.id === state.playlistId)
    if (!playlist) return

    if (state.loopMode === 'track') return

    const index = state.playlistIndex ?? 0
    const nextIndex = nextPlaylistIndex(playlist.trackIds, index, state.loopMode)
    advancingRef.current[channel] = true
    try {
      if (nextIndex == null) {
        await setDoc(
          doc(db, 'games', gameId, MUSIC_PLAYBACK_COLLECTION, channel),
          {
            ...musicPlaybackPayload({
              ...state,
              status: 'idle',
              positionMs: 0,
              startedAt: null,
            }, user.uid),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        )
        return
      }
      const nextTrackId = playlist.trackIds[nextIndex]
      await setDoc(
        doc(db, 'games', gameId, MUSIC_PLAYBACK_COLLECTION, channel),
        {
          ...musicPlaybackPayload({
            ...state,
            status: 'playing',
            trackId: nextTrackId,
            playlistIndex: nextIndex,
            positionMs: 0,
            startedAt: null,
          }, user.uid),
          startedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } finally {
      advancingRef.current[channel] = false
    }
  }, [gameId, isGm, user])

  // Apply playback state to audio players
  useEffect(() => {
    let cancelled = false

    async function syncChannel(channel: MusicChannel) {
      const state = playback[channel]
      const player = ensurePlayer(channel)
      const match = matchGainFor(channel, state, tracksRef.current, loudnessRef.current)
      applyVolume(player, state.trackVolume, localVolRef.current[channel], match)

      if (state.status === 'idle' || !state.trackId) {
        player.audio.pause()
        player.audio.removeAttribute('src')
        player.boundTrackId = null
        return
      }

      const track = tracksRef.current.find((t) => t.id === state.trackId)
      if (!track) return

      try {
        if (player.boundTrackId !== track.id) {
          const url = await resolveUrl(track.storagePath)
          if (cancelled) return
          player.audio.removeAttribute('crossorigin')
          player.audio.src = url
          player.boundTrackId = track.id
          await new Promise<void>((resolve) => {
            const onReady = () => {
              player.audio.removeEventListener('loadedmetadata', onReady)
              player.audio.removeEventListener('error', onReady)
              resolve()
            }
            player.audio.addEventListener('loadedmetadata', onReady)
            player.audio.addEventListener('error', onReady)
            player.audio.load()
          })
          if (cancelled) return
        }

        player.audio.loop = state.loopMode === 'track'
        applyVolume(
          player,
          state.trackVolume,
          localVolRef.current[channel],
          matchGainFor(channel, state, tracksRef.current, loudnessRef.current),
        )

        const targetSec = computePositionMs(state) / 1000
        if (Number.isFinite(targetSec)) {
          const drift = Math.abs((player.audio.currentTime || 0) - targetSec)
          if (drift > 0.75 || player.audio.paused) {
            try {
              player.audio.currentTime = targetSec
            } catch {
              /* ignore seek errors while loading */
            }
          }
        }

        if (state.status === 'playing') {
          try {
            await player.audio.play()
          } catch {
            /* autoplay may be blocked until user gesture */
          }
        } else {
          player.audio.pause()
        }
      } catch {
        /* network / decode */
      }
    }

    for (const channel of MUSIC_CHANNELS) {
      void syncChannel(channel)
    }

    return () => {
      cancelled = true
    }
  }, [playback, ensurePlayer, loudnessTargets, localVolumes, tracks])

  // ended → conductor advance (GM only)
  useEffect(() => {
    const cleanups: Array<() => void> = []
    for (const channel of MUSIC_CHANNELS) {
      const player = ensurePlayer(channel)
      const onEnded = () => {
        const state = playbackRef.current[channel]
        if (state.loopMode === 'track') return
        if (isGm) void advancePlaylist(channel)
      }
      player.audio.addEventListener('ended', onEnded)
      cleanups.push(() => player.audio.removeEventListener('ended', onEnded))
    }
    return () => cleanups.forEach((fn) => fn())
  }, [advancePlaylist, ensurePlayer, isGm])

  // Visibility resync
  useEffect(() => {
    function onVis() {
      if (document.visibilityState !== 'visible') return
      setPlayback((prev) => ({ ...prev }))
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Dispose on unmount
  useEffect(() => {
    return () => {
      for (const channel of MUSIC_CHANNELS) {
        const player = playersRef.current[channel]
        if (!player) continue
        player.audio.pause()
        player.audio.removeAttribute('src')
      }
      playersRef.current = {}
    }
  }, [])

  // Prefetch next playlist track URL
  useEffect(() => {
    for (const channel of MUSIC_CHANNELS) {
      const state = playback[channel]
      if (state.source !== 'playlist' || !state.playlistId) continue
      const playlist = playlists.find((p) => p.id === state.playlistId)
      if (!playlist) continue
      const index = state.playlistIndex ?? 0
      const nextId = playlist.trackIds[index + 1] ?? (
        state.loopMode === 'playlist' ? playlist.trackIds[0] : undefined
      )
      if (!nextId || nextId === state.trackId) continue
      const track = tracks.find((t) => t.id === nextId)
      if (track) void resolveUrl(track.storagePath)
    }
  }, [playback, playlists, tracks])

  const value = useMemo<MusicSyncContextValue>(() => ({
    tracks,
    playlists,
    playback,
    loudnessTargets,
    localVolumes,
    setLocalVolume,
    isGm,
    loading,
  }), [tracks, playlists, playback, loudnessTargets, localVolumes, setLocalVolume, isGm, loading])

  return (
    <MusicSyncContext.Provider value={value}>
      {children}
    </MusicSyncContext.Provider>
  )
}
