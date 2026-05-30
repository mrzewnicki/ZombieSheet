/** Roll `count` d10 dice and return individual results plus their sum. */
export function rollDicePool(count: number): { rolls: number[]; result: number; diceCount: number } {
  const diceCount = Math.max(0, count)
  const rolls = Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 10))
  return { rolls, result: rolls.reduce((sum, r) => sum + r, 0), diceCount }
}

export function getDiceOutcomeClass(value: number): string {
  if (value === 1) return 'text-red-400'
  if (value <= 5) return 'text-orange-400'
  if (value <= 9) return 'text-green-400'
  return 'text-yellow-300'
}

export function getDiceOutcomeKey(value: number): string {
  if (value === 1) return 'dice.1'
  if (value <= 5) return 'dice.4-5'
  if (value <= 9) return 'dice.6-9'
  return 'dice.10'
}
