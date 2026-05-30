import { describe, expect, it } from 'vitest'
import { computeThrowTotal } from './throwTotal'

describe('computeThrowTotal', () => {
  it('sums skill, attribute, and modifier', () => {
    expect(computeThrowTotal(2, 3, 1)).toBe(6)
    expect(computeThrowTotal(0, 0, 0)).toBe(0)
  })
})
