/** Roll `count` d10 dice and return individual results plus their sum. */
export function rollDicePool(count: number): { rolls: number[]; result: number; diceCount: number } {
  const diceCount = Math.max(0, count)
  const rolls = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 10))
  return { rolls, result: rolls.reduce((sum, r) => sum + r, 0), diceCount }
}

export type DiceOutcomeKind = 'problem' | 'failure' | 'success' | 'critical'

export interface DicePoolSummary {
  problem: number
  failure: number
  success: number
  critical: number
}

const OUTCOME_I18N: Record<DiceOutcomeKind, string> = {
  problem: 'dice.1',
  failure: 'dice.4-5',
  success: 'dice.6-9',
  critical: 'dice.10',
}

export function getDiceOutcomeKind(value: number): DiceOutcomeKind {
  if (value === 1) return 'problem'
  if (value <= 5) return 'failure'
  if (value <= 9) return 'success'
  return 'critical'
}

export function summarizeDicePool(rolls: number[]): DicePoolSummary {
  const summary: DicePoolSummary = { problem: 0, failure: 0, success: 0, critical: 0 }
  for (const roll of rolls) {
    summary[getDiceOutcomeKind(roll)]++
  }
  return summary
}

export function groupRollsByOutcome(rolls: number[]): Record<DiceOutcomeKind, number[]> {
  const groups: Record<DiceOutcomeKind, number[]> = {
    problem: [],
    failure: [],
    success: [],
    critical: [],
  }
  for (const roll of rolls) {
    groups[getDiceOutcomeKind(roll)].push(roll)
  }
  return groups
}

/** Best outcomes first — for chat roll display. */
export const DICE_OUTCOME_DISPLAY_ORDER: DiceOutcomeKind[] = [
  'critical',
  'success',
  'failure',
  'problem',
]

export function diceOutcomeI18nKey(kind: DiceOutcomeKind): string {
  return OUTCOME_I18N[kind]
}

function dicePoolTotal(data: Record<string, unknown>): number {
  const stored = data.total as number | undefined
  if (stored != null) return stored
  const skillValue = (data.skillValue as number | undefined) ?? 0
  const attributeValue = (data.attributeValue as number | undefined) ?? 0
  const modifier = (data.modifier as number | undefined) ?? 0
  return skillValue + attributeValue + modifier
}

/** Re-roll dice for an existing pool configuration, keeping stats and labels intact. */
export function rerollDiceData(data: Record<string, unknown>): Record<string, unknown> {
  const { rolls, result, diceCount } = rollDicePool(dicePoolTotal(data))
  return { ...data, rolls, result, diceCount }
}

export function getDiceOutcomeClass(value: number): string {
  switch (getDiceOutcomeKind(value)) {
    case 'problem': return 'text-red-400'
    case 'failure': return 'text-orange-400'
    case 'success': return 'text-green-400'
    case 'critical': return 'text-yellow-300'
  }
}

export function getDiceOutcomeKey(value: number): string {
  return diceOutcomeI18nKey(getDiceOutcomeKind(value))
}
