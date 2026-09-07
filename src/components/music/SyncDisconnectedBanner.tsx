/**
 * Small toast-like banner shown when the Workers music-sync WebSocket
 * is disconnected and retrying. Hidden in Firestore mode.
 */
import { useMusicSync } from '@/contexts/MusicSyncContext'
import { FEATURES } from '@/config/features'
import { useTranslation } from 'react-i18next'

export default function SyncDisconnectedBanner() {
  const { t } = useTranslation()
  const { syncDisconnected } = useMusicSync()

  // Only relevant in workers mode
  if (FEATURES.musicSync !== 'workers') return null
  if (!syncDisconnected) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-amber-900/90 text-amber-100 text-sm shadow-lg border border-amber-700 backdrop-blur-sm"
    >
      ⚠ {t('music.syncDisconnected', 'Sync niedostępny — muzyka może nie być zsynchronizowana')}
    </div>
  )
}
