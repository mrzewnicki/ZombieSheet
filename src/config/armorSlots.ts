import type {
  ArmorCategory,
  ArmorItem,
  ArmorSlotModifiers,
  GearTraitDefinition,
} from '@/types'

export const ARMOR_CATEGORIES: ArmorCategory[] = [
  'clothing',
  'supplementary',
  'main',
]

/** Base slot limits from Ekwipunek ochronny (traits may raise/lower these). */
export const DEFAULT_ARMOR_SLOT_LIMITS: Record<ArmorCategory, number> = {
  clothing: 2,
  supplementary: 1,
  main: 1,
}

export const DEFAULT_ARMOR_CATEGORY: ArmorCategory = 'clothing'

export function resolveArmorCategory(
  item: Pick<ArmorItem, 'category'> | ArmorCategory | undefined | null,
): ArmorCategory {
  if (typeof item === 'string') {
    return ARMOR_CATEGORIES.includes(item) ? item : DEFAULT_ARMOR_CATEGORY
  }
  const category = item?.category
  if (category && ARMOR_CATEGORIES.includes(category)) return category
  return DEFAULT_ARMOR_CATEGORY
}

export function countInUseByCategory(
  items: ArmorItem[],
  category: ArmorCategory,
): number {
  return items.filter(
    (item) => item.inUse && resolveArmorCategory(item) === category,
  ).length
}

/**
 * Sum armorSlotModifiers from catalog traits present on in-use armor.
 * Each matching trait on each equipped item contributes once (not × trait value).
 */
export function sumArmorSlotModifiersFromItems(
  items: ArmorItem[],
  catalog: GearTraitDefinition[],
): ArmorSlotModifiers {
  const byId = new Map(catalog.map((trait) => [trait.id, trait]))
  const totals: Record<ArmorCategory, number> = {
    clothing: 0,
    supplementary: 0,
    main: 0,
  }

  for (const item of items) {
    if (!item.inUse) continue
    for (const traitId of item.traitIds ?? []) {
      const mods = byId.get(traitId)?.armorSlotModifiers
      if (!mods) continue
      for (const category of ARMOR_CATEGORIES) {
        const delta = mods[category]
        if (typeof delta === 'number' && delta !== 0) {
          totals[category] += delta
        }
      }
    }
  }

  const result: ArmorSlotModifiers = {}
  for (const category of ARMOR_CATEGORIES) {
    if (totals[category] !== 0) result[category] = totals[category]
  }
  return result
}

export function computeArmorSlotLimits(
  items: ArmorItem[],
  catalog: GearTraitDefinition[] = [],
): Record<ArmorCategory, number> {
  const mods = sumArmorSlotModifiersFromItems(items, catalog)
  const limits = { ...DEFAULT_ARMOR_SLOT_LIMITS }
  for (const category of ARMOR_CATEGORIES) {
    const delta = mods[category] ?? 0
    limits[category] = Math.max(0, DEFAULT_ARMOR_SLOT_LIMITS[category] + delta)
  }
  return limits
}

export function armorSlotLimit(
  category: ArmorCategory,
  limits?: Record<ArmorCategory, number>,
): number {
  return limits?.[category] ?? DEFAULT_ARMOR_SLOT_LIMITS[category]
}

/**
 * Whether item may be (or remain) marked inUse for the given category.
 * Excludes the item itself from the occupied count so category changes work.
 * Slot limit uses traits on currently in-use armor (item not yet equipped
 * does not grant its own bonus until worn).
 */
export function canEquipArmor(
  items: ArmorItem[],
  itemId: string,
  category?: ArmorCategory,
  catalog: GearTraitDefinition[] = [],
): boolean {
  const target = items.find((item) => item.id === itemId)
  if (!target && !category) return false
  const cat = category
    ?? (target ? resolveArmorCategory(target) : DEFAULT_ARMOR_CATEGORY)
  const limits = computeArmorSlotLimits(items, catalog)
  const used = items.filter(
    (item) => (
      item.inUse
      && item.id !== itemId
      && resolveArmorCategory(item) === cat
    ),
  ).length
  return used < armorSlotLimit(cat, limits)
}

export function sumArmorInUse(items: ArmorItem[]): number {
  return items
    .filter((item) => item.inUse)
    .reduce((sum, item) => sum + (item.armorValue ?? 0), 0)
}

export function inUseArmorForCategory(
  items: ArmorItem[],
  category: ArmorCategory,
): ArmorItem[] {
  return items.filter(
    (item) => item.inUse && resolveArmorCategory(item) === category,
  )
}

export function armorSlotModifiersEqual(
  a?: ArmorSlotModifiers,
  b?: ArmorSlotModifiers,
): boolean {
  for (const category of ARMOR_CATEGORIES) {
    if ((a?.[category] ?? 0) !== (b?.[category] ?? 0)) return false
  }
  return true
}

/** Firestore payload: omit empty / delete field when cleared. */
export function armorSlotModifiersPayload(
  modifiers: ArmorSlotModifiers | undefined,
): ArmorSlotModifiers | null {
  if (!modifiers) return null
  const cleaned: ArmorSlotModifiers = {}
  for (const category of ARMOR_CATEGORIES) {
    const n = modifiers[category]
    if (typeof n === 'number' && Number.isFinite(n) && n !== 0) {
      cleaned[category] = Math.trunc(n)
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null
}
