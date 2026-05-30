import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DICE_OUTCOME_DISPLAY_ORDER,
  diceOutcomeI18nKey,
  getDiceOutcomeClass,
  getDiceOutcomeKey,
  getDiceOutcomeKind,
  groupRollsByOutcome,
  rerollDiceData,
  rollDicePool,
  summarizeDicePool,
} from './diceRoll'

describe('getDiceOutcomeKind', () => {
  it.each([
    [1, 'problem'],
    [2, 'failure'],
    [5, 'failure'],
    [6, 'success'],
    [9, 'success'],
    [10, 'critical'],
    [11, 'critical'],
  ] as const)('classifies %i as %s', (value, kind) => {
    expect(getDiceOutcomeKind(value)).toBe(kind)
  })
})

describe('summarizeDicePool', () => {
  it('counts outcomes in a pool', () => {
    expect(summarizeDicePool([1, 4, 6, 10])).toEqual({
      problem: 1,
      failure: 1,
      success: 1,
      critical: 1,
    })
  })
})

describe('groupRollsByOutcome', () => {
  it('groups rolls by outcome kind', () => {
    expect(groupRollsByOutcome([1, 4, 6, 10])).toEqual({
      problem: [1],
      failure: [4],
      success: [6],
      critical: [10],
    })
  })
})

describe('diceOutcomeI18nKey', () => {
  it('returns stable i18n keys', () => {
    expect(diceOutcomeI18nKey('critical')).toBe('dice.10')
    expect(diceOutcomeI18nKey('problem')).toBe('dice.1')
  })
})

describe('getDiceOutcomeClass', () => {
  it('maps outcomes to tailwind classes', () => {
    expect(getDiceOutcomeClass(1)).toBe('text-red-400')
    expect(getDiceOutcomeClass(10)).toBe('text-yellow-300')
  })
})

describe('getDiceOutcomeKey', () => {
  it('delegates to outcome kind i18n key', () => {
    expect(getDiceOutcomeKey(6)).toBe('dice.6-9')
  })
})

describe('DICE_OUTCOME_DISPLAY_ORDER', () => {
  it('orders best outcomes first', () => {
    expect(DICE_OUTCOME_DISPLAY_ORDER[0]).toBe('critical')
    expect(DICE_OUTCOME_DISPLAY_ORDER.at(-1)).toBe('problem')
  })
})

describe('rollDicePool', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty pool for non-positive count', () => {
    expect(rollDicePool(-3)).toEqual({ rolls: [], result: 0, diceCount: 0 })
  })

  it('rolls d10 dice with mocked RNG', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05)
    expect(rollDicePool(3)).toEqual({ rolls: [1, 1, 1], result: 3, diceCount: 3 })
  })
})

describe('rerollDiceData', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses stored total when present', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    const out = rerollDiceData({
      total: 2,
      skillValue: 99,
      label: 'Test',
    })
    expect(out.label).toBe('Test')
    expect(out.diceCount).toBe(2)
    expect(out.rolls).toHaveLength(2)
    expect(out.result).toBe(18)
  })

  it('derives dice count from skill, attribute, and modifier', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05)
    const out = rerollDiceData({
      skillValue: 2,
      attributeValue: 3,
      modifier: 1,
    })
    expect(out.diceCount).toBe(6)
    expect(out.rolls).toHaveLength(6)
  })
})
