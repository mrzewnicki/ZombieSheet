import { SKILL_CATEGORIES } from '@/config/rpg-system'

export const DEFAULT_SKILL_CATEGORY_ORDER = SKILL_CATEGORIES.map((c) => c.key)

export function loadSkillCategoryOrder(heroId: string): string[] {
  try {
    const raw = localStorage.getItem(`skillOrder_${heroId}`)
    if (!raw) return DEFAULT_SKILL_CATEGORY_ORDER
    const parsed: string[] = JSON.parse(raw)
    if (
      parsed.length === DEFAULT_SKILL_CATEGORY_ORDER.length &&
      DEFAULT_SKILL_CATEGORY_ORDER.every((k) => parsed.includes(k))
    ) {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SKILL_CATEGORY_ORDER
}

export function saveSkillCategoryOrder(heroId: string, order: string[]): void {
  try {
    localStorage.setItem(`skillOrder_${heroId}`, JSON.stringify(order))
  } catch {
    /* ignore */
  }
}
