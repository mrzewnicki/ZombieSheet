import { addDoc, collection, deleteField, doc, updateDoc, type FieldValue } from 'firebase/firestore'
import { db } from '@/config/firebase'
import type {
  ArmorCategory,
  ArmorSlotModifiers,
  GearTraitCategory,
  GearTraitDefinition,
  GearTraitPolarity,
  GearTraitScopeCategory,
  GearTraitValues,
} from '@/types'

export const GEAR_TRAITS_COLLECTION = 'gearTraits'

export const DEFAULT_GEAR_TRAIT_CATEGORY: GearTraitCategory = 'common'
export const DEFAULT_GEAR_TRAIT_VALUE = 1

/** Categories visible when picking traits for each editor scope. */
const SCOPE_TRAIT_CATEGORIES: Record<GearTraitScopeCategory, GearTraitCategory[]> = {
  weapon: ['weapon', 'gear', 'common'],
  armor: ['armor', 'gear', 'common'],
  gear: ['gear', 'common'],
}

function categoryPickerRank(
  category: GearTraitCategory,
  scopeCategory: GearTraitScopeCategory,
): number {
  if (category === scopeCategory) return 0
  if (category === 'gear' && scopeCategory !== 'gear') return 1
  if (category === 'common') return 2
  return 3
}

export function normalizeGearTraitCategory(value: unknown): GearTraitCategory {
  if (value === 'weapon' || value === 'armor' || value === 'gear' || value === 'common') {
    return value
  }
  return DEFAULT_GEAR_TRAIT_CATEGORY
}

export function normalizeArmorSlotModifiers(
  value: unknown,
): ArmorSlotModifiers | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const result: ArmorSlotModifiers = {}
  for (const key of ['clothing', 'supplementary', 'main'] as ArmorCategory[]) {
    const n = raw[key]
    if (typeof n === 'number' && Number.isFinite(n) && n !== 0) {
      result[key] = Math.trunc(n)
    }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

export function normalizeGearTraitDefinition(
  id: string,
  data: Record<string, unknown>,
  fallbackCategory: GearTraitCategory = DEFAULT_GEAR_TRAIT_CATEGORY,
): GearTraitDefinition {
  const armorSlotModifiers = normalizeArmorSlotModifiers(data.armorSlotModifiers)
  return {
    id,
    name: String(data.name ?? ''),
    polarity: data.polarity === 'negative' ? 'negative' : 'positive',
    description: String(data.description ?? ''),
    category: data.category != null
      ? normalizeGearTraitCategory(data.category)
      : fallbackCategory,
    ...(armorSlotModifiers ? { armorSlotModifiers } : {}),
  }
}

export function gearTraitPolarityClasses(polarity: GearTraitPolarity): string {
  return polarity === 'positive'
    ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/70'
    : 'bg-red-400/10 text-red-400 border-red-400/70'
}

export function gearTraitTooltipClasses(polarity: GearTraitPolarity): string {
  return polarity === 'positive'
    ? 'bg-emerald-950/95 text-emerald-400 border-emerald-400/70'
    : 'bg-red-950/95 text-red-400 border-red-400/70'
}

export function normalizeTraitValue(value: unknown): number | undefined {
  if (value === '' || value == null) return undefined
  const n = typeof value === 'number' ? value : Number(value)
  if (Number.isInteger(n) && n >= 1 && n <= 10) return n
  return undefined
}

export function resolveTraitValueFromInput(value: unknown): number {
  return normalizeTraitValue(value) ?? DEFAULT_GEAR_TRAIT_VALUE
}

export function pruneTraitValues(
  traitIds: string[],
  traitValues: GearTraitValues | undefined,
): GearTraitValues | undefined {
  if (!traitValues) return undefined
  const next: GearTraitValues = {}
  for (const id of traitIds) {
    const value = normalizeTraitValue(traitValues[id])
    if (value != null && value > DEFAULT_GEAR_TRAIT_VALUE) next[id] = value
  }
  return Object.keys(next).length > 0 ? next : undefined
}

/** Firestore create payload — omit traitValues when empty. */
export function traitFieldsForCreate(
  traitIds: string[] | undefined,
  traitValues: GearTraitValues | undefined,
): { traitIds: string[]; traitValues?: GearTraitValues } {
  const ids = traitIds ?? []
  const pruned = pruneTraitValues(ids, traitValues)
  return pruned ? { traitIds: ids, traitValues: pruned } : { traitIds: ids }
}

/** Firestore update payload — delete traitValues when empty. */
export function traitFieldsForUpdate(
  traitIds: string[] | undefined,
  traitValues: GearTraitValues | undefined,
): { traitIds: string[]; traitValues: GearTraitValues | FieldValue } {
  const ids = traitIds ?? []
  const pruned = pruneTraitValues(ids, traitValues)
  return {
    traitIds: ids,
    traitValues: pruned ?? deleteField(),
  }
}

export function resolveGearTraitValue(
  traitId: string,
  traitValues: GearTraitValues | undefined,
): number {
  return normalizeTraitValue(traitValues?.[traitId]) ?? DEFAULT_GEAR_TRAIT_VALUE
}

/** Trait values of 1 are the default — only show numbers above 1 on chips. */
export function displayTraitValue(value: number | undefined): number | undefined {
  return value != null && value > DEFAULT_GEAR_TRAIT_VALUE ? value : undefined
}

export function resolveGearTraits(
  traitIds: string[] | undefined,
  catalog: GearTraitDefinition[],
): GearTraitDefinition[] {
  if (!traitIds?.length) return []
  const byId = new Map(catalog.map((t) => [t.id, t]))
  return traitIds.map((id) => byId.get(id)).filter(Boolean) as GearTraitDefinition[]
}

export function filterTraitsForScope(
  catalog: GearTraitDefinition[],
  scopeCategory: GearTraitScopeCategory,
): GearTraitDefinition[] {
  const allowed = new Set(SCOPE_TRAIT_CATEGORIES[scopeCategory])
  return catalog.filter((t) => allowed.has(t.category))
}

export function sortTraitsForPicker(
  traits: GearTraitDefinition[],
  scopeCategory: GearTraitScopeCategory,
): GearTraitDefinition[] {
  return [...traits].sort((a, b) => {
    const rankDiff = categoryPickerRank(a.category, scopeCategory)
      - categoryPickerRank(b.category, scopeCategory)
    if (rankDiff !== 0) return rankDiff
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export function findGearTraitByName(
  catalog: GearTraitDefinition[],
  name: string,
  category: GearTraitCategory,
): GearTraitDefinition | undefined {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return undefined
  return catalog.find(
    (t) => t.name.trim().toLowerCase() === normalized && t.category === category,
  )
}

export function findGearTraitByNameInScope(
  catalog: GearTraitDefinition[],
  name: string,
  scopeCategory: GearTraitScopeCategory,
): GearTraitDefinition | undefined {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return undefined

  const inScope = filterTraitsForScope(catalog, scopeCategory)
  for (const category of SCOPE_TRAIT_CATEGORIES[scopeCategory]) {
    const match = inScope.find(
      (t) => t.name.trim().toLowerCase() === normalized && t.category === category,
    )
    if (match) return match
  }
  return undefined
}

type TraitWriteInput = {
  name: string
  polarity: GearTraitPolarity
  description: string
  category: GearTraitCategory
}

export async function upsertGearTrait(
  gameId: string,
  heroId: string,
  catalog: GearTraitDefinition[],
  input: TraitWriteInput,
): Promise<string> {
  const name = input.name.trim()
  if (!name) throw new Error('Trait name is required')

  const existing = findGearTraitByName(catalog, name, input.category)
  if (existing) {
    if (
      existing.polarity !== input.polarity
      || existing.description !== input.description
      || existing.name !== name
    ) {
      await updateDoc(doc(db, 'games', gameId, GEAR_TRAITS_COLLECTION, existing.id), {
        name,
        polarity: input.polarity,
        description: input.description,
        category: input.category,
      })
    }
    return existing.id
  }

  const ref = await addDoc(collection(db, 'games', gameId, GEAR_TRAITS_COLLECTION), {
    name,
    polarity: input.polarity,
    description: input.description,
    category: input.category,
    authHeroId: heroId,
  })
  return ref.id
}

export async function updateGearTrait(
  gameId: string,
  traitId: string,
  catalog: GearTraitDefinition[],
  input: Omit<TraitWriteInput, 'category'>,
): Promise<string> {
  const name = input.name.trim()
  if (!name) throw new Error('Trait name is required')

  const current = catalog.find((t) => t.id === traitId)
  const category = current?.category ?? DEFAULT_GEAR_TRAIT_CATEGORY

  const conflict = findGearTraitByName(catalog, name, category)
  if (conflict && conflict.id !== traitId) {
    await updateDoc(doc(db, 'games', gameId, GEAR_TRAITS_COLLECTION, conflict.id), {
      name,
      polarity: input.polarity,
      description: input.description,
      category,
    })
    return conflict.id
  }

  await updateDoc(doc(db, 'games', gameId, GEAR_TRAITS_COLLECTION, traitId), {
    name,
    polarity: input.polarity,
    description: input.description,
    category,
  })
  return traitId
}
