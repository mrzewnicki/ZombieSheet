import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { CampaignNpc } from '@/types'
import {
  CAMPAIGN_NPCS_COLLECTION,
  normalizeCampaignNpc,
} from '@/utils/campaignNpcs'

function sortNpcs(npcs: CampaignNpc[]): CampaignNpc[] {
  return [...npcs].sort((a, b) =>
    (a.name || a.role).localeCompare(b.name || b.role, undefined, { sensitivity: 'base' }),
  )
}

export function useCampaignNpcs(gameId: string) {
  const [npcs, setNpcs] = useState<CampaignNpc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const unsub = onSnapshot(
      collection(db, 'games', gameId, CAMPAIGN_NPCS_COLLECTION),
      (snap) => {
        setNpcs(sortNpcs(snap.docs.map((d) => normalizeCampaignNpc(d.id, d.data() as Record<string, unknown>))))
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setNpcs([])
        setLoading(false)
      },
    )
    return unsub
  }, [gameId])

  return { npcs, loading, error }
}
