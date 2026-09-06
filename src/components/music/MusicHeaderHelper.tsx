import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { FaChevronDown } from 'react-icons/fa'
import { useContext } from 'react'
import { LayoutContext } from '@/contexts/LayoutContext'
import { useMusicSync } from '@/contexts/MusicSyncContext'
import { MUSIC_CHANNELS } from '@/utils/musicPlayback'
import type { MusicChannel } from '@/types'

/**
 * Compact session-music strip portaled into the AppLayout header center.
 * Must render under MusicSyncProvider (GameShell). Visible only while audio plays.
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
    setLocalMasterVolume,
  } = useMusicSync()
  const [channelsOpen, setChannelsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
    if (!channelsOpen) return
    function onPointerDown(event: PointerEvent) {
      const root = rootRef.current
      if (!root) return
      if (event.target instanceof Node && root.contains(event.target)) return
      setChannelsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [channelsOpen])

  useEffect(() => {
    if (playing.length === 0) setChannelsOpen(false)
  }, [playing.length])

  const mount = layout?.headerCenterEl
  if (!mount || playing.length === 0) return null

  const label = playing.length === 1
    ? playing[0].name
    : playing.map((p) => `${t(`music.channels.${p.channel}`)}: ${p.name}`).join(' · ')

  return createPortal(
    <div ref={rootRef} className="relative flex min-w-0 max-w-full items-center gap-1.5">
      <div className="flex min-w-0 max-w-full items-center gap-1.5 rounded border border-border/80 bg-surface/60 px-2 py-0.5">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[9px] uppercase tracking-wide text-ink-faint leading-none">
            {t('music.nowPlaying')}
          </p>
          <p className="truncate text-[11px] text-ink" title={label}>{label}</p>
        </div>

        <label className="hidden sm:flex shrink-0 items-center gap-1" title={t('music.masterVolume')}>
          <span className="sr-only">{t('music.masterVolume')}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={localVolumes.master}
            onChange={(e) => setLocalMasterVolume(Number(e.target.value))}
            className="music-vol-slider w-14"
            aria-label={t('music.masterVolume')}
          />
          <span className="w-5 text-right text-[9px] tabular-nums text-ink-faint">
            {Math.round(localVolumes.master * 100)}
          </span>
        </label>

        <button
          type="button"
          onClick={() => setChannelsOpen((open) => !open)}
          className="shrink-0 inline-flex items-center gap-0.5 rounded border border-border px-1 py-0.5 text-[9px] text-ink-muted hover:text-ink hover:border-border-light transition-colors"
          aria-expanded={channelsOpen}
          aria-label={t('music.channelVolumes')}
          title={t('music.channelVolumes')}
        >
          <span>{t('music.channelsShort')}</span>
          <FaChevronDown
            size={8}
            aria-hidden
            className={`transition-transform ${channelsOpen ? 'rotate-180' : ''}`}
          />
        </button>

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

      {channelsOpen && (
        <div
          className="absolute left-1/2 top-full z-50 mt-1 w-52 -translate-x-1/2 rounded border border-border bg-void/95 px-2.5 py-2 shadow-lg backdrop-blur-md"
          role="dialog"
          aria-label={t('music.channelVolumes')}
        >
          <label className="mb-1.5 flex items-center gap-1.5 sm:hidden">
            <span className="w-12 shrink-0 text-[9px] text-ink-faint">{t('music.masterVolume')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={localVolumes.master}
              onChange={(e) => setLocalMasterVolume(Number(e.target.value))}
              className="music-vol-slider min-w-0 flex-1"
              aria-label={t('music.masterVolume')}
            />
            <span className="w-5 text-right text-[9px] tabular-nums text-ink-faint">
              {Math.round(localVolumes.master * 100)}
            </span>
          </label>
          <div className="space-y-1">
            {MUSIC_CHANNELS.map((channel) => (
              <label key={channel} className="flex items-center gap-1.5">
                <span className="w-12 shrink-0 text-[10px] text-ink-muted truncate">
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
