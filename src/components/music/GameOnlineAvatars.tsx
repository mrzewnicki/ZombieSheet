import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { collection, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useContext } from 'react'
import { LayoutContext } from '@/contexts/LayoutContext'
import Avatar from '@/components/ui/Avatar'
import { memberLabel, type GameMember } from '@/types'
import { MUSIC_PRESENCE_COLLECTION, PRESENCE_ONLINE_MS } from '@/utils/musicPlayback'

const MAX_VISIBLE = 5

interface PresenceRow {
  uid: string
  displayName: string
  photoURL: string
  lastSeenMs: number
}

function toMillis(value: unknown): number {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as Timestamp).toMillis()
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return 0
}

/**
 * Overlapping avatars of players currently in the game (musicPresence heartbeat).
 * Portaled into AppLayout header center next to the session music helper.
 */
export default function GameOnlineAvatars() {
  const { t } = useTranslation()
  const { gameId = '' } = useParams()
  const layout = useContext(LayoutContext)
  const [presence, setPresence] = useState<PresenceRow[]>([])
  const [membersByUid, setMembersByUid] = useState<Record<string, GameMember>>({})
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!gameId) return
    const unsub = onSnapshot(
      collection(db, 'games', gameId, MUSIC_PRESENCE_COLLECTION),
      (snap) => {
        setPresence(snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>
          return {
            uid: d.id,
            displayName: typeof data.displayName === 'string' ? data.displayName : d.id,
            photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
            lastSeenMs: toMillis(data.lastSeen),
          }
        }))
      },
      () => setPresence([]),
    )
    return () => unsub()
  }, [gameId])

  useEffect(() => {
    if (!gameId) return
    const unsub = onSnapshot(
      collection(db, 'games', gameId, 'members'),
      (snap) => {
        const next: Record<string, GameMember> = {}
        for (const d of snap.docs) {
          next[d.id] = { uid: d.id, ...(d.data() as Omit<GameMember, 'uid'>) }
        }
        setMembersByUid(next)
      },
      () => setMembersByUid({}),
    )
    return () => unsub()
  }, [gameId])

  const online = useMemo(() => {
    return presence
      .filter((u) => u.lastSeenMs > 0 && now - u.lastSeenMs < PRESENCE_ONLINE_MS)
      .map((u) => {
        const member = membersByUid[u.uid]
        return {
          uid: u.uid,
          lastSeenMs: u.lastSeenMs,
          photoURL: member?.photoURL || u.photoURL || '',
          name: member ? memberLabel(member) : (u.displayName || u.uid),
        }
      })
      .sort((a, b) => b.lastSeenMs - a.lastSeenMs)
  }, [presence, membersByUid, now])

  const visible = online.slice(0, MAX_VISIBLE)
  const overflow = online.length - visible.length

  const mount = layout?.headerCenterEl
  if (!mount || online.length === 0) return null

  return createPortal(
    <div
      className="flex items-center shrink-0"
      role="group"
      aria-label={t('music.onlinePlayers', { count: online.length })}
      title={t('music.onlinePlayers', { count: online.length })}
    >
      <div className="flex items-center">
        {visible.map((u, index) => (
          <div
            key={u.uid}
            className="relative"
            style={{ marginLeft: index === 0 ? 0 : -8, zIndex: visible.length - index }}
            title={u.name}
          >
            <Avatar
              src={u.photoURL || null}
              name={u.name}
              className="w-7 h-7 border-2 border-void ring-1 ring-border/80"
            />
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="relative flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-void bg-elevated px-1 text-[10px] font-mono text-ink-muted ring-1 ring-border/80"
            style={{ marginLeft: -8, zIndex: 0 }}
            title={online.slice(MAX_VISIBLE).map((u) => u.name).join(', ')}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>,
    mount,
  )
}
