import { describe, expect, it } from 'vitest'
import { buildMigratedHeroFields } from './migrateHeroSheet'

describe('buildMigratedHeroFields', () => {
  const defaults = {
    attributes: { str: 0, dex: 0 },
    skills: { climb: 0, swim: 0, newSkill: 0 },
  }

  it('merges defaults with existing values and sets target version', () => {
    const result = buildMigratedHeroFields(
      { attributes: { str: 3 }, skills: { climb: 2 } },
      2,
      defaults,
    )

    expect(result).toEqual({
      attributes: { str: 3, dex: 0 },
      skills: { climb: 2, swim: 0, newSkill: 0 },
      sheetVersion: 2,
    })
  })

  it('preserves obsolete keys not present in current defaults', () => {
    const result = buildMigratedHeroFields(
      { attributes: { legacy: 1 }, skills: { removed_skill: 4 } },
      2,
      defaults,
    )

    expect(result.attributes).toEqual({ str: 0, dex: 0, legacy: 1 })
    expect(result.skills).toEqual({ climb: 0, swim: 0, newSkill: 0, removed_skill: 4 })
  })
})
