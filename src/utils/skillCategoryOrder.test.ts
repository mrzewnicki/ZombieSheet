import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SKILL_CATEGORY_ORDER,
  loadSkillCategoryOrder,
  saveSkillCategoryOrder,
} from './skillCategoryOrder'

describe('skillCategoryOrder', () => {
  const heroId = 'hero-test-1'

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns default order when nothing is stored', () => {
    expect(loadSkillCategoryOrder(heroId)).toEqual(DEFAULT_SKILL_CATEGORY_ORDER)
  })

  it('round-trips a valid permutation', () => {
    const reversed = [...DEFAULT_SKILL_CATEGORY_ORDER].reverse()
    saveSkillCategoryOrder(heroId, reversed)
    expect(loadSkillCategoryOrder(heroId)).toEqual(reversed)
  })

  it('falls back to default for invalid stored data', () => {
    localStorage.setItem(`skillOrder_${heroId}`, JSON.stringify(['only-one-key']))
    expect(loadSkillCategoryOrder(heroId)).toEqual(DEFAULT_SKILL_CATEGORY_ORDER)
  })

  it('falls back to default for malformed JSON', () => {
    localStorage.setItem(`skillOrder_${heroId}`, 'not-json')
    expect(loadSkillCategoryOrder(heroId)).toEqual(DEFAULT_SKILL_CATEGORY_ORDER)
  })
})
