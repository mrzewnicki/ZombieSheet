import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { useAuth } from '@/contexts/AuthContext'
import type { GameRole } from '@/types'

interface UseGameRoleResult {
  role: GameRole | null
  loading: boolean
}

export function useGameRole(gameId: string): UseGameRoleResult {
  const { user } = useAuth()
  const [role, setRole] = useState<GameRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !gameId) {
      setLoading(false)
      return
    }

    const memberRef = doc(db, 'games', gameId, 'members', user.uid)
    const unsub = onSnapshot(memberRef, (snap) => {
      if (snap.exists()) {
        setRole(snap.data().role as GameRole)
      } else {
        setRole(null)
      }
      setLoading(false)
    })

    return unsub
  }, [user, gameId])

  return { role, loading }
}
