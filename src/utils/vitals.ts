import {
  DEFAULT_RACE,
  RACES,
  type HeroRace,
} from '@/config/rpg-system'
import type { HeroContamination, HeroVitals } from '@/types'

export interface VitalMaxes {
  hp: number
  fatigue: number
  stress: number
  mutationPoints: number
  contamination: number
}

export const EMPTY_CONTAMINATION: HeroContamination = {
  deathNet: 0,
  liveCore: 0,
  anomalie: 0,
}

export type ContaminationTrack = keyof HeroContamination

export function resolveHeroRace(race: unknown): HeroRace {
  if (typeof race === 'string' && RACES.some((r) => r.key === race)) {
    return race as HeroRace
  }
  return DEFAULT_RACE
}

function attr(attributes: Record<string, number> | undefined, key: string): number {
  const value = attributes?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function nonNegInt(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.trunc(value))
}

/** Max HP = (2×Kondycja) + Siła + race modifier. */
export function computeMaxHp(
  attributes: Record<string, number> | undefined,
  race: HeroRace,
): number {
  const bonus = RACES.find((r) => r.key === race)?.hpBonus ?? 3
  return 2 * attr(attributes, 'kondycja') + attr(attributes, 'sila') + bonus
}

/** Max fatigue = Kondycja + Determinacja. */
export function computeMaxFatigue(attributes: Record<string, number> | undefined): number {
  return attr(attributes, 'kondycja') + attr(attributes, 'determinacja')
}

/** Max stress = Opanowanie + Determinacja. */
export function computeMaxStress(attributes: Record<string, number> | undefined): number {
  return attr(attributes, 'opanowanie') + attr(attributes, 'determinacja')
}

/**
 * Max contamination = Kondycja + Opanowanie + Determinacja.
 * Race modifier for contamination is still TBD in the system docs — treated as +0.
 */
export function computeMaxContamination(
  attributes: Record<string, number> | undefined,
): number {
  return (
    attr(attributes, 'kondycja')
    + attr(attributes, 'opanowanie')
    + attr(attributes, 'determinacja')
  )
}

export function computeVitalMaxes(
  attributes: Record<string, number> | undefined,
  race: HeroRace = DEFAULT_RACE,
  mutationPointsMax = 0,
): VitalMaxes {
  return {
    hp: computeMaxHp(attributes, race),
    fatigue: computeMaxFatigue(attributes),
    stress: computeMaxStress(attributes),
    mutationPoints: Math.max(0, mutationPointsMax),
    contamination: computeMaxContamination(attributes),
  }
}

export function clampVital(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, Math.trunc(value)))
}

export function sanitizeContamination(
  value: Partial<HeroContamination> | undefined | null,
): HeroContamination {
  if (!value || typeof value !== 'object') return { ...EMPTY_CONTAMINATION }
  return {
    deathNet: nonNegInt(value.deathNet),
    liveCore: nonNegInt(value.liveCore),
    anomalie: nonNegInt(value.anomalie),
  }
}

export function contaminationTotal(contamination: HeroContamination): number {
  return contamination.deathNet + contamination.liveCore + contamination.anomalie
}

/** Dominant track (highest value); ties prefer LiveCore → DeathNet → Anomalie. Null when all zero. */
export function dominantContaminationTrack(
  contamination: HeroContamination,
): ContaminationTrack | null {
  if (contaminationTotal(contamination) <= 0) return null
  const entries: [ContaminationTrack, number][] = [
    ['liveCore', contamination.liveCore],
    ['deathNet', contamination.deathNet],
    ['anomalie', contamination.anomalie],
  ]
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

/**
 * Adjust total contamination by growing LiveCore (most common source) or
 * shrinking the current highest track.
 */
export function adjustContaminationTotal(
  contamination: HeroContamination,
  nextTotal: number,
): HeroContamination {
  const target = nonNegInt(nextTotal)
  let next = { ...contamination }
  let total = contaminationTotal(next)

  while (total < target) {
    next.liveCore += 1
    total += 1
  }
  while (total > target) {
    const track = dominantContaminationTrack(next)
    if (!track || next[track] <= 0) break
    next[track] -= 1
    total -= 1
  }
  return next
}

/** Full resource pools + empty mutation/contamination — used on create / first migration. */
export function defaultVitals(
  attributes: Record<string, number> | undefined,
  race: HeroRace = DEFAULT_RACE,
): HeroVitals {
  const max = computeVitalMaxes(attributes, race, 0)
  return {
    hp: max.hp,
    fatigue: max.fatigue,
    stress: max.stress,
    mutationPoints: 0,
    mutationPointsMax: 0,
    contamination: { ...EMPTY_CONTAMINATION },
  }
}

/**
 * When a max changes: keep full pools full; otherwise clamp current into [0, newMax].
 */
export function adjustCurrentForMaxChange(
  current: number,
  oldMax: number,
  newMax: number,
): number {
  const wasFull = current >= oldMax
  if (wasFull) return newMax
  return clampVital(current, newMax)
}

export function adjustVitalsForMaxChange(
  current: HeroVitals,
  oldMax: VitalMaxes,
  newMax: VitalMaxes,
): HeroVitals {
  const mutationPointsMax = Math.max(0, current.mutationPointsMax)
  return {
    hp: adjustCurrentForMaxChange(current.hp, oldMax.hp, newMax.hp),
    fatigue: adjustCurrentForMaxChange(current.fatigue, oldMax.fatigue, newMax.fatigue),
    stress: adjustCurrentForMaxChange(current.stress, oldMax.stress, newMax.stress),
    mutationPoints: clampVital(current.mutationPoints, mutationPointsMax),
    mutationPointsMax,
    contamination: sanitizeContamination(current.contamination),
  }
}

export function resolveHeroVitals(
  vitals: Partial<HeroVitals> | undefined | null,
  attributes: Record<string, number> | undefined,
  race: HeroRace,
): HeroVitals {
  const mutationPointsMax = nonNegInt(vitals?.mutationPointsMax)
  const max = computeVitalMaxes(attributes, race, mutationPointsMax)
  if (!vitals) {
    return {
      hp: max.hp,
      fatigue: max.fatigue,
      stress: max.stress,
      mutationPoints: 0,
      mutationPointsMax: 0,
      contamination: { ...EMPTY_CONTAMINATION },
    }
  }
  return {
    hp: clampVital(typeof vitals.hp === 'number' ? vitals.hp : max.hp, max.hp),
    fatigue: clampVital(typeof vitals.fatigue === 'number' ? vitals.fatigue : max.fatigue, max.fatigue),
    stress: clampVital(typeof vitals.stress === 'number' ? vitals.stress : max.stress, max.stress),
    mutationPoints: clampVital(
      typeof vitals.mutationPoints === 'number' ? vitals.mutationPoints : 0,
      mutationPointsMax,
    ),
    mutationPointsMax,
    contamination: sanitizeContamination(vitals.contamination),
  }
}
