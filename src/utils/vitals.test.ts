import { describe, expect, it } from 'vitest'
import {
  adjustContaminationTotal,
  adjustCurrentForMaxChange,
  adjustVitalsForMaxChange,
  computeMaxContamination,
  computeMaxFatigue,
  computeMaxHp,
  computeMaxStress,
  computeVitalMaxes,
  contaminationTotal,
  defaultVitals,
  dominantContaminationTrack,
  resolveHeroRace,
  resolveHeroVitals,
} from './vitals'

describe('computeMaxHp', () => {
  it('uses (2×kondycja) + siła + race bonus', () => {
    expect(computeMaxHp({ kondycja: 2, sila: 1 }, 'czlowiek')).toBe(2 * 2 + 1 + 3)
    expect(computeMaxHp({ kondycja: 2, sila: 1 }, 'zombie')).toBe(2 * 2 + 1 + 5)
  })

  it('treats missing attributes as 0', () => {
    expect(computeMaxHp({}, 'zwierze')).toBe(3)
  })
})

describe('computeMaxFatigue / computeMaxStress / computeMaxContamination', () => {
  it('sums kondycja + determinacja for fatigue', () => {
    expect(computeMaxFatigue({ kondycja: 3, determinacja: 2 })).toBe(5)
  })

  it('sums opanowanie + determinacja for stress', () => {
    expect(computeMaxStress({ opanowanie: 4, determinacja: 1 })).toBe(5)
  })

  it('sums kondycja + opanowanie + determinacja for contamination', () => {
    expect(computeMaxContamination({ kondycja: 2, opanowanie: 3, determinacja: 1 })).toBe(6)
  })
})

describe('resolveHeroRace', () => {
  it('falls back to czlowiek for unknown values', () => {
    expect(resolveHeroRace('czlowiek')).toBe('czlowiek')
    expect(resolveHeroRace('elf')).toBe('czlowiek')
    expect(resolveHeroRace(undefined)).toBe('czlowiek')
  })
})

describe('defaultVitals / resolveHeroVitals', () => {
  it('fills pools to max and starts mutation/contamination empty', () => {
    const attrs = { kondycja: 2, sila: 1, determinacja: 3, opanowanie: 1 }
    const max = computeVitalMaxes(attrs, 'czlowiek', 0)
    expect(defaultVitals(attrs, 'czlowiek')).toEqual({
      hp: max.hp,
      fatigue: max.fatigue,
      stress: max.stress,
      mutationPoints: 0,
      mutationPointsMax: 0,
      contamination: { deathNet: 0, liveCore: 0, anomalie: 0 },
    })
  })

  it('clamps pool values and preserves contamination over max', () => {
    const attrs = { kondycja: 1, sila: 0, determinacja: 0, opanowanie: 0 }
    const max = computeVitalMaxes(attrs, 'czlowiek', 2)
    expect(resolveHeroVitals({
      hp: 99,
      fatigue: -2,
      stress: 0,
      mutationPoints: 9,
      mutationPointsMax: 2,
      contamination: { deathNet: 1, liveCore: 5, anomalie: 0 },
    }, attrs, 'czlowiek')).toEqual({
      hp: max.hp,
      fatigue: 0,
      stress: 0,
      mutationPoints: 2,
      mutationPointsMax: 2,
      contamination: { deathNet: 1, liveCore: 5, anomalie: 0 },
    })
  })
})

describe('contamination helpers', () => {
  it('sums tracks and picks the dominant one', () => {
    const c = { deathNet: 2, liveCore: 5, anomalie: 1 }
    expect(contaminationTotal(c)).toBe(8)
    expect(dominantContaminationTrack(c)).toBe('liveCore')
  })

  it('grows LiveCore when increasing total and shrinks the highest track when decreasing', () => {
    expect(adjustContaminationTotal(
      { deathNet: 2, liveCore: 1, anomalie: 0 },
      5,
    )).toEqual({ deathNet: 2, liveCore: 3, anomalie: 0 })

    expect(adjustContaminationTotal(
      { deathNet: 4, liveCore: 1, anomalie: 0 },
      3,
    )).toEqual({ deathNet: 2, liveCore: 1, anomalie: 0 })
  })
})

describe('adjustCurrentForMaxChange', () => {
  it('keeps full pools full when max grows', () => {
    expect(adjustCurrentForMaxChange(5, 5, 8)).toBe(8)
  })

  it('clamps partial pools when max shrinks', () => {
    expect(adjustCurrentForMaxChange(4, 6, 3)).toBe(3)
  })

  it('leaves partial pools unchanged when still under new max', () => {
    expect(adjustCurrentForMaxChange(2, 5, 7)).toBe(2)
  })
})

describe('adjustVitalsForMaxChange', () => {
  it('adjusts pools and preserves mutation/contamination fields', () => {
    expect(adjustVitalsForMaxChange(
      {
        hp: 5,
        fatigue: 2,
        stress: 4,
        mutationPoints: 1,
        mutationPointsMax: 3,
        contamination: { deathNet: 1, liveCore: 0, anomalie: 2 },
      },
      { hp: 5, fatigue: 4, stress: 4, mutationPoints: 3, contamination: 6 },
      { hp: 8, fatigue: 3, stress: 6, mutationPoints: 3, contamination: 9 },
    )).toEqual({
      hp: 8,
      fatigue: 2,
      stress: 6,
      mutationPoints: 1,
      mutationPointsMax: 3,
      contamination: { deathNet: 1, liveCore: 0, anomalie: 2 },
    })
  })
})
