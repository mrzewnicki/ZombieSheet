import {
  doc,
  collection,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/config/firebase'
import { DEFAULT_ATTRIBUTES, DEFAULT_SKILLS, SHEET_VERSION } from '@/config/rpg-system'
import type { Hero } from '@/types'
import { resolveHeroSheetVersion } from '@/utils/sheetVersion'

export interface MigratedHeroFields {
  attributes: Record<string, number>
  skills: Record<string, number>
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

export function buildMigratedHeroFields(
  hero: Pick<Hero, 'attributes' | 'skills'>,
  targetVersion: number,
  defaults: {
    attributes: Record<string, number>
    skills: Record<string, number>
  } = { attributes: DEFAULT_ATTRIBUTES, skills: DEFAULT_SKILLS },
): MigratedHeroFields {
  return {
    attributes: { ...defaults.attributes, ...sanitizeNumericMap(hero.attributes) },
    skills: { ...defaults.skills, ...sanitizeNumericMap(hero.skills) },
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
