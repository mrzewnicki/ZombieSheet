import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTE_GROUPS,
  DEFAULT_ATTRIBUTES,
  DEFAULT_SKILLS,
  SHEET_VERSION,
  SKILL_CATEGORIES,
} from './rpg-system'

describe('rpg-system schema', () => {
  const attributeKeys = ATTRIBUTE_GROUPS.flatMap((g) => g.attributes.map((a) => a.key))
  const skillKeys = SKILL_CATEGORIES.flatMap((c) => c.skills.map((s) => s.key))

  it('has a positive sheet version', () => {
    expect(SHEET_VERSION).toBeGreaterThan(0)
  })

  it('initializes every attribute key to 0', () => {
    for (const key of attributeKeys) {
      expect(DEFAULT_ATTRIBUTES[key]).toBe(0)
    }
    expect(Object.keys(DEFAULT_ATTRIBUTES).sort()).toEqual([...attributeKeys].sort())
  })

  it('initializes every skill key to 0', () => {
    for (const key of skillKeys) {
      expect(DEFAULT_SKILLS[key]).toBe(0)
    }
    expect(Object.keys(DEFAULT_SKILLS).sort()).toEqual([...skillKeys].sort())
  })
})
