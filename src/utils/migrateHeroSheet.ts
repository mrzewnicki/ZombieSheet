import {
  doc,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import {
  DEFAULT_ATTRIBUTES,
  DEFAULT_RACE,
  DEFAULT_SKILLS,
  SHEET_VERSION,
  SKILL_KEY_RENAMES,
  type HeroRace,
} from '@/config/rpg-system'
import type { Hero, HeroVitals } from '@/types'
import { resolveHeroSheetVersion } from '@/utils/sheetVersion'
import {
  defaultVitals,
  resolveHeroRace,
  resolveHeroVitals,
} from '@/utils/vitals'

export interface MigratedHeroFields {
  attributes: Record<string, number>
  skills: Record<string, number>
  race: HeroRace
  vitals: HeroVitals
  sheetVersion: number
}

export function sanitizeNumericMap(
  map: Record<string, number> | undefined | null,
): Record<string, number> {
  if (!map) return {}
  const sanitized: Record<string, number> = {}
  for (const [key, value] of Object.entries(map)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      sanitized[key] = value
    }
  }
  return sanitized
}

/** Apply skill key renames; keep existing new-key values if already set. */
export function remapSkillKeys(
  skills: Record<string, number>,
  renames: Record<string, string> = SKILL_KEY_RENAMES,
): Record<string, number> {
  const remapped = { ...skills }
  for (const [from, to] of Object.entries(renames)) {
    if (!(from in remapped)) continue
    if (!(to in remapped)) {
      remapped[to] = remapped[from]
    }
    delete remapped[from]
  }
  return remapped
}

export function buildMigratedHeroFields(
  hero: Pick<Hero, 'attributes' | 'skills'> & {
    race?: HeroRace | string
    vitals?: Partial<HeroVitals> | null
  },
  targetVersion: number,
  defaults: {
    attributes: Record<string, number>
    skills: Record<string, number>
  } = { attributes: DEFAULT_ATTRIBUTES, skills: DEFAULT_SKILLS },
): MigratedHeroFields {
  const attributes = { ...defaults.attributes, ...sanitizeNumericMap(hero.attributes) }
  const skills = remapSkillKeys(sanitizeNumericMap(hero.skills))
  const mergedSkills = { ...defaults.skills, ...skills }
  const race = resolveHeroRace(hero.race ?? DEFAULT_RACE)
  const hadVitals = Boolean(hero.vitals && typeof hero.vitals === 'object')
  const vitals = hadVitals
    ? resolveHeroVitals(hero.vitals, attributes, race)
    : defaultVitals(attributes, race)

  return {
    attributes,
    skills: mergedSkills,
    race,
    vitals,
    sheetVersion: targetVersion,
  }
}

export async function migrateHeroSheet(
  gameId: string,
  heroId: string,
  hero: Hero,
  targetVersion: number = SHEET_VERSION,
): Promise<void> {
  const fromVersion = resolveHeroSheetVersion(hero.sheetVersion)
  const heroRef = doc(db, 'games', gameId, 'heroes', heroId)
  const backupRef = doc(collection(db, 'games', gameId, 'heroes', heroId, 'sheetBackups'))
  const migrated = buildMigratedHeroFields(hero, targetVersion)

  try {
    await setDoc(backupRef, {
      fromVersion,
      toVersion: targetVersion,
      attributes: sanitizeNumericMap(hero.attributes),
      skills: sanitizeNumericMap(hero.skills),
      race: hero.race ?? null,
      vitals: hero.vitals ?? null,
      createdAt: serverTimestamp(),
    })
  } catch {
    // Backup is best-effort — do not block migration when rules are not deployed yet.
  }

  await updateDoc(heroRef, {
    ...migrated,
    updatedAt: serverTimestamp(),
  })
}
