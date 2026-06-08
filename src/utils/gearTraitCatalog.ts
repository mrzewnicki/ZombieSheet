import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import type {
  GearTraitCategory,
  GearTraitDefinition,
  GearTraitPolarity,
} from '@/types'
import {
  findGearTraitByName,
  GEAR_TRAITS_COLLECTION,
} from '@/utils/gearTraits'
import { unassignTraitFromAllItems } from '@/utils/traitAssignments'

export const GEAR_TRAIT_CHANGES_COLLECTION = 'gearTraitChanges'

/** Column order for the traits catalog table. */
export const TRAIT_TABLE_CATEGORIES: GearTraitCategory[] = ['common', 'gear', 'weapon', 'armor']

export interface TraitTableRow {
  nameKey: string
  displayName: string
  polarity: GearTraitPolarity
  byCategory: Partial<Record<GearTraitCategory, GearTraitDefinition>>
}

export function isTraitDescriptionEmpty(description: string | undefined): boolean {
  if (!description) return true
  const stripped = description
    .replace(/<[^>]*>/g, '')
    .replace(/[#*_`~\[\]()>-]/g, '')
    .trim()
  return stripped.length === 0
}

export function traitDescriptionPreview(description: string): string {
  const plain = description
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return ''
  return plain.length > 80 ? `${plain.slice(0, 77)}…` : plain
}

export function groupTraitsForTable(catalog: GearTraitDefinition[]): TraitTableRow[] {
  const rows = new Map<string, TraitTableRow>()

  for (const trait of catalog) {
    const nameKey = trait.name.trim().toLowerCase()
    if (!nameKey) continue

    let row = rows.get(nameKey)
    if (!row) {
      row = {
        nameKey,
        displayName: trait.name.trim(),
        polarity: trait.polarity,
        byCategory: {},
      }
      rows.set(nameKey, row)
    }

    row.byCategory[trait.category] = trait
    if (trait.name.trim().length > row.displayName.length) {
      row.displayName = trait.name.trim()
    }
  }

  for (const row of rows.values()) {
    for (const category of TRAIT_TABLE_CATEGORIES) {
      const trait = row.byCategory[category]
      if (trait) {
        row.polarity = trait.polarity
        break
      }
    }
  }

  return [...rows.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }),
  )
}

interface ChangeAuthor {
  uid: string
  displayName: string
}

interface LogChangeInput {
  gameId: string
  traitId?: string
  traitName: string
  category: GearTraitCategory
  field: string
  label: string
  oldValue: unknown
  newValue: unknown
  author: ChangeAuthor
}

async function logGearTraitChange(input: LogChangeInput) {
  await addDoc(collection(db, 'games', input.gameId, GEAR_TRAIT_CHANGES_COLLECTION), {
    traitId: input.traitId ?? null,
    traitName: input.traitName,
    category: input.category,
    field: input.field,
    label: input.label,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
    changedByUid: input.author.uid,
    changedByName: input.author.displayName,
    changedAt: serverTimestamp(),
  })
}

async function removeTraitCatalogEntry(
  gameId: string,
  existing: GearTraitDefinition,
  author: ChangeAuthor,
  descriptionLabel: string,
) {
  await unassignTraitFromAllItems(gameId, existing.id)
  await deleteDoc(doc(db, 'games', gameId, GEAR_TRAITS_COLLECTION, existing.id))
  await logGearTraitChange({
    gameId,
    traitId: existing.id,
    traitName: existing.name,
    category: existing.category,
    field: 'description',
    label: descriptionLabel,
    oldValue: existing.description,
    newValue: null,
    author,
  })
}

export async function createTraitCatalogPlaceholder(
  gameId: string,
  catalog: GearTraitDefinition[],
  params: {
    traitName: string
    category: GearTraitCategory
    polarity: GearTraitPolarity
    author: ChangeAuthor
    descriptionLabel: string
  },
): Promise<void> {
  const name = params.traitName.trim()
  if (!name) throw new Error('Trait name is required')

  const existing = findGearTraitByName(catalog, name, params.category)
  if (existing) return

  const ref = await addDoc(collection(db, 'games', gameId, GEAR_TRAITS_COLLECTION), {
    name,
    polarity: params.polarity,
    description: '',
    category: params.category,
  })

  await logGearTraitChange({
    gameId,
    traitId: ref.id,
    traitName: name,
    category: params.category,
    field: 'description',
    label: params.descriptionLabel,
    oldValue: null,
    newValue: '',
    author: params.author,
  })
}

export async function saveTraitCatalogDescription(
  gameId: string,
  catalog: GearTraitDefinition[],
  params: {
    traitName: string
    category: GearTraitCategory
    polarity: GearTraitPolarity
    description: string
    author: ChangeAuthor
    descriptionLabel: string
  },
): Promise<void> {
  const name = params.traitName.trim()
  if (!name) throw new Error('Trait name is required')

  const existing = findGearTraitByName(catalog, name, params.category)
  const description = params.description
  const clearing = isTraitDescriptionEmpty(description)

  if (existing) {
    if (clearing) {
      await removeTraitCatalogEntry(gameId, existing, params.author, params.descriptionLabel)
      return
    }

    if (existing.description === description) return

    await updateDoc(doc(db, 'games', gameId, GEAR_TRAITS_COLLECTION, existing.id), {
      description,
    })
    await logGearTraitChange({
      gameId,
      traitId: existing.id,
      traitName: existing.name,
      category: params.category,
      field: 'description',
      label: params.descriptionLabel,
      oldValue: existing.description,
      newValue: description,
      author: params.author,
    })
    return
  }

  if (clearing) return

  const ref = await addDoc(collection(db, 'games', gameId, GEAR_TRAITS_COLLECTION), {
    name,
    polarity: params.polarity,
    description,
    category: params.category,
  })

  await logGearTraitChange({
    gameId,
    traitId: ref.id,
    traitName: name,
    category: params.category,
    field: 'description',
    label: params.descriptionLabel,
    oldValue: null,
    newValue: description,
    author: params.author,
  })
}

export async function updateTraitRowPolarity(
  gameId: string,
  row: TraitTableRow,
  polarity: GearTraitPolarity,
  author: ChangeAuthor,
  polarityLabel: string,
): Promise<void> {
  const variants = TRAIT_TABLE_CATEGORIES
    .map((category) => row.byCategory[category])
    .filter(Boolean) as GearTraitDefinition[]

  if (variants.length === 0 || variants.every((t) => t.polarity === polarity)) return

  const batch = writeBatch(db)
  for (const trait of variants) {
    if (trait.polarity === polarity) continue
    batch.update(doc(db, 'games', gameId, GEAR_TRAITS_COLLECTION, trait.id), { polarity })
  }
  await batch.commit()

  for (const trait of variants) {
    if (trait.polarity === polarity) continue
    await logGearTraitChange({
      gameId,
      traitId: trait.id,
      traitName: trait.name,
      category: trait.category,
      field: 'polarity',
      label: polarityLabel,
      oldValue: trait.polarity,
      newValue: polarity,
      author,
    })
  }
}

export function resolveRowPolarity(row: TraitTableRow): GearTraitPolarity {
  for (const category of TRAIT_TABLE_CATEGORIES) {
    const trait = row.byCategory[category]
    if (trait) return trait.polarity
  }
  return 'positive'
}
