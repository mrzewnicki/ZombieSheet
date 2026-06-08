import { SHEET_VERSION } from '@/config/rpg-system'

/** Coerce stored sheetVersion values (number, string, missing) to a finite number. */
export function resolveHeroSheetVersion(sheetVersion: unknown): number {
  const version = Number(sheetVersion)
  return Number.isFinite(version) ? version : 0
}

export function needsSheetMigration(sheetVersion: unknown): boolean {
  return resolveHeroSheetVersion(sheetVersion) !== SHEET_VERSION
}
