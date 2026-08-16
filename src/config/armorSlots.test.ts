import { describe, expect, it } from 'vitest'
import type { ArmorItem, GearTraitDefinition } from '@/types'
import {
  canEquipArmor,
  computeArmorSlotLimits,
  countInUseByCategory,
  resolveArmorCategory,
  sumArmorInUse,
} from './armorSlots'

function armor(partial: Partial<ArmorItem> & Pick<ArmorItem, 'id'>): ArmorItem {
  return {
    name: partial.name ?? partial.id,
    description: '',
    armorValue: partial.armorValue ?? 0,
    imageUrl: '',
    icon: '',
    color: '',
    ...partial,
  }
}

function trait(
  partial: Partial<GearTraitDefinition> & Pick<GearTraitDefinition, 'id'>,
): GearTraitDefinition {
  return {
    name: partial.name ?? partial.id,
    polarity: 'positive',
    description: '',
    category: 'armor',
    ...partial,
  }
}

describe('resolveArmorCategory', () => {
  it('falls back to clothing when missing or unknown', () => {
    expect(resolveArmorCategory({})).toBe('clothing')
    expect(resolveArmorCategory({ category: 'main' })).toBe('main')
    expect(resolveArmorCategory('bogus' as never)).toBe('clothing')
  })
})

describe('canEquipArmor', () => {
  const items = [
    armor({ id: 'a', category: 'main', inUse: true, armorValue: 3 }),
    armor({ id: 'b', category: 'main', inUse: false, armorValue: 2 }),
    armor({ id: 'c', category: 'clothing', inUse: true }),
    armor({ id: 'd', category: 'clothing', inUse: true }),
    armor({ id: 'e', category: 'clothing', inUse: false }),
    armor({ id: 'f', category: 'supplementary', inUse: false }),
  ]

  it('blocks equipping when category slots are full', () => {
    expect(canEquipArmor(items, 'b')).toBe(false)
    expect(canEquipArmor(items, 'e')).toBe(false)
    expect(canEquipArmor(items, 'f')).toBe(true)
  })

  it('allows keeping an already-equipped item in the same category', () => {
    expect(canEquipArmor(items, 'a')).toBe(true)
    expect(canEquipArmor(items, 'a', 'main')).toBe(true)
  })

  it('blocks moving an equipped item into a full category', () => {
    expect(canEquipArmor(items, 'c', 'main')).toBe(false)
  })

  it('counts and sums in-use armor', () => {
    expect(countInUseByCategory(items, 'clothing')).toBe(2)
    expect(sumArmorInUse(items)).toBe(3)
  })

  it('raises limits from traits on in-use armor', () => {
    const catalog = [
      trait({ id: 'extra', armorSlotModifiers: { clothing: 1 } }),
    ]
    const withTrait = [
      armor({ id: 'c', category: 'clothing', inUse: true, traitIds: ['extra'] }),
      armor({ id: 'd', category: 'clothing', inUse: true }),
      armor({ id: 'e', category: 'clothing', inUse: false }),
    ]
    expect(computeArmorSlotLimits(withTrait, catalog).clothing).toBe(3)
    expect(canEquipArmor(withTrait, 'e', undefined, catalog)).toBe(true)
  })

  it('lowers limits from negative trait modifiers', () => {
    const catalog = [
      trait({
        id: 'burden',
        polarity: 'negative',
        armorSlotModifiers: { main: -1 },
      }),
    ]
    const withTrait = [
      armor({ id: 'a', category: 'main', inUse: true, traitIds: ['burden'] }),
      armor({ id: 'b', category: 'main', inUse: false }),
    ]
    expect(computeArmorSlotLimits(withTrait, catalog).main).toBe(0)
    expect(canEquipArmor(withTrait, 'b', undefined, catalog)).toBe(false)
  })
})
