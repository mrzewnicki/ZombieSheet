import { useTranslation } from 'react-i18next'
import { FaVolumeUp } from 'react-icons/fa'
import { useMusicSync } from '@/contexts/MusicSyncContext'
import Button from '@/components/ui/Button'
import { MUSIC_CHANNELS } from '@/utils/musicPlayback'

/**
 * Browser autoplay policy blocks remote play() until a user gesture.
 * Shown to every member (incl. GM on a fresh tab) while session audio is playing
 * but this browser has not unlocked playback yet.
 */
export default function MusicListenBanner() {
  const { t } = useTranslation()
  const {
    needsAudioUnlock,
    unlockAudio,
    localVolumes,
    setLocalVolume,
  } = useMusicSync()

  if (!needsAudioUnlock) return null

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded border border-blood/50 bg-void/95 px-4 py-3 shadow-lg backdrop-blur-md"
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-ink font-medium">{t('music.unlockTitle')}</p>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">
            {t('music.unlockHint')}
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          className="shrink-0"
          icon={<FaVolumeUp aria-hidden />}
          onClick={() => void unlockAudio()}
        >
          {t('music.unlockAction')}
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {MUSIC_CHANNELS.map((channel) => (
          <label key={channel} className="block text-[10px] text-ink-faint">
            <span className="block mb-1">{t(`music.channels.${channel}`)}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={localVolumes[channel]}
              onChange={(e) => setLocalVolume(channel, Number(e.target.value))}
              className="w-full accent-blood"
              aria-label={t('music.localVolume')}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
