import { describe, expect, it } from 'vitest'
import { SHEET_VERSION } from '@/config/rpg-system'
import { needsSheetMigration, resolveHeroSheetVersion } from './sheetVersion'

describe('resolveHeroSheetVersion', () => {
  it('returns 0 for missing or invalid values', () => {
    expect(resolveHeroSheetVersion(undefined)).toBe(0)
    expect(resolveHeroSheetVersion(null)).toBe(0)
    expect(resolveHeroSheetVersion('')).toBe(0)
    expect(resolveHeroSheetVersion('abc')).toBe(0)
  })

  it('coerces numeric strings', () => {
    expect(resolveHeroSheetVersion('1')).toBe(1)
    expect(resolveHeroSheetVersion('2')).toBe(2)
  })
})

describe('needsSheetMigration', () => {
  it('detects outdated versions using normalized values', () => {
    expect(needsSheetMigration(1)).toBe(true)
    expect(needsSheetMigration('1')).toBe(true)
    expect(needsSheetMigration(SHEET_VERSION)).toBe(false)
    expect(needsSheetMigration(String(SHEET_VERSION))).toBe(false)
  })
})
