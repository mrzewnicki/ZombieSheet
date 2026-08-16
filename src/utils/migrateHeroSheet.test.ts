import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/firebase', () => ({
  db: {},
}))

import { buildMigratedHeroFields, remapSkillKeys, sanitizeNumericMap } from './migrateHeroSheet'

describe('sanitizeNumericMap', () => {
  it('keeps finite numbers and drops invalid values', () => {
    expect(sanitizeNumericMap({
      str: 3,
      dex: NaN,
      con: undefined as unknown as number,
      wis: 1,
    })).toEqual({ str: 3, wis: 1 })
  })
})

describe('remapSkillKeys', () => {
  it('renames old keys and drops the source key', () => {
    expect(remapSkillKeys(
      { manipulacja: 3, handel: 1 },
      { manipulacja: 'oszustwo' },
    )).toEqual({ oszustwo: 3, handel: 1 })
  })

  it('keeps existing destination value when both keys are present', () => {
    expect(remapSkillKeys(
      { manipulacja: 3, oszustwo: 5 },
      { manipulacja: 'oszustwo' },
    )).toEqual({ oszustwo: 5 })
  })
})

describe('buildMigratedHeroFields', () => {
  const defaults = {
    attributes: { str: 0, dex: 0 },
    skills: { climb: 0, swim: 0, newSkill: 0, oszustwo: 0 },
  }

  it('merges defaults with existing values and sets target version', () => {
    const result = buildMigratedHeroFields(
      { attributes: { str: 3 }, skills: { climb: 2 } },
      2,
      defaults,
    )

    expect(result.attributes).toEqual({ str: 3, dex: 0 })
    expect(result.skills).toEqual({ climb: 2, swim: 0, newSkill: 0, oszustwo: 0 })
    expect(result.sheetVersion).toBe(2)
    expect(result.race).toBe('czlowiek')
    expect(result.vitals).toEqual({
      hp: 3,
      fatigue: 0,
      stress: 0,
      mutationPoints: 0,
      mutationPointsMax: 0,
      contamination: { deathNet: 0, liveCore: 0, anomalie: 0 },
    })
  })

  it('preserves obsolete keys not present in current defaults', () => {
    const result = buildMigratedHeroFields(
      { attributes: { legacy: 1 }, skills: { removed_skill: 4 } },
      2,
      defaults,
    )

    expect(result.attributes).toEqual({ str: 0, dex: 0, legacy: 1 })
    expect(result.skills).toEqual({ climb: 0, swim: 0, newSkill: 0, oszustwo: 0, removed_skill: 4 })
  })

  it('renames manipulacja skill to oszustwo during migration', () => {
    const result = buildMigratedHeroFields(
      { attributes: {}, skills: { manipulacja: 4, handel: 2 } },
      4,
      defaults,
    )

    expect(result.skills.oszustwo).toBe(4)
    expect(result.skills.handel).toBe(2)
    expect(result.skills).not.toHaveProperty('manipulacja')
  })

  it('initializes race and full vitals when missing', () => {
    const result = buildMigratedHeroFields(
      {
        attributes: { kondycja: 2, sila: 1, determinacja: 1, opanowanie: 2 },
        skills: {},
      },
      6,
    )

    expect(result.race).toBe('czlowiek')
    expect(result.vitals).toEqual({
      hp: 8,
      fatigue: 3,
      stress: 3,
      mutationPoints: 0,
      mutationPointsMax: 0,
      contamination: { deathNet: 0, liveCore: 0, anomalie: 0 },
    })
  })

  it('preserves existing vitals and clamps pool maxima', () => {
    const result = buildMigratedHeroFields(
      {
        attributes: { kondycja: 1, sila: 0, determinacja: 0, opanowanie: 0 },
        skills: {},
        race: 'zombie',
        vitals: {
          hp: 2,
          fatigue: 0,
          stress: 9,
          mutationPoints: 4,
          mutationPointsMax: 2,
          contamination: { deathNet: 0, liveCore: 3, anomalie: 1 },
        },
      },
      6,
    )

    expect(result.race).toBe('zombie')
    expect(result.vitals).toEqual({
      hp: 2,
      fatigue: 0,
      stress: 0,
      mutationPoints: 2,
      mutationPointsMax: 2,
      contamination: { deathNet: 0, liveCore: 3, anomalie: 1 },
    })
  })
})
