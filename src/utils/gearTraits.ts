import { addDoc, collection, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import type { GearTraitDefinition, GearTraitPolarity } from '@/types'

export const GEAR_TRAITS_COLLECTION = 'gearTraits'

export function gearTraitPolarityClasses(polarity: GearTraitPolarity): string {
  return polarity === 'positive'
    ? 'bg-emerald-950/50 text-emerald-400/90 border-emerald-800/40'
    : 'bg-red-950/50 text-red-400/90 border-red-800/40'
}

export function gearTraitTooltipClasses(polarity: GearTraitPolarity): string {
  return polarity === 'positive'
    ? 'bg-emerald-950/95 text-emerald-400/90 border-emerald-800/40'
    : 'bg-red-950/95 text-red-400/90 border-red-800/40'
}

export function resolveGearTraits(
  traitIds: string[] | undefined,
  catalog: GearTraitDefinition[],
): GearTraitDefinition[] {
  if (!traitIds?.length) return []
  const byId = new Map(catalog.map((t) => [t.id, t]))
  return traitIds.map((id) => byId.get(id)).filter(Boolean) as GearTraitDefinition[]
}

export function findGearTraitByName(
  catalog: GearTraitDefinition[],
  name: string,
): GearTraitDefinition | undefined {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return undefined
  return catalog.find((t) => t.name.trim().toLowerCase() === normalized)
}

export async function upsertGearTrait(
  gameId: string,
  heroId: string,
  catalog: GearTraitDefinition[],
  input: { name: string; polarity: GearTraitPolarity; description: string },
): Promise<string> {
  const name = input.name.trim()
  if (!name) throw new Error('Trait name is required')

  const existing = findGearTraitByName(catalog, name)
  if (existing) {
    if (existing.polarity !== input.polarity || existing.description !== input.description) {
      await updateDoc(doc(db, 'games', gameId, GEAR_TRAITS_COLLECTION, existing.id), {
        polarity: input.polarity,
        description: input.description,
      })
    }
    return existing.id
  }

  const ref = await addDoc(collection(db, 'games', gameId, GEAR_TRAITS_COLLECTION), {
    name,
    polarity: input.polarity,
    description: input.description,
    authHeroId: heroId,
  })
  return ref.id
}
