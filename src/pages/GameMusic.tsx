import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { FaArrowRight, FaPause, FaPlay, FaRedo, FaStepBackward, FaStepForward, FaSync } from 'react-icons/fa'
import { db, storage } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useMusicSync } from '@/contexts/MusicSyncContext'
import { useLayoutHeader } from '@/contexts/LayoutContext'
import { useGameRole } from '@/hooks/useGameRole'
import Button from '@/components/ui/Button'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import type {
  MusicChannel,
  MusicLoopMode,
  MusicPlaybackState,
  MusicPlaylist,
  MusicTrack,
} from '@/types'
import {
  DEFAULT_LOUDNESS_TARGET,
  DEFAULT_TRACK_VOLUME,
  MUSIC_CHANNELS,
  MUSIC_CHANNELS_COLLECTION,
  MUSIC_MAX_BYTES,
  MUSIC_PLAYBACK_COLLECTION,
  MUSIC_PLAYLISTS_COLLECTION,
  MUSIC_TRACKS_COLLECTION,
  computePositionMs,
  formatDurationMs,
  isAllowedMusicFile,
  musicChannelSettingsPayload,
  musicFileRejectReason,
  musicPlaybackPayload,
  musicPlaylistPayload,
  musicTrackPayload,
  musicTrackStoragePath,
  nextPlaylistIndex,
  normalizePlaylistLoopMode,
  resolveMusicContentType,
  stepPlaylistIndex,
} from '@/utils/musicPlayback'
import { analyzeMusicDownloadUrl, analyzeMusicFile } from '@/utils/musicWaveform'
import MusicWaveformSeek from '@/components/music/MusicWaveformSeek'

type TabKey = 'library' | 'playlists' | 'mixer'

const CHANNEL_LABEL_KEY: Record<MusicChannel, string> = {
  ambient: 'music.channels.ambient',
  music: 'music.channels.music',
  effects: 'music.channels.effects',
}

const TRACK_LOOP_ICONS: Array<{
  mode: Exclude<MusicLoopMode, 'playlist'>
  Icon: typeof FaArrowRight
  labelKey: string
}> = [
  { mode: 'off', Icon: FaArrowRight, labelKey: 'music.loopOff' },
  { mode: 'track', Icon: FaRedo, labelKey: 'music.loopTrack' },
]

const PLAYLIST_LOOP_ICONS: Array<{
  mode: Exclude<MusicLoopMode, 'track'>
  Icon: typeof FaArrowRight
  labelKey: string
}> = [
  { mode: 'off', Icon: FaArrowRight, labelKey: 'music.loopOff' },
  { mode: 'playlist', Icon: FaSync, labelKey: 'music.loopPlaylist' },
]

function newId(): string {
  return crypto.randomUUID()
}

export default function GameMusic() {
  const { gameId = '' } = useParams()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { role, loading: roleLoading } = useGameRole(gameId)
  const isGm = role === 'gm'
  const {
    tracks,
    playlists,
    playback,
    loudnessTargets,
    localVolumes,
    setLocalVolume,
    loading: musicLoading,
  } = useMusicSync()

  const [tab, setTab] = useState<TabKey>('mixer')
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOverUpload, setDragOverUpload] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [playlistName, setPlaylistName] = useState('')
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [draftTrackIds, setDraftTrackIds] = useState<string[]>([])
  const [draftPlaylistLoop, setDraftPlaylistLoop] = useState<Exclude<MusicLoopMode, 'track'>>('off')
  const [clock, setClock] = useState(0)
  const [waveformLoadingIds, setWaveformLoadingIds] = useState<Record<string, boolean>>({})
  const waveformFileRef = useRef<HTMLInputElement>(null)
  const waveformTrackIdRef = useRef<string | null>(null)
  const waveformAttemptedRef = useRef(new Set<string>())
  const [playMenuTrackId, setPlayMenuTrackId] = useState<string | null>(null)
  const [playMenuPlaylistId, setPlayMenuPlaylistId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<
    { kind: 'track' | 'playlist'; id: string } | null
  >(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const [channelSource, setChannelSource] = useState<Record<MusicChannel, {
    mode: 'track' | 'playlist'
    trackId: string
    playlistId: string
  }>>(() => ({
    ambient: { mode: 'track', trackId: '', playlistId: '' },
    music: { mode: 'track', trackId: '', playlistId: '' },
    effects: { mode: 'track', trackId: '', playlistId: '' },
  }))

  useEffect(() => {
    if (!playMenuTrackId && !playMenuPlaylistId) return
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null
      if (target?.closest('[data-play-menu]')) return
      setPlayMenuTrackId(null)
      setPlayMenuPlaylistId(null)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      setPlayMenuTrackId(null)
      setPlayMenuPlaylistId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [playMenuTrackId, playMenuPlaylistId])

  useLayoutHeader({
    backTo: `/game/${gameId}/gm`,
    backLabel: t('gmPanel.title'),
    title: t('music.title'),
  }, [gameId, t])

  useEffect(() => {
    const anyPlaying = MUSIC_CHANNELS.some((channel) => playback[channel].status === 'playing')
    if (!anyPlaying) return
    let raf = 0
    let last = 0
    const tick = (now: number) => {
      // ~30 fps — smooth playhead without thrashing the mixer UI
      if (now - last >= 33) {
        last = now
        setClock(Date.now())
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playback])

  // Auto-build waveform for tracks missing peaks (dev: Vite Storage proxy; prod: needs CORS or local file).
  useEffect(() => {
    if (!isGm || !user || !gameId) return
    let cancelled = false

    async function backfill() {
      for (const track of tracks) {
        if (cancelled) return
        if (track.waveformPeaks && track.waveformPeaks.length >= 2) continue
        if (waveformAttemptedRef.current.has(track.id)) continue
        waveformAttemptedRef.current.add(track.id)
        setWaveformLoadingIds((prev) => ({ ...prev, [track.id]: true }))
        try {
          const url = await getDownloadURL(ref(storage, track.storagePath))
          if (cancelled) return
          const analysis = await analyzeMusicDownloadUrl(url)
          if (analysis.waveformPeaks.length < 2) continue
          await setDoc(
            doc(db, 'games', gameId, MUSIC_TRACKS_COLLECTION, track.id),
            {
              waveformPeaks: analysis.waveformPeaks,
              ...(typeof analysis.loudnessRms === 'number' ? { loudnessRms: analysis.loudnessRms } : {}),
              ...(typeof analysis.durationMs === 'number' && !track.durationMs
                ? { durationMs: analysis.durationMs }
                : {}),
              updatedAt: serverTimestamp(),
            },
            { merge: true },
          )
        } catch {
          /* CORS / decode — use “Waveform from file” */
        } finally {
          if (!cancelled) {
            setWaveformLoadingIds((prev) => {
              const next = { ...prev }
              delete next[track.id]
              return next
            })
          }
        }
      }
    }

    void backfill()
    return () => {
      cancelled = true
    }
  }, [tracks, isGm, user, gameId])

  useEffect(() => {
    setChannelSource((prev) => {
      const next = { ...prev }
      for (const channel of MUSIC_CHANNELS) {
        const state = playback[channel]
        if (!state.trackId && !state.playlistId) continue
        next[channel] = {
          mode: state.source,
          trackId: state.trackId || prev[channel].trackId,
          playlistId: state.playlistId || prev[channel].playlistId,
        }
      }
      return next
    })
  }, [playback])

  const writePlayback = useCallback(async (
    channel: MusicChannel,
    state: MusicPlaybackState,
    opts?: { setStartedAt?: boolean; clearStartedAt?: boolean },
  ) => {
    if (!user) return
    const payload = musicPlaybackPayload(state, user.uid)
    await setDoc(
      doc(db, 'games', gameId, MUSIC_PLAYBACK_COLLECTION, channel),
      {
        ...payload,
        ...(opts?.setStartedAt ? { startedAt: serverTimestamp() } : {}),
        ...(opts?.clearStartedAt ? { startedAt: null } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }, [gameId, user])

  async function handleUpload(files: FileList | null) {
    if (!user || !files?.length) return
    setUploading(true)
    setError(null)
    setUploadNotice(null)
    const rejected: string[] = []
    let uploaded = 0
    try {
      for (const file of Array.from(files)) {
        const reason = musicFileRejectReason(file)
        if (reason === 'size') {
          rejected.push(t('music.uploadRejectedSize', {
            name: file.name,
            mb: Math.round(MUSIC_MAX_BYTES / (1024 * 1024)),
          }))
          continue
        }
        if (reason === 'format') {
          rejected.push(t('music.uploadRejectedFormat', { name: file.name }))
          continue
        }
        const trackId = newId()
        const contentType = resolveMusicContentType(file)
        const storagePath = musicTrackStoragePath(gameId, trackId, contentType)
        const analysis = await analyzeMusicFile(file)
        await uploadBytes(ref(storage, storagePath), file, { contentType })
        // Touch download URL early so first play is faster
        void getDownloadURL(ref(storage, storagePath))
        const name = file.name.replace(/\.(mp3|webm|m4a)$/i, '')
        await setDoc(doc(db, 'games', gameId, MUSIC_TRACKS_COLLECTION, trackId), {
          ...musicTrackPayload({
            name,
            storagePath,
            contentType,
            sizeBytes: file.size,
            durationMs: analysis.durationMs,
            waveformPeaks: analysis.waveformPeaks.length >= 2 ? analysis.waveformPeaks : undefined,
            loudnessRms: analysis.loudnessRms,
            loopMode: 'off',
            createdBy: user.uid,
          }),
          createdAt: serverTimestamp(),
        })
        uploaded += 1
      }
      if (rejected.length > 0) {
        setUploadNotice(
          [
            uploaded > 0 ? t('music.uploadPartialOk', { count: uploaded }) : null,
            t('music.uploadRejectedSummary', { count: rejected.length }),
            ...rejected,
          ].filter(Boolean).join('\n'),
        )
      } else if (uploaded > 0) {
        setUploadNotice(t('music.uploadSuccess', { count: uploaded }))
      }
    } catch {
      setUploadNotice(t('music.uploadError'))
      setError(t('music.uploadError'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function pickWaveformFile(trackId: string) {
    waveformTrackIdRef.current = trackId
    waveformFileRef.current?.click()
  }

  async function handleWaveformFile(files: FileList | null) {
    const trackId = waveformTrackIdRef.current
    waveformTrackIdRef.current = null
    const file = files?.[0]
    if (!user || !trackId || !file) return
    if (!isAllowedMusicFile(file)) {
      setError(t('music.uploadInvalid'))
      return
    }
    setError(null)
    setWaveformLoadingIds((prev) => ({ ...prev, [trackId]: true }))
    try {
      const analysis = await analyzeMusicFile(file)
      if (analysis.waveformPeaks.length < 2) {
        setError(t('music.waveformError'))
        return
      }
      const track = tracks.find((item) => item.id === trackId)
      await setDoc(
        doc(db, 'games', gameId, MUSIC_TRACKS_COLLECTION, trackId),
        {
          waveformPeaks: analysis.waveformPeaks,
          ...(typeof analysis.loudnessRms === 'number' ? { loudnessRms: analysis.loudnessRms } : {}),
          ...(typeof analysis.durationMs === 'number' && !track?.durationMs
            ? { durationMs: analysis.durationMs }
            : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch {
      setError(t('music.waveformError'))
    } finally {
      setWaveformLoadingIds((prev) => {
        const next = { ...prev }
        delete next[trackId]
        return next
      })
      if (waveformFileRef.current) waveformFileRef.current.value = ''
    }
  }

  async function handleDeleteTrack(track: MusicTrack) {
    if (!user) return
    setError(null)
    for (const channel of MUSIC_CHANNELS) {
      if (playback[channel].trackId === track.id) {
        await writePlayback(channel, {
          ...playback[channel],
          status: 'idle',
          trackId: '',
          positionMs: 0,
          startedAt: null,
        }, { clearStartedAt: true })
      }
    }
    for (const playlist of playlists) {
      if (!playlist.trackIds.includes(track.id)) continue
      await setDoc(
        doc(db, 'games', gameId, MUSIC_PLAYLISTS_COLLECTION, playlist.id),
        {
          ...musicPlaylistPayload({
            ...playlist,
            trackIds: playlist.trackIds.filter((id) => id !== track.id),
          }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }
    try {
      await deleteObject(ref(storage, track.storagePath))
    } catch {
      /* file may already be gone */
    }
    await deleteDoc(doc(db, 'games', gameId, MUSIC_TRACKS_COLLECTION, track.id))
  }

  function startEditPlaylist(playlist: MusicPlaylist | null) {
    if (!playlist) {
      setEditingPlaylistId('new')
      setPlaylistName('')
      setDraftTrackIds([])
      setDraftPlaylistLoop('off')
      return
    }
    setEditingPlaylistId(playlist.id)
    setPlaylistName(playlist.name)
    setDraftTrackIds([...playlist.trackIds])
    setDraftPlaylistLoop(playlist.loopMode)
  }

  async function savePlaylist() {
    if (!user || !playlistName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const id = editingPlaylistId && editingPlaylistId !== 'new'
        ? editingPlaylistId
        : newId()
      await setDoc(doc(db, 'games', gameId, MUSIC_PLAYLISTS_COLLECTION, id), {
        ...musicPlaylistPayload({
          name: playlistName,
          trackIds: draftTrackIds,
          loopMode: draftPlaylistLoop,
          createdBy: user.uid,
        }),
        ...(editingPlaylistId === 'new' || !editingPlaylistId
          ? { createdAt: serverTimestamp() }
          : {}),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setEditingPlaylistId(null)
      setPlaylistName('')
      setDraftTrackIds([])
      setDraftPlaylistLoop('off')
    } catch {
      setError(t('music.playlistSaveError'))
    } finally {
      setBusy(false)
    }
  }

  async function deletePlaylist(id: string) {
    setError(null)
    await deleteDoc(doc(db, 'games', gameId, MUSIC_PLAYLISTS_COLLECTION, id))
    if (editingPlaylistId === id) {
      setEditingPlaylistId(null)
    }
  }

  async function runConfirmDelete() {
    if (!confirmDelete) return
    setConfirmLoading(true)
    setError(null)
    try {
      if (confirmDelete.kind === 'track') {
        const track = tracks.find((item) => item.id === confirmDelete.id)
        if (track) await handleDeleteTrack(track)
      } else {
        await deletePlaylist(confirmDelete.id)
      }
      setConfirmDelete(null)
    } catch {
      setError(
        confirmDelete.kind === 'track'
          ? t('music.deleteError')
          : t('music.playlistDeleteError'),
      )
      setConfirmDelete(null)
    } finally {
      setConfirmLoading(false)
    }
  }

  function sourceDraftDiffers(
    src: { mode: 'track' | 'playlist'; trackId: string; playlistId: string },
    state: MusicPlaybackState,
  ): boolean {
    if (state.status !== 'playing' && state.status !== 'paused') return false
    if (src.mode === 'playlist') {
      return state.source !== 'playlist' || state.playlistId !== src.playlistId
    }
    return state.source !== 'track' || state.trackId !== src.trackId
  }

  function draftMatchesLive(
    src: { mode: 'track' | 'playlist'; trackId: string; playlistId: string },
    state: MusicPlaybackState,
  ): boolean {
    if (!state.trackId) return false
    if (src.mode === 'playlist') {
      return state.source === 'playlist' && state.playlistId === src.playlistId
    }
    return state.source === 'track' && state.trackId === src.trackId
  }

  async function playTrackOnChannel(channel: MusicChannel, track: MusicTrack) {
    if (!user) return
    setError(null)
    setPlayMenuTrackId(null)
    setPlayMenuPlaylistId(null)
    setChannelSource((prev) => ({
      ...prev,
      [channel]: { mode: 'track', trackId: track.id, playlistId: '' },
    }))
    try {
      const current = playback[channel]
      await writePlayback(channel, {
        channel,
        status: 'playing',
        source: 'track',
        trackId: track.id,
        playlistId: undefined,
        playlistIndex: undefined,
        loopMode: track.loopMode ?? 'off',
        trackVolume: current.trackVolume || DEFAULT_TRACK_VOLUME,
        positionMs: 0,
        startedAt: null,
      }, { setStartedAt: true })
      setTab('mixer')
    } catch {
      setError(t('music.playbackError'))
    }
  }

  async function playPlaylistOnChannel(channel: MusicChannel, playlist: MusicPlaylist) {
    if (!user) return
    setError(null)
    setPlayMenuTrackId(null)
    setPlayMenuPlaylistId(null)
    if (playlist.trackIds.length === 0) {
      setError(t('music.playlistEmpty'))
      return
    }
    setChannelSource((prev) => ({
      ...prev,
      [channel]: { mode: 'playlist', trackId: '', playlistId: playlist.id },
    }))
    try {
      const current = playback[channel]
      await writePlayback(channel, {
        channel,
        status: 'playing',
        source: 'playlist',
        trackId: playlist.trackIds[0],
        playlistId: playlist.id,
        playlistIndex: 0,
        loopMode: normalizePlaylistLoopMode(playlist.loopMode),
        trackVolume: current.trackVolume || DEFAULT_TRACK_VOLUME,
        positionMs: 0,
        startedAt: null,
      }, { setStartedAt: true })
      setTab('mixer')
    } catch {
      setError(t('music.playbackError'))
    }
  }

  async function playChannel(channel: MusicChannel) {
    if (!user) return
    const src = channelSource[channel]
    const current = playback[channel]
    setError(null)
    try {
      // Resume paused playback when source draft still matches live
      if (current.status === 'paused' && current.trackId && draftMatchesLive(src, current)) {
        await writePlayback(channel, {
          ...current,
          status: 'playing',
          positionMs: computePositionMs(current),
          startedAt: null,
        }, { setStartedAt: true })
        return
      }

      let trackId = src.trackId
      let playlistId: string | undefined
      let playlistIndex: number | undefined
      let source: MusicPlaybackState['source'] = 'track'
      let loopMode: MusicLoopMode = 'off'

      if (src.mode === 'playlist') {
        const playlist = playlists.find((p) => p.id === src.playlistId)
        if (!playlist || playlist.trackIds.length === 0) {
          setError(t('music.playlistEmpty'))
          return
        }
        source = 'playlist'
        playlistId = playlist.id
        playlistIndex = 0
        trackId = playlist.trackIds[0]
        loopMode = normalizePlaylistLoopMode(playlist.loopMode)
      } else if (!trackId) {
        setError(t('music.selectTrack'))
        return
      } else {
        const track = tracks.find((item) => item.id === trackId)
        loopMode = track?.loopMode ?? 'off'
      }

      await writePlayback(channel, {
        channel,
        status: 'playing',
        source,
        trackId,
        playlistId,
        playlistIndex,
        loopMode,
        trackVolume: current.trackVolume || DEFAULT_TRACK_VOLUME,
        positionMs: 0,
        startedAt: null,
      }, { setStartedAt: true })
    } catch {
      setError(t('music.playbackError'))
    }
  }

  async function pauseChannel(channel: MusicChannel) {
    if (!user) return
    const state = playback[channel]
    if (state.status !== 'playing' || !state.trackId) return
    try {
      await writePlayback(channel, {
        ...state,
        status: 'paused',
        positionMs: computePositionMs(state),
        startedAt: null,
      }, { clearStartedAt: true })
    } catch {
      setError(t('music.playbackError'))
    }
  }

  async function updateTrackLoop(
    track: MusicTrack,
    loopMode: Exclude<MusicLoopMode, 'playlist'>,
  ) {
    if (!user) return
    setError(null)
    try {
      await setDoc(
        doc(db, 'games', gameId, MUSIC_TRACKS_COLLECTION, track.id),
        {
          ...musicTrackPayload({ ...track, loopMode }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch {
      setError(t('music.trackSaveError'))
    }
  }

  async function updatePlaylistLoop(
    playlist: MusicPlaylist,
    loopMode: Exclude<MusicLoopMode, 'track'>,
  ) {
    if (!user) return
    setError(null)
    try {
      await setDoc(
        doc(db, 'games', gameId, MUSIC_PLAYLISTS_COLLECTION, playlist.id),
        {
          ...musicPlaylistPayload({ ...playlist, loopMode }),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch {
      setError(t('music.playlistSaveError'))
    }
  }

  async function skipPlaylistTrack(channel: MusicChannel, delta: -1 | 1) {
    if (!user) return
    const state = playback[channel]
    if (state.source !== 'playlist' || !state.playlistId) return
    const playlist = playlists.find((p) => p.id === state.playlistId)
    if (!playlist || playlist.trackIds.length < 2) return
    const index = state.playlistIndex ?? 0
    const nextIndex = stepPlaylistIndex(playlist.trackIds, index, delta)
    if (nextIndex == null || nextIndex === index) return
    const trackId = playlist.trackIds[nextIndex]
    if (!trackId) return
    setError(null)
    try {
      await writePlayback(channel, {
        ...state,
        status: 'playing',
        trackId,
        playlistIndex: nextIndex,
        positionMs: 0,
        startedAt: null,
      }, { setStartedAt: true })
    } catch {
      setError(t('music.playbackError'))
    }
  }

  async function seekChannel(channel: MusicChannel, positionMs: number) {
    if (!user) return
    const state = playback[channel]
    if (!state.trackId) return
    try {
      await writePlayback(channel, {
        ...state,
        positionMs: Math.max(0, Math.trunc(positionMs)),
        startedAt: null,
      }, state.status === 'playing' ? { setStartedAt: true } : { clearStartedAt: true })
    } catch {
      setError(t('music.playbackError'))
    }
  }

  async function setTrackVolume(channel: MusicChannel, trackVolume: number) {
    if (!user) return
    const state = playback[channel]
    try {
      await writePlayback(channel, {
        ...state,
        trackVolume,
      })
    } catch {
      setError(t('music.playbackError'))
    }
  }

  async function setLoudnessTarget(channel: MusicChannel, loudnessTarget: number) {
    if (!user) return
    try {
      await setDoc(
        doc(db, 'games', gameId, MUSIC_CHANNELS_COLLECTION, channel),
        {
          ...musicChannelSettingsPayload(loudnessTarget, user.uid),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    } catch {
      setError(t('music.loudnessError'))
    }
  }

  const trackById = useMemo(() => {
    const map = new Map<string, MusicTrack>()
    for (const track of tracks) map.set(track.id, track)
    return map
  }, [tracks])

  if (roleLoading || musicLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isGm) {
    return (
      <div className="space-y-4 max-w-lg">
        <p className="text-sm text-ink-muted">{t('music.unauthorized')}</p>
        <Link to={`/game/${gameId}`} className="text-sm text-blood-light hover:underline">
          ← {t('game.lobby')}
        </Link>
      </div>
    )
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'mixer', label: t('music.tabs.mixer') },
    { key: 'library', label: t('music.tabs.library') },
    { key: 'playlists', label: t('music.tabs.playlists') },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <input
        ref={fileRef}
        type="file"
        accept="audio/mpeg,audio/webm,audio/mp4,audio/x-m4a,audio/aac,.mp3,.webm,.m4a"
        multiple
        className="hidden"
        onChange={(e) => void handleUpload(e.target.files)}
      />
      <input
        ref={waveformFileRef}
        type="file"
        accept="audio/mpeg,audio/webm,audio/mp4,audio/x-m4a,audio/aac,.mp3,.webm,.m4a"
        className="hidden"
        onChange={(e) => void handleWaveformFile(e.target.files)}
      />

      {error && (
        <p role="alert" className="text-sm text-blood">
          {error}
        </p>
      )}

      <div
        role="tablist"
        aria-label={t('music.title')}
        className="flex flex-wrap gap-1 border-b border-border pb-2"
        onKeyDown={(e) => {
          const order = tabs.map((item) => item.key)
          const idx = order.indexOf(tab)
          if (idx < 0) return
          let next = idx
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            next = (idx + 1) % order.length
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            next = (idx - 1 + order.length) % order.length
          } else if (e.key === 'Home') {
            e.preventDefault()
            next = 0
          } else if (e.key === 'End') {
            e.preventDefault()
            next = order.length - 1
          } else {
            return
          }
          const nextKey = order[next]
          setTab(nextKey)
          requestAnimationFrame(() => {
            document.getElementById(`music-tab-${nextKey}`)?.focus()
          })
        }}
      >
        {tabs.map((item) => (
          <button
            key={item.key}
            id={`music-tab-${item.key}`}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            aria-controls={`music-panel-${item.key}`}
            tabIndex={tab === item.key ? 0 : -1}
            onClick={() => setTab(item.key)}
            className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-colors ${
              tab === item.key
                ? 'bg-blood/20 text-blood-light'
                : 'text-ink-faint hover:text-ink'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={confirmDelete != null}
        dangerous
        confirmLoading={confirmLoading}
        message={
          confirmDelete?.kind === 'track'
            ? t('music.deleteTrackConfirm', {
                name: tracks.find((item) => item.id === confirmDelete.id)?.name ?? '',
              })
            : t('music.deletePlaylistConfirm', {
                name: playlists.find((item) => item.id === confirmDelete?.id)?.name ?? '',
              })
        }
        onCancel={() => {
          if (confirmLoading) return
          setConfirmDelete(null)
        }}
        onConfirm={() => void runConfirmDelete()}
      />

      {tab === 'library' && (
        <section
          id="music-panel-library"
          role="tabpanel"
          aria-labelledby="music-tab-library"
          className="space-y-4"
        >
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOverUpload(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOverUpload(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOverUpload(false)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOverUpload(false)
              void handleUpload(e.dataTransfer.files)
            }}
            className={`w-full rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
              dragOverUpload
                ? 'border-blood bg-blood/10'
                : 'border-border bg-surface/50 hover:border-border-light hover:bg-elevated/40'
            } ${uploading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
          >
            <p className="text-sm text-ink">
              {uploading ? t('music.uploading') : t('music.uploadDrop')}
            </p>
            <p className="mt-1 text-[10px] text-ink-faint">
              {t('music.uploadHint', { mb: Math.round(MUSIC_MAX_BYTES / (1024 * 1024)) })}
            </p>
          </button>
          {uploadNotice && (
            <p className="text-sm text-blood whitespace-pre-line" role="alert">
              {uploadNotice}
            </p>
          )}

          {tracks.length === 0 ? (
            <p className="text-sm text-ink-faint">{t('music.libraryEmpty')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {tracks.map((track) => (
                <li key={track.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink truncate">{track.name}</p>
                    <p className="text-[10px] font-mono text-ink-faint">
                      {formatDurationMs(track.durationMs)}
                      {' · '}
                      {(track.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      {track.waveformPeaks && track.waveformPeaks.length >= 2
                        ? ` · ${t('music.waveformReady')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative" data-play-menu>
                      <button
                        type="button"
                        aria-label={t('music.play')}
                        aria-expanded={playMenuTrackId === track.id}
                        onClick={() => {
                          setPlayMenuPlaylistId(null)
                          setPlayMenuTrackId((id) => (id === track.id ? null : track.id))
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded border border-emerald-700/60 bg-emerald-700/30 text-emerald-200 hover:bg-emerald-600/50 transition-colors"
                      >
                        <FaPlay className="w-3 h-3" aria-hidden />
                      </button>
                      {playMenuTrackId === track.id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-20 min-w-[9rem] rounded border border-border bg-void shadow-lg py-1"
                          role="menu"
                        >
                          {MUSIC_CHANNELS.map((channel) => (
                            <button
                              key={channel}
                              type="button"
                              role="menuitem"
                              onClick={() => void playTrackOnChannel(channel, track)}
                              className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                            >
                              {t(CHANNEL_LABEL_KEY[channel])}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {!(track.waveformPeaks && track.waveformPeaks.length >= 2) && (
                      <Button
                        variant="ghost"
                        className="text-xs"
                        loading={Boolean(waveformLoadingIds[track.id])}
                        onClick={() => pickWaveformFile(track.id)}
                      >
                        {t('music.waveformFromFile')}
                      </Button>
                    )}
                    <div
                      className="inline-flex items-center rounded border border-border overflow-hidden"
                      role="group"
                      aria-label={t('music.loop')}
                    >
                      {TRACK_LOOP_ICONS.map(({ mode, Icon, labelKey }, index) => {
                        const active = track.loopMode === mode
                        return (
                          <button
                            key={mode}
                            type="button"
                            title={t(labelKey)}
                            aria-label={t(labelKey)}
                            aria-pressed={active}
                            onClick={() => void updateTrackLoop(track, mode)}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-colors ${
                              index > 0 ? 'border-l border-border' : ''
                            } ${
                              active
                                ? 'bg-blood/25 text-blood-light'
                                : 'bg-void text-ink-faint hover:text-ink'
                            }`}
                          >
                            <Icon className="w-3 h-3" aria-hidden />
                          </button>
                        )
                      })}
                    </div>
                    <Button
                      variant="danger"
                      className="text-xs"
                      disabled={confirmLoading}
                      onClick={() => setConfirmDelete({ kind: 'track', id: track.id })}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'playlists' && (
        <section
          id="music-panel-playlists"
          role="tabpanel"
          aria-labelledby="music-tab-playlists"
          className="space-y-4"
        >
          <Button
            variant="outline"
            className="text-xs"
            onClick={() => startEditPlaylist(null)}
          >
            {t('music.playlistNew')}
          </Button>

          {editingPlaylistId && (
            <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
              <Input
                label={t('music.playlistName')}
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
              />
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-ink-faint">
                  {t('music.loop')}
                </span>
                <div
                  className="inline-flex items-center rounded border border-border overflow-hidden"
                  role="group"
                  aria-label={t('music.loop')}
                >
                  {PLAYLIST_LOOP_ICONS.map(({ mode, Icon, labelKey }, index) => {
                    const active = draftPlaylistLoop === mode
                    return (
                      <button
                        key={mode}
                        type="button"
                        title={t(labelKey)}
                        aria-label={t(labelKey)}
                        aria-pressed={active}
                        onClick={() => setDraftPlaylistLoop(mode)}
                        className={`inline-flex items-center justify-center w-8 h-8 transition-colors ${
                          index > 0 ? 'border-l border-border' : ''
                        } ${
                          active
                            ? 'bg-blood/25 text-blood-light'
                            : 'bg-void text-ink-faint hover:text-ink'
                        }`}
                      >
                        <Icon className="w-3 h-3" aria-hidden />
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {tracks.map((track) => {
                  const checked = draftTrackIds.includes(track.id)
                  return (
                    <label
                      key={track.id}
                      className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setDraftTrackIds((ids) =>
                            checked ? ids.filter((id) => id !== track.id) : [...ids, track.id],
                          )
                        }}
                        className="accent-blood"
                      />
                      <span className="truncate">{track.name}</span>
                    </label>
                  )
                })}
              </div>
              {draftTrackIds.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-mono uppercase text-ink-faint">
                    {t('music.playlistOrder')}
                  </p>
                  {draftTrackIds.map((id, index) => (
                    <div key={id} className="flex items-center gap-2 text-xs">
                      <span className="text-ink truncate flex-1">
                        {trackById.get(id)?.name ?? id}
                      </span>
                      <button
                        type="button"
                        aria-label={t('music.moveUp')}
                        className="w-6 h-6 rounded bg-elevated text-ink-faint"
                        disabled={index === 0}
                        onClick={() => {
                          setDraftTrackIds((ids) => {
                            const next = [...ids]
                            ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                            return next
                          })
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={t('music.moveDown')}
                        className="w-6 h-6 rounded bg-elevated text-ink-faint"
                        disabled={index === draftTrackIds.length - 1}
                        onClick={() => {
                          setDraftTrackIds((ids) => {
                            const next = [...ids]
                            ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                            return next
                          })
                        }}
                      >
                        ↓
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="text-xs"
                  disabled={!playlistName.trim() || busy}
                  onClick={() => void savePlaylist()}
                >
                  {t('common.save')}
                </Button>
                <Button
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setEditingPlaylistId(null)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {playlists.length === 0 ? (
            <p className="text-sm text-ink-faint">{t('music.playlistsEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {playlists.map((playlist) => (
                <li
                  key={playlist.id}
                  className="rounded-lg border border-border bg-surface px-3 py-2.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{playlist.name}</p>
                    <p className="text-[10px] text-ink-faint">
                      {t('music.playlistTrackCount', { count: playlist.trackIds.length })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0 items-center">
                    <div
                      className="inline-flex items-center rounded border border-border overflow-hidden"
                      role="group"
                      aria-label={t('music.loop')}
                    >
                      {PLAYLIST_LOOP_ICONS.map(({ mode, Icon, labelKey }, index) => {
                        const active = playlist.loopMode === mode
                        return (
                          <button
                            key={mode}
                            type="button"
                            title={t(labelKey)}
                            aria-label={t(labelKey)}
                            aria-pressed={active}
                            onClick={() => void updatePlaylistLoop(playlist, mode)}
                            className={`inline-flex items-center justify-center w-8 h-8 transition-colors ${
                              index > 0 ? 'border-l border-border' : ''
                            } ${
                              active
                                ? 'bg-blood/25 text-blood-light'
                                : 'bg-void text-ink-faint hover:text-ink'
                            }`}
                          >
                            <Icon className="w-3 h-3" aria-hidden />
                          </button>
                        )
                      })}
                    </div>
                    <div className="relative" data-play-menu>
                      <button
                        type="button"
                        aria-label={t('music.play')}
                        aria-expanded={playMenuPlaylistId === playlist.id}
                        disabled={playlist.trackIds.length === 0}
                        onClick={() => {
                          setPlayMenuTrackId(null)
                          setPlayMenuPlaylistId((id) => (id === playlist.id ? null : playlist.id))
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded border border-emerald-700/60 bg-emerald-700/30 text-emerald-200 hover:bg-emerald-600/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <FaPlay className="w-3 h-3" aria-hidden />
                      </button>
                      {playMenuPlaylistId === playlist.id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-20 min-w-[9rem] rounded border border-border bg-void shadow-lg py-1"
                          role="menu"
                        >
                          {MUSIC_CHANNELS.map((channel) => (
                            <button
                              key={channel}
                              type="button"
                              role="menuitem"
                              onClick={() => void playPlaylistOnChannel(channel, playlist)}
                              className="w-full text-left px-3 py-1.5 text-xs text-ink hover:bg-surface transition-colors"
                            >
                              {t(CHANNEL_LABEL_KEY[channel])}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      className="text-xs"
                      onClick={() => startEditPlaylist(playlist)}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="danger"
                      className="text-xs"
                      disabled={confirmLoading}
                      onClick={() => setConfirmDelete({ kind: 'playlist', id: playlist.id })}
                    >
                      {t('common.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'mixer' && (
        <section
          id="music-panel-mixer"
          role="tabpanel"
          aria-labelledby="music-tab-mixer"
          className="space-y-4"
        >
          {MUSIC_CHANNELS.map((channel) => {
            const state = playback[channel]
            const src = channelSource[channel]
            const loudnessTarget = loudnessTargets[channel] ?? DEFAULT_LOUDNESS_TARGET
            const currentTrack = state.trackId ? trackById.get(state.trackId) : undefined
            const duration = currentTrack?.durationMs ?? 0
            const position = computePositionMs(state, clock || Date.now())
            const activePlaylist =
              state.source === 'playlist' && state.playlistId
                ? playlists.find((p) => p.id === state.playlistId)
                : undefined
            const nextPlaylistIdx = activePlaylist
              ? nextPlaylistIndex(
                activePlaylist.trackIds,
                state.playlistIndex ?? 0,
                state.loopMode === 'playlist' ? 'playlist' : 'off',
              )
              : null
            const nextTrack =
              nextPlaylistIdx != null && activePlaylist
                ? trackById.get(activePlaylist.trackIds[nextPlaylistIdx] ?? '')
                : undefined

            return (
              <div
                key={channel}
                className="rounded-lg border border-border bg-surface p-3 space-y-3"
              >
                <h3 className="font-heading text-sm text-blood-light tracking-widest uppercase">
                  {t(CHANNEL_LABEL_KEY[channel])}
                </h3>

                {(state.status === 'playing' || state.status === 'paused') && currentTrack && (
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-ink-muted truncate">
                      {currentTrack.name}
                      {activePlaylist ? ` · ${activePlaylist.name}` : ''}
                    </p>
                    {activePlaylist ? (
                      <p className="text-[10px] text-ink-faint truncate">
                        {nextTrack
                          ? `${t('music.upNext')}: ${nextTrack.name}`
                          : t('music.playlistEnd')}
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block space-y-1">
                    <span className="text-[10px] font-mono uppercase text-ink-faint">
                      {t('music.source')}
                    </span>
                    <select
                      value={
                        src.mode === 'playlist' && src.playlistId
                          ? `playlist:${src.playlistId}`
                          : src.mode === 'track' && src.trackId
                            ? `track:${src.trackId}`
                            : ''
                      }
                      onChange={(e) => {
                        const value = e.target.value
                        if (value.startsWith('playlist:')) {
                          setChannelSource((prev) => ({
                            ...prev,
                            [channel]: {
                              mode: 'playlist',
                              trackId: '',
                              playlistId: value.slice('playlist:'.length),
                            },
                          }))
                          return
                        }
                        if (value.startsWith('track:')) {
                          setChannelSource((prev) => ({
                            ...prev,
                            [channel]: {
                              mode: 'track',
                              trackId: value.slice('track:'.length),
                              playlistId: '',
                            },
                          }))
                          return
                        }
                        setChannelSource((prev) => ({
                          ...prev,
                          [channel]: { mode: 'track', trackId: '', playlistId: '' },
                        }))
                      }}
                      className="w-full rounded border border-border bg-void px-2 py-1.5 text-sm text-ink"
                    >
                      <option value="">{t('music.selectSource')}</option>
                      {tracks.length > 0 && (
                        <optgroup label={t('music.sourceTrack')}>
                          {tracks.map((track) => (
                            <option key={track.id} value={`track:${track.id}`}>
                              {track.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {playlists.length > 0 && (
                        <optgroup label={t('music.sourcePlaylist')}>
                          {playlists.map((playlist) => (
                            <option key={playlist.id} value={`playlist:${playlist.id}`}>
                              {playlist.name}
                              {playlist.trackIds.length
                                ? ` (${playlist.trackIds.length})`
                                : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {sourceDraftDiffers(src, state) ? (
                      <p className="text-[10px] text-amber-600/90">
                        {t('music.sourcePending')}
                      </p>
                    ) : null}
                  </label>

                  {(src.mode === 'track' && src.trackId) || (src.mode === 'playlist' && src.playlistId) ? (
                    <p className="text-[10px] text-ink-faint">
                      {t('music.loop')}:{' '}
                      {src.mode === 'track'
                        ? t(`music.loopModes.${trackById.get(src.trackId)?.loopMode ?? 'off'}`)
                        : t(`music.loopModes.${playlists.find((p) => p.id === src.playlistId)?.loopMode ?? 'off'}`)}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  {state.source === 'playlist'
                    && (state.status === 'playing' || state.status === 'paused') && (
                    <button
                      type="button"
                      aria-label={t('music.prevTrack')}
                      disabled={(playlists.find((p) => p.id === state.playlistId)?.trackIds.length ?? 0) < 2}
                      onClick={() => void skipPlaylistTrack(channel, -1)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-xs border border-border bg-void text-ink hover:bg-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FaStepBackward className="w-3 h-3" aria-hidden />
                    </button>
                  )}
                  {state.status === 'playing' ? (
                    <button
                      type="button"
                      aria-label={t('music.pause')}
                      onClick={() => void pauseChannel(channel)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-xs bg-blood/80 hover:bg-blood text-white border border-blood transition-colors"
                    >
                      <FaPause className="w-3 h-3" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={
                        state.status === 'paused' ? t('music.resume') : t('music.play')
                      }
                      onClick={() => void playChannel(channel)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-xs bg-emerald-700/80 hover:bg-emerald-600 text-white border border-emerald-700 transition-colors"
                    >
                      <FaPlay className="w-3 h-3" aria-hidden />
                    </button>
                  )}
                  {state.source === 'playlist'
                    && (state.status === 'playing' || state.status === 'paused') && (
                    <button
                      type="button"
                      aria-label={t('music.nextTrack')}
                      disabled={(playlists.find((p) => p.id === state.playlistId)?.trackIds.length ?? 0) < 2}
                      onClick={() => void skipPlaylistTrack(channel, 1)}
                      className="inline-flex items-center justify-center w-8 h-8 rounded text-xs border border-border bg-void text-ink hover:bg-elevated transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <FaStepForward className="w-3 h-3" aria-hidden />
                    </button>
                  )}
                </div>

                <div className="space-y-1 min-h-[5.75rem]">
                  <MusicWaveformSeek
                    peaks={currentTrack?.waveformPeaks}
                    positionMs={duration > 0 ? Math.min(position, duration) : 0}
                    durationMs={duration}
                    ariaLabel={t('music.seek')}
                    onSeek={(ms) => {
                      if (!state.trackId || duration <= 0) return
                      void seekChannel(channel, ms)
                    }}
                    loading={Boolean(state.trackId && waveformLoadingIds[state.trackId])}
                  />
                  {currentTrack && !(currentTrack.waveformPeaks && currentTrack.waveformPeaks.length >= 2) ? (
                    <Button
                      variant="ghost"
                      className="text-xs"
                      loading={Boolean(waveformLoadingIds[currentTrack.id])}
                      onClick={() => pickWaveformFile(currentTrack.id)}
                    >
                      {t('music.waveformFromFile')}
                    </Button>
                  ) : null}
                </div>

                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase text-ink-faint">
                    {t('music.trackVolume')} ({Math.round((state.trackVolume || 1) * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={state.trackVolume ?? 1}
                    onChange={(e) => void setTrackVolume(channel, Number(e.target.value))}
                    className="w-full accent-blood"
                  />
                  <p className="text-[10px] text-ink-faint">{t('music.trackVolumeHint')}</p>
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase text-ink-faint">
                    {t('music.localVolume')} ({Math.round(localVolumes[channel] * 100)}%)
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={localVolumes[channel]}
                    onChange={(e) => setLocalVolume(channel, Number(e.target.value))}
                    className="w-full accent-blood"
                  />
                  <p className="text-[10px] text-ink-faint">{t('music.localVolumeHint')}</p>
                </label>

                <label className="block space-y-1">
                  <span className="text-[10px] font-mono uppercase text-ink-faint">
                    {t('music.loudnessTarget')} (
                    {loudnessTarget <= 0
                      ? t('music.loudnessOff')
                      : `${Math.round(loudnessTarget * 100)}%`}
                    )
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={loudnessTarget}
                    onChange={(e) => void setLoudnessTarget(channel, Number(e.target.value))}
                    className="w-full accent-blood"
                  />
                  <p className="text-[10px] text-ink-faint">{t('music.loudnessTargetHint')}</p>
                </label>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
