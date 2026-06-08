import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { heroFullName, type Hero } from '@/types'
import { traitFieldsForUpdate } from '@/utils/gearTraits'

export interface TraitAssignment {
  heroId: string
  heroName: string
  itemType: 'weapon' | 'armor' | 'inventory'
  itemId: string
  itemName: string
}

const GEAR_SUBCOLLECTIONS = [
  { name: 'weapons' as const, itemType: 'weapon' as const },
  { name: 'armor' as const, itemType: 'armor' as const },
  { name: 'inventory' as const, itemType: 'inventory' as const },
]

type GearItemDoc = {
  id: string
  name?: string
  traitIds?: string[]
  traitValues?: Record<string, number>
}

export async function findTraitAssignments(
  gameId: string,
  traitId: string,
): Promise<TraitAssignment[]> {
  const heroesSnap = await getDocs(collection(db, 'games', gameId, 'heroes'))
  const assignments: TraitAssignment[] = []

  await Promise.all(
    heroesSnap.docs.map(async (heroDoc) => {
      const hero = { id: heroDoc.id, ...heroDoc.data() } as Hero
      const heroName = heroFullName(hero)

      await Promise.all(
        GEAR_SUBCOLLECTIONS.map(async ({ name, itemType }) => {
          const itemsSnap = await getDocs(
            collection(db, 'games', gameId, 'heroes', heroDoc.id, name),
          )

          for (const itemDoc of itemsSnap.docs) {
            const item = { id: itemDoc.id, ...itemDoc.data() } as GearItemDoc
            if (!item.traitIds?.includes(traitId)) continue

            assignments.push({
              heroId: heroDoc.id,
              heroName,
              itemType,
              itemId: item.id,
              itemName: item.name?.trim() || '—',
            })
          }
        }),
      )
    }),
  )

  return assignments.sort((a, b) => {
    const heroCmp = a.heroName.localeCompare(b.heroName, undefined, { sensitivity: 'base' })
    if (heroCmp !== 0) return heroCmp
    return a.itemName.localeCompare(b.itemName, undefined, { sensitivity: 'base' })
  })
}

export async function unassignTraitFromAllItems(gameId: string, traitId: string): Promise<void> {
  const assignments = await findTraitAssignments(gameId, traitId)
  if (assignments.length === 0) return

  const collectionByType = {
    weapon: 'weapons',
    armor: 'armor',
    inventory: 'inventory',
  } as const

  await Promise.all(
    assignments.map(async (assignment) => {
      const itemRef = doc(
        db,
        'games',
        gameId,
        'heroes',
        assignment.heroId,
        collectionByType[assignment.itemType],
        assignment.itemId,
      )
      const itemSnap = await getDoc(itemRef)
      if (!itemSnap.exists()) return

      const data = itemSnap.data() as GearItemDoc
      const nextTraitIds = (data.traitIds ?? []).filter((id) => id !== traitId)

      await updateDoc(itemRef, traitFieldsForUpdate(nextTraitIds, data.traitValues))
    }),
  )
}
