import { doc, collection, writeBatch, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { DEFAULT_ATTRIBUTES, DEFAULT_SKILLS, SHEET_VERSION } from '@/config/rpg-system'
import type { Hero } from '@/types'

export interface MigratedHeroFields {
  attributes: Record<string, number>
  skills: Record<string, number>
  sheetVersion: number
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
    attributes: { ...defaults.attributes, ...hero.attributes },
    skills: { ...defaults.skills, ...hero.skills },
    sheetVersion: targetVersion,
  }
}

export async function migrateHeroSheet(
  gameId: string,
  heroId: string,
  hero: Hero,
  targetVersion: number = SHEET_VERSION,
): Promise<void> {
  const fromVersion = hero.sheetVersion ?? 0
  const heroRef = doc(db, 'games', gameId, 'heroes', heroId)
  const backupRef = doc(collection(db, 'games', gameId, 'heroes', heroId, 'sheetBackups'))
  const migrated = buildMigratedHeroFields(hero, targetVersion)

  const batch = writeBatch(db)
  batch.set(backupRef, {
    fromVersion,
    toVersion: targetVersion,
    attributes: hero.attributes ?? {},
    skills: hero.skills ?? {},
    createdAt: serverTimestamp(),
  })
  batch.update(heroRef, {
    ...migrated,
    updatedAt: serverTimestamp(),
  })
  await batch.commit()
}
