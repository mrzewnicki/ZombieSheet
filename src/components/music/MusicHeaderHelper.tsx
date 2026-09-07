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
 * Compact session-music control portaled into the AppLayout header center.
 * Icon only on the bar; hover reveals per-channel track names + local volumes.
 */
export default function MusicHeaderHelper() {
  const { t } = useTranslation()
  const layout = useContext(LayoutContext)
  const {
    playback,
    tracks,
    localVolumes,
    setLocalVolume,
  } = useMusicSync()
  const [hovered, setHovered] = useState(false)

  const channelRows = useMemo(() => {
    return MUSIC_CHANNELS.map((channel) => {
      const state = playback[channel]
      const active = (state.status === 'playing' || state.status === 'paused') && Boolean(state.trackId)
      const track = active
        ? tracks.find((tr) => tr.id === state.trackId)
        : undefined
      return {
        channel,
        status: state.status,
        trackName: active ? (track?.name ?? state.trackId) : null,
      }
    })
  }, [playback, tracks])

  const anyActive = channelRows.some((row) => row.trackName != null && row.status === 'playing')

  useEffect(() => {
    if (!anyActive) setHovered(false)
  }, [anyActive])

  const mount = layout?.headerCenterEl
  if (!mount || !anyActive) return null

  return createPortal(
    <div
      className="relative flex shrink-0 items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className={`
          relative flex h-8 w-8 items-center justify-center rounded border
          transition-colors duration-150
          ${hovered
            ? 'border-blood/40 bg-elevated/80 text-blood-light'
            : 'border-border/80 bg-surface/60 text-blood-light'}
        `}
        aria-label={t('music.channelVolumes')}
        aria-expanded={hovered}
      >
        <FaMusic size={12} className="relative z-[1]" aria-hidden />
        <span className="pointer-events-none absolute inset-0 animate-pulse rounded bg-blood/10" aria-hidden />
      </button>

      {hovered && (
        <div
          className="absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 pt-0.5"
          role="dialog"
          aria-label={t('music.channelVolumes')}
        >
          <div className="rounded border border-border bg-void/95 px-2.5 py-2 shadow-lg backdrop-blur-md">
            <p className="mb-1.5 text-[9px] uppercase tracking-wide text-ink-faint">
              {t('music.channelVolumes')}
            </p>
            <div className="space-y-2">
              {channelRows.map(({ channel, trackName, status }) => (
                <div key={channel} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] text-ink-muted shrink-0">
                      {t(`music.channels.${channel}`)}
                    </span>
                    <span
                      className={`min-w-0 truncate text-[10px] ${
                        trackName ? 'text-ink' : 'text-ink-faint'
                      }`}
                      title={trackName ?? undefined}
                    >
                      {trackName
                        ?? t('music.status.idle')}
                      {trackName && status === 'paused'
                        ? ` · ${t('music.status.paused')}`
                        : ''}
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={localVolumes[channel]}
                      onChange={(e) => setLocalVolume(channel, Number(e.target.value))}
                      className="music-vol-slider min-w-0 flex-1"
                      aria-label={`${t(`music.channels.${channel}`)} — ${t('music.localVolume')}`}
                    />
                    <span className="w-5 text-right text-[9px] tabular-nums text-ink-faint">
                      {Math.round(localVolumes[channel] * 100)}
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>,
    mount,
  )
}
