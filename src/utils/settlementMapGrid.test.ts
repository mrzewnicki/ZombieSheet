import { describe, expect, it } from 'vitest'
import { snapMapPoint, squareCellCenter } from './settlementMapGrid'

describe('snapMapPoint', () => {
  it('returns clamped point when snap is off', () => {
    expect(snapMapPoint(12.3, 45.6, { width: 10, height: 10 })).toEqual({
      x: 12.3,
      y: 45.6,
    })
  })

  it('snaps to square cell centers', () => {
    const map = { width: 10, height: 10, snapToGrid: true as const }
    expect(snapMapPoint(12, 12, map)).toEqual(squareCellCenter(1, 1, 10, 10))
    expect(snapMapPoint(0.1, 0.1, map)).toEqual(squareCellCenter(0, 0, 10, 10))
  })
})
