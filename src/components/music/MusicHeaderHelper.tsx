import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FaMusic } from 'react-icons/fa'
import { useContext } from 'react'
import { LayoutContext } from '@/contexts/LayoutContext'
import { useMusicSync } from '@/contexts/MusicSyncContext'
import { MUSIC_CHANNELS } from '@/utils/musicPlayback'
import type { MusicChannel } from '@/types'

/**
 * Compact session-music strip portaled into the AppLayout header center.
 * Must render under MusicSyncProvider (GameShell). Visible only while audio plays.
 * Hover reveals per-channel local volume sliders.
 */
export default function MusicHeaderHelper() {
  const { t } = useTranslation()
  const layout = useContext(LayoutContext)
  const {
    playback,
    tracks,
    needsAudioUnlock,
    unlockAudio,
    localVolumes,
    setLocalVolume,
  } = useMusicSync()
  const [hovered, setHovered] = useState(false)

  const playing = useMemo(() => {
    const items: Array<{ channel: MusicChannel; name: string }> = []
    for (const channel of MUSIC_CHANNELS) {
      const state = playback[channel]
      if (state.status !== 'playing' || !state.trackId) continue
      const track = tracks.find((tr) => tr.id === state.trackId)
      items.push({
        channel,
        name: track?.name ?? state.trackId,
      })
    }
    return items
  }, [playback, tracks])

  useEffect(() => {
    if (playing.length === 0) setHovered(false)
  }, [playing.length])

  const mount = layout?.headerCenterEl
  if (!mount || playing.length === 0) return null

  const label = playing.length === 1
    ? playing[0].name
    : playing.map((p) => `${t(`music.channels.${p.channel}`)}: ${p.name}`).join(' · ')

  return createPortal(
    <div
      className="relative flex min-w-0 max-w-full items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`
          flex min-w-0 max-w-full items-center gap-2 rounded border px-2 py-1
          transition-colors duration-150
          ${hovered
            ? 'border-blood/40 bg-elevated/80'
            : 'border-border/80 bg-surface/60'}
        `}
      >
        <span
          className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-blood/35 bg-blood/15 text-blood-light"
          aria-hidden
        >
          <FaMusic size={11} className="relative z-[1]" />
          <span className="pointer-events-none absolute inset-0 animate-pulse rounded-sm bg-blood/10" />
        </span>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[9px] uppercase tracking-wide text-ink-faint leading-none">
            {t('music.nowPlaying')}
          </p>
          <p className="truncate text-[11px] text-ink" title={label}>{label}</p>
        </div>

        {needsAudioUnlock && (
          <button
            type="button"
            onClick={() => void unlockAudio()}
            className="shrink-0 rounded bg-blood px-1.5 py-0.5 text-[10px] text-ink hover:bg-blood-light transition-colors"
          >
            {t('music.unlockAction')}
          </button>
        )}
      </div>

      {hovered && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded border border-border bg-void/95 px-2.5 py-2 shadow-lg backdrop-blur-md"
          role="dialog"
          aria-label={t('music.channelVolumes')}
        >
          <p className="mb-1.5 text-[9px] uppercase tracking-wide text-ink-faint">
            {t('music.channelVolumes')}
          </p>
          <div className="space-y-1.5">
            {MUSIC_CHANNELS.map((channel) => (
              <label key={channel} className="flex items-center gap-1.5">
                <span className="w-14 shrink-0 text-[10px] text-ink-muted truncate">
                  {t(`music.channels.${channel}`)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={localVolumes[channel]}
                  onChange={(e) => setLocalVolume(channel, Number(e.target.value))}
                  className="music-vol-slider min-w-0 flex-1"
                  aria-label={t(`music.channels.${channel}`)}
                />
                <span className="w-5 text-right text-[9px] tabular-nums text-ink-faint">
                  {Math.round(localVolumes[channel] * 100)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>,
    mount,
  )
}
