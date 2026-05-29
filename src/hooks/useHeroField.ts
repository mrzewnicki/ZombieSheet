import { doc, collection, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'

interface UseHeroFieldResult {
  updateField: (
    fieldKey: string,
    label: string,
    newValue: unknown,
    oldValue: unknown
  ) => Promise<void>
}

export function useHeroField(gameId: string, heroId: string): UseHeroFieldResult {
  async function updateField(
    fieldKey: string,
    label: string,
    newValue: unknown,
    oldValue: unknown
  ) {
    const heroRef = doc(db, 'games', gameId, 'heroes', heroId)
    const changeRef = doc(collection(db, 'games', gameId, 'heroes', heroId, 'changes'))

    const batch = writeBatch(db)
    batch.update(heroRef, {
      [fieldKey]: newValue,
      updatedAt: serverTimestamp(),
    })
    batch.set(changeRef, {
      field: fieldKey,
      label,
      oldValue: oldValue ?? null,
      newValue: newValue ?? null,
      changedAt: serverTimestamp(),
    })

    await batch.commit()
  }

  return { updateField }
}
