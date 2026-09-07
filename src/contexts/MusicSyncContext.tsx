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
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Timestamp,
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
  effectiveLocalVolume,
  type LocalChannelVolumes,
} from '@/utils/musicLocalPrefs'
import {
  fadeInGain,
  shouldFadeInAfterSilence,
} from '@/utils/musicFade'
import {
  DEFAULT_LOUDNESS_TARGET,
  MUSIC_CHANNELS,
  MUSIC_CHANNELS_COLLECTION,
  MUSIC_PLAYBACK_COLLECTION,
  MUSIC_PLAYLISTS_COLLECTION,
  MUSIC_PRESENCE_COLLECTION,
  MUSIC_TRACKS_COLLECTION,
  PRESENCE_ONLINE_MS,
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
import { FEATURES } from '@/config/features'
import { MusicSyncClient } from '@/utils/musicSyncClient'
import type { SyncChannelState, SyncCmdAction, SyncCmdPayload, SyncMusicChannel } from '@/types/musicSync'

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
  setLocalMasterVolume: (value: number) => void
  setLocalMuted: (muted: boolean) => void
  /** True when session audio needs a user gesture before browsers will play. */
  needsAudioUnlock: boolean
  /** Call from a click/tap to unlock autoplay and resume playing channels. */
  unlockAudio: () => Promise<void>
  /** Live playhead for UI — prefers the local audio element when bound. */
  getChannelPositionMs: (channel: MusicChannel) => number
  /**
   * Send a playback command to the sync backend (workers mode only).
   * No-op in firestore mode — use writePlayback/setDoc directly.
   */
  sendMusicCmd: (action: SyncCmdAction, channel: SyncMusicChannel, payload: SyncCmdPayload) => void
  /** True when WS sync is disconnected and retrying */
  syncDisconnected: boolean
  isGm: boolean
  loading: boolean
}

function unlockStorageKey(gameId: string): string {
  return `musicAudioUnlocked_${gameId}`
}

function loadAudioUnlocked(gameId: string): boolean {
  if (!gameId) return false
  try {
    return sessionStorage.getItem(unlockStorageKey(gameId)) === '1'
  } catch {
    return false
  }
}

function saveAudioUnlocked(gameId: string): void {
  if (!gameId) return
  try {
    sessionStorage.setItem(unlockStorageKey(gameId), '1')
  } catch {
    /* ignore */
  }
}

function isAutoplayBlockedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  return name === 'NotAllowedError' || name === 'NotSupportedError'
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
  fadeGain = 1,
) {
  const vol = Math.max(0, Math.min(1, trackVolume * localVolume * matchGain * fadeGain))
  player.audio.volume = vol
}

function applyChannelVolume(
  player: ChannelPlayer,
  channel: MusicChannel,
  volumes: LocalChannelVolumes,
  state: MusicPlaybackState,
  tracks: MusicTrack[],
  loudnessTargets: Record<MusicChannel, number>,
  fadeGain = 1,
) {
  applyVolume(
    player,
    state.trackVolume,
    effectiveLocalVolume(volumes, channel),
    matchGainFor(channel, state, tracks, loudnessTargets),
    fadeGain,
  )
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
  const [audioUnlocked, setAudioUnlocked] = useState(() => loadAudioUnlocked(gameId))
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [loading, setLoading] = useState(true)
  /** Workers mode only: true when WS is disconnected and retrying */
  const [syncDisconnected, setSyncDisconnected] = useState(false)
  /** Workers mode: accumulated clock offset from pong messages */
  const clockOffsetRef = useRef(0)
  const syncClientRef = useRef<MusicSyncClient | null>(null)

  const playersRef = useRef<Partial<Record<MusicChannel, ChannelPlayer>>>({})
  const playbackRef = useRef(playback)
  const tracksRef = useRef(tracks)
  const playlistsRef = useRef(playlists)
  const localVolRef = useRef(localVolumes)
  const loudnessRef = useRef(loudnessTargets)
  const advancingRef = useRef<Partial<Record<MusicChannel, boolean>>>({})
  const audioUnlockedRef = useRef(audioUnlocked)
  /** Wall-clock ms when the channel last had status === 'playing'. */
  const lastActiveAtRef = useRef<Partial<Record<MusicChannel, number>>>({})
  /** Fade-in start time per channel; absent means full gain. */
  const fadeStartedAtRef = useRef<Partial<Record<MusicChannel, number>>>({})
  const prevStatusRef = useRef<Partial<Record<MusicChannel, MusicPlaybackState['status']>>>({})
  const fadeRafRef = useRef<number | null>(null)

  playbackRef.current = playback
  tracksRef.current = tracks
  playlistsRef.current = playlists
  localVolRef.current = localVolumes
  loudnessRef.current = loudnessTargets
  audioUnlockedRef.current = audioUnlocked

  const getFadeGain = useCallback((channel: MusicChannel, now = Date.now()): number => {
    const started = fadeStartedAtRef.current[channel]
    if (started == null) return 1
    const gain = fadeInGain(now - started)
    if (gain >= 1) {
      delete fadeStartedAtRef.current[channel]
      return 1
    }
    return gain
  }, [])

  const applyLiveVolume = useCallback((channel: MusicChannel) => {
    const player = playersRef.current[channel]
    if (!player) return
    applyChannelVolume(
      player,
      channel,
      localVolRef.current,
      playbackRef.current[channel],
      tracksRef.current,
      loudnessRef.current,
      getFadeGain(channel),
    )
  }, [getFadeGain])

  const scheduleFadeTick = useCallback(() => {
    if (fadeRafRef.current != null) return
    const tick = () => {
      fadeRafRef.current = null
      const now = Date.now()
      for (const channel of MUSIC_CHANNELS) {
        if (fadeStartedAtRef.current[channel] == null) continue
        if (playbackRef.current[channel].status === 'playing') {
          lastActiveAtRef.current[channel] = now
        }
        applyLiveVolume(channel)
      }
      if (Object.keys(fadeStartedAtRef.current).length > 0) {
        fadeRafRef.current = requestAnimationFrame(tick)
      }
    }
    fadeRafRef.current = requestAnimationFrame(tick)
  }, [applyLiveVolume])

  useEffect(() => {
    if (!user) return
    setLocalVolumes(loadLocalChannelVolumes(gameId, user.uid))
  }, [gameId, user])

  useEffect(() => {
    setAudioUnlocked(loadAudioUnlocked(gameId))
    setAudioBlocked(false)
    lastActiveAtRef.current = {}
    fadeStartedAtRef.current = {}
    prevStatusRef.current = {}
  }, [gameId])

  useEffect(() => {
    return () => {
      if (fadeRafRef.current != null) {
        cancelAnimationFrame(fadeRafRef.current)
        fadeRafRef.current = null
      }
    }
  }, [])

  const anyChannelPlaying = MUSIC_CHANNELS.some(
    (channel) => playback[channel].status === 'playing' && playback[channel].trackId,
  )
  const needsAudioUnlock = anyChannelPlaying && (!audioUnlocked || audioBlocked)

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
      localVolRef.current = next
      const player = playersRef.current[channel]
      if (player) {
        applyChannelVolume(
          player,
          channel,
          next,
          playbackRef.current[channel],
          tracksRef.current,
          loudnessRef.current,
          getFadeGain(channel),
        )
      }
      return next
    })
  }, [gameId, getFadeGain, user])

  const setLocalMasterVolume = useCallback((value: number) => {
    setLocalVolumes((prev) => {
      const next = {
        ...prev,
        master: Math.min(1, Math.max(0, value)),
        muted: false,
      }
      if (user) saveLocalChannelVolumes(gameId, user.uid, next)
      localVolRef.current = next
      for (const channel of MUSIC_CHANNELS) {
        const player = playersRef.current[channel]
        if (!player) continue
        applyChannelVolume(
          player,
          channel,
          next,
          playbackRef.current[channel],
          tracksRef.current,
          loudnessRef.current,
          getFadeGain(channel),
        )
      }
      return next
    })
  }, [gameId, getFadeGain, user])

  const setLocalMuted = useCallback((muted: boolean) => {
    setLocalVolumes((prev) => {
      const next = { ...prev, muted }
      if (user) saveLocalChannelVolumes(gameId, user.uid, next)
      localVolRef.current = next
      for (const channel of MUSIC_CHANNELS) {
        const player = playersRef.current[channel]
        if (!player) continue
        applyChannelVolume(
          player,
          channel,
          next,
          playbackRef.current[channel],
          tracksRef.current,
          loudnessRef.current,
          getFadeGain(channel),
        )
      }
      return next
    })
  }, [gameId, getFadeGain, user])

  const unlockAudio = useCallback(async () => {
    saveAudioUnlocked(gameId)
    setAudioUnlocked(true)
    setAudioBlocked(false)
    audioUnlockedRef.current = true

    for (const channel of MUSIC_CHANNELS) {
      const state = playbackRef.current[channel]
      const player = playersRef.current[channel]
      if (!player || state.status !== 'playing' || !state.trackId) continue
      try {
        const track = tracksRef.current.find((t) => t.id === state.trackId)
        const targetSec = computePositionMs(state, Date.now(), track?.durationMs) / 1000
        if (Number.isFinite(targetSec)) {
          try {
            player.audio.currentTime = targetSec
          } catch {
            /* ignore seek while loading */
          }
        }
        await player.audio.play()
      } catch (err) {
        if (isAutoplayBlockedError(err)) {
          setAudioBlocked(true)
          setAudioUnlocked(false)
          audioUnlockedRef.current = false
        }
      }
    }
  }, [gameId])

  // Browsers require a user gesture before audio.play(). Capture the first
  // click/key/touch anywhere in the document and unlock — no dedicated button.
  useEffect(() => {
    if (audioUnlocked && !audioBlocked) return

    const onGesture = () => {
      void unlockAudio()
    }
    const opts: AddEventListenerOptions = { capture: true, passive: true }
    document.addEventListener('pointerdown', onGesture, opts)
    document.addEventListener('keydown', onGesture, opts)
    document.addEventListener('touchstart', onGesture, opts)
    return () => {
      document.removeEventListener('pointerdown', onGesture, opts)
      document.removeEventListener('keydown', onGesture, opts)
      document.removeEventListener('touchstart', onGesture, opts)
    }
  }, [audioUnlocked, audioBlocked, unlockAudio])

  const getChannelPositionMs = useCallback((channel: MusicChannel): number => {
    const state = playbackRef.current[channel]
    const track = tracksRef.current.find((t) => t.id === state.trackId)
    const durationMs = track?.durationMs
    const player = playersRef.current[channel]
    if (
      player
      && player.boundTrackId === state.trackId
      && (state.status === 'playing' || state.status === 'paused')
      && Number.isFinite(player.audio.currentTime)
    ) {
      const fromAudio = Math.round(player.audio.currentTime * 1000)
      if (typeof durationMs === 'number' && durationMs > 0) {
        return Math.min(durationMs, Math.max(0, fromAudio))
      }
      return Math.max(0, fromAudio)
    }
    // In workers mode, adjust Date.now() by the server clock offset for better accuracy
    const now = FEATURES.musicSync === 'workers'
      ? Date.now() + clockOffsetRef.current
      : Date.now()
    return computePositionMs(state, now, durationMs)
  }, [])

  // Presence heartbeat
  useEffect(() => {
    if (!user || !gameId) return
    const uid = user.uid
    const displayName = user.displayName ?? ''
    const photoURL = user.photoURL ?? ''
    const presenceRef = doc(db, 'games', gameId, MUSIC_PRESENCE_COLLECTION, uid)

    async function beat() {
      try {
        await setDoc(presenceRef, {
          lastSeen: serverTimestamp(),
          displayName,
          photoURL,
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

  // Firestore mode: if GM is the last person leaving, idle all active channels.
  // Workers mode relies on GameRoom empty-session stop after the last WS disconnect.
  useEffect(() => {
    if (!user || !gameId || !isGm) return
    if (FEATURES.musicSync === 'workers') return

    const uid = user.uid

    function presenceLastSeenMs(data: Record<string, unknown>): number {
      const lastSeen = data.lastSeen
      if (lastSeen && typeof lastSeen === 'object' && 'toMillis' in lastSeen) {
        return (lastSeen as Timestamp).toMillis()
      }
      if (typeof lastSeen === 'number' && Number.isFinite(lastSeen)) return lastSeen
      return 0
    }

    async function stopIfLastInSession() {
      try {
        const snap = await getDocs(collection(db, 'games', gameId, MUSIC_PRESENCE_COLLECTION))
        const now = Date.now()
        const othersOnline = snap.docs.some((d) => {
          if (d.id === uid) return false
          const lastSeenMs = presenceLastSeenMs(d.data() as Record<string, unknown>)
          return lastSeenMs > 0 && now - lastSeenMs < PRESENCE_ONLINE_MS
        })
        if (othersOnline) return

        for (const channel of MUSIC_CHANNELS) {
          const state = playbackRef.current[channel]
          if (state.status !== 'playing' && state.status !== 'paused') continue
          await setDoc(
            doc(db, 'games', gameId, MUSIC_PLAYBACK_COLLECTION, channel),
            {
              ...musicPlaybackPayload({
                ...idlePlaybackState(channel),
                trackVolume: state.trackVolume,
              }, uid),
              startedAt: null,
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )
        }
      } catch {
        /* best-effort on leave */
      }
    }

    const onPageHide = () => {
      void stopIfLastInSession()
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      void stopIfLastInSession()
    }
  }, [gameId, user, isGm])

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

    // musicPlayback: only subscribe via Firestore in firestore mode.
    // In workers mode, playback state comes from the WebSocket (see WS effect below).
    const unsubsPlayback = FEATURES.musicSync === 'firestore'
      ? MUSIC_CHANNELS.map((channel) =>
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
      : []

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
            applyChannelVolume(
              player,
              channel,
              localVolRef.current,
              state,
              tracksRef.current,
              nextTargets,
              getFadeGain(channel),
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

  // ── Workers mode: WebSocket sync ─────────────────────────────────────────────
  // Convert server ChannelState → MusicPlaybackState (front-end shape)
  const syncStateToPlayback = useCallback(
    (serverState: SyncChannelState): MusicPlaybackState => {
      return {
        channel: serverState.channel as MusicChannel,
        status: serverState.status,
        source: serverState.source,
        trackId: serverState.trackId,
        playlistId: serverState.playlistId,
        playlistIndex: serverState.playlistIndex,
        loopMode: serverState.loopMode,
        trackVolume: serverState.trackVolume,
        positionMs: serverState.positionMs,
        // Convert server epoch ms → pseudo Timestamp (used only for computePositionMs)
        startedAt: serverState.startedAtMs != null
          ? { toMillis: () => serverState.startedAtMs as number } as import('firebase/firestore').Timestamp
          : null,
      }
    },
    [],
  )

  useEffect(() => {
    if (FEATURES.musicSync !== 'workers') return
    if (!user || !gameId) return
    const baseUrl = FEATURES.musicSyncUrl
    if (!baseUrl) return

    const client = new MusicSyncClient({
      baseUrl,
      gameId,
      getToken: () => user.getIdToken(),
      onState: (snapshot, serverTimeMs) => {
        clockOffsetRef.current = serverTimeMs - Date.now()
        setSyncDisconnected(false)
        const next: Record<MusicChannel, MusicPlaybackState> = {
          ambient: syncStateToPlayback(snapshot.ambient),
          music: syncStateToPlayback(snapshot.music),
          effects: syncStateToPlayback(snapshot.effects),
        }
        setPlayback(next)
      },
      onRole: () => { /* role comes from useGameRole */ },
      onConnected: () => { /* wait for welcome/state before clearing banner */ },
      onDisconnected: () => { /* transient; banner only after sync_unavailable */ },
      onError: (err) => {
        console.warn('[musicSync]', err)
        if (err === 'sync_unavailable' || err.startsWith('[AUTH_FAILED]') || err.startsWith('[ROLE_CHECK_FAILED]') || err.startsWith('[NOT_MEMBER]') || err.startsWith('[SERVER_MISCONFIG]')) {
          setSyncDisconnected(true)
        }
      },
    })

    syncClientRef.current = client
    client.connect()
    setLoading(false) // catalog is still loaded from Firestore; WS state arrives async

    return () => {
      client.close()
      syncClientRef.current = null
      setSyncDisconnected(false)
    }
  }, [gameId, user, syncStateToPlayback])

  const sendMusicCmd = useCallback(
    (action: SyncCmdAction, channel: SyncMusicChannel, payload: SyncCmdPayload) => {
      if (FEATURES.musicSync !== 'workers') return
      syncClientRef.current?.sendCmd(action, channel, payload)
    },
    [],
  )

  // ── End workers mode ──────────────────────────────────────────────────────────

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
      const prevStatus = prevStatusRef.current[channel]
      const now = Date.now()

      if (state.status !== 'playing') {
        delete fadeStartedAtRef.current[channel]
        prevStatusRef.current[channel] = state.status
        applyChannelVolume(
          player,
          channel,
          localVolRef.current,
          state,
          tracksRef.current,
          loudnessRef.current,
          1,
        )
        if (state.status === 'idle' || !state.trackId) {
          player.audio.pause()
          player.audio.removeAttribute('src')
          player.boundTrackId = null
        } else {
          player.audio.pause()
        }
        return
      }

      if (!state.trackId) return
      const track = tracksRef.current.find((t) => t.id === state.trackId)
      if (!track) return

      // Entering play after silence → fade in. Continuous play keeps full gain.
      if (prevStatus !== 'playing') {
        if (shouldFadeInAfterSilence(lastActiveAtRef.current[channel], now)) {
          fadeStartedAtRef.current[channel] = now
        } else {
          delete fadeStartedAtRef.current[channel]
        }
      }
      scheduleFadeTick()

      try {
        const needsBind = player.boundTrackId !== track.id
        if (needsBind) {
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

        const targetSec = computePositionMs(state, Date.now(), track.durationMs) / 1000
        if (Number.isFinite(targetSec)) {
          const drift = Math.abs((player.audio.currentTime || 0) - targetSec)
          // Always align after a new bind; otherwise only correct drift.
          // Workers mode: tighter threshold (0.2s) since server time is authoritative.
          const driftThreshold = FEATURES.musicSync === 'workers' ? 0.2 : 0.75
          if (needsBind || player.audio.paused || drift > driftThreshold) {
            try {
              player.audio.currentTime = targetSec
            } catch {
              /* ignore seek errors while loading */
            }
          }
        }

        applyChannelVolume(
          player,
          channel,
          localVolRef.current,
          state,
          tracksRef.current,
          loudnessRef.current,
          getFadeGain(channel),
        )

        try {
          await player.audio.play()
          if (cancelled) return
          lastActiveAtRef.current[channel] = Date.now()
          prevStatusRef.current[channel] = 'playing'
          if (!audioUnlockedRef.current) {
            setAudioUnlocked(true)
            saveAudioUnlocked(gameId)
            audioUnlockedRef.current = true
          }
          setAudioBlocked(false)
          scheduleFadeTick()
          applyChannelVolume(
            player,
            channel,
            localVolRef.current,
            state,
            tracksRef.current,
            loudnessRef.current,
            getFadeGain(channel),
          )
        } catch (err) {
          if (isAutoplayBlockedError(err)) {
            setAudioBlocked(true)
          }
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
  }, [
    playback,
    ensurePlayer,
    tracks,
    gameId,
    getFadeGain,
    scheduleFadeTick,
  ])

  // ended → conductor advance (GM only, firestore mode).
  // In workers mode the server DO alarm handles playlist advance — no client action needed.
  useEffect(() => {
    if (FEATURES.musicSync === 'workers') return
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
    setLocalMasterVolume,
    setLocalMuted,
    needsAudioUnlock,
    unlockAudio,
    getChannelPositionMs,
    sendMusicCmd,
    syncDisconnected,
    isGm,
    loading,
  }), [
    tracks,
    playlists,
    playback,
    loudnessTargets,
    localVolumes,
    setLocalVolume,
    setLocalMasterVolume,
    setLocalMuted,
    needsAudioUnlock,
    unlockAudio,
    getChannelPositionMs,
    sendMusicCmd,
    syncDisconnected,
    isGm,
    loading,
  ])

  return (
    <MusicSyncContext.Provider value={value}>
      {children}
    </MusicSyncContext.Provider>
  )
}
