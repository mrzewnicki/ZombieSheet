/** Dice pool size for a throw: skill + attribute + modifier. */
export function computeThrowTotal(
  skillValue: number,
  attributeValue: number,
  modifier: number,
): number {
  return skillValue + attributeValue + modifier
}
