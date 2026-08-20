import { SKILL_CATEGORIES, type SkillDef } from '@/config/rpg-system'

const ALL_SKILLS = SKILL_CATEGORIES.flatMap((c) => c.skills)
const SKILL_BY_KEY = new Map(ALL_SKILLS.map((s) => [s.key, s]))

export const DEFAULT_COMBAT_SKILL_KEYS = (
  SKILL_CATEGORIES.find((c) => c.key === 'walka')?.skills ?? []
).map((s) => s.key)

/** Normalize stored combat skill keys — invalid entries dropped, empty falls back to Walka defaults. */
export function normalizeCombatSkillKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_COMBAT_SKILL_KEYS]

  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== 'string' || !SKILL_BY_KEY.has(entry) || seen.has(entry)) continue
    seen.add(entry)
    out.push(entry)
  }

  return out.length > 0 ? out : [...DEFAULT_COMBAT_SKILL_KEYS]
}

export function resolveCombatSkills(keys: string[]): SkillDef[] {
  return keys
    .map((key) => SKILL_BY_KEY.get(key))
    .filter((s): s is SkillDef => s != null)
}

export function getSkillDef(key: string): SkillDef | undefined {
  return SKILL_BY_KEY.get(key)
}

export function toggleCombatSkillKey(keys: string[], key: string): string[] {
  if (!SKILL_BY_KEY.has(key)) return keys
  if (keys.includes(key)) return keys.filter((k) => k !== key)
  return [...keys, key]
}

export function moveCombatSkillKey(keys: string[], key: string, direction: -1 | 1): string[] {
  const index = keys.indexOf(key)
  if (index === -1) return keys
  const target = index + direction
  if (target < 0 || target >= keys.length) return keys
  const next = [...keys]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
