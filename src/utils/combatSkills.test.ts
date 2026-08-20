import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COMBAT_SKILL_KEYS,
  moveCombatSkillKey,
  normalizeCombatSkillKeys,
  resolveCombatSkills,
  toggleCombatSkillKey,
} from '@/utils/combatSkills'

describe('normalizeCombatSkillKeys', () => {
  it('returns Walka defaults when missing or invalid', () => {
    expect(normalizeCombatSkillKeys(undefined)).toEqual(DEFAULT_COMBAT_SKILL_KEYS)
    expect(normalizeCombatSkillKeys(['not_a_skill'])).toEqual(DEFAULT_COMBAT_SKILL_KEYS)
  })

  it('keeps valid keys in order and dedupes', () => {
    expect(normalizeCombatSkillKeys(['medycyna', 'walka_wrecz', 'medycyna'])).toEqual([
      'medycyna',
      'walka_wrecz',
    ])
  })
})

describe('resolveCombatSkills', () => {
  it('maps keys to skill defs', () => {
    const skills = resolveCombatSkills(['walka_wrecz', 'medycyna'])
    expect(skills.map((s) => s.key)).toEqual(['walka_wrecz', 'medycyna'])
  })
})

describe('toggleCombatSkillKey', () => {
  it('adds and removes keys', () => {
    expect(toggleCombatSkillKey(['walka_wrecz'], 'medycyna')).toEqual(['walka_wrecz', 'medycyna'])
    expect(toggleCombatSkillKey(['walka_wrecz', 'medycyna'], 'medycyna')).toEqual(['walka_wrecz'])
  })
})

describe('moveCombatSkillKey', () => {
  it('swaps adjacent entries', () => {
    expect(moveCombatSkillKey(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveCombatSkillKey(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b'])
  })
})
