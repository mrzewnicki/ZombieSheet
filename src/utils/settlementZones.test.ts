import { describe, expect, it } from 'vitest'
import { pointInPolygon, zoneCentroid, zoneLabelPoint, zoneRoundedPathSvg } from './settlementZones'
import type { SettlementZonePoint } from '@/types'

/** Classic L: vertex average sits in the empty corner outside the fill. */
const L_SHAPE: SettlementZonePoint[] = [
  { x: 10, y: 10 },
  { x: 70, y: 10 },
  { x: 70, y: 30 },
  { x: 30, y: 30 },
  { x: 30, y: 70 },
  { x: 10, y: 70 },
]

describe('zoneLabelPoint', () => {
  it('places the label inside an L-shaped polygon', () => {
    const p = zoneLabelPoint(L_SHAPE)
    expect(pointInPolygon(p, L_SHAPE)).toBe(true)
  })

  it('differs from the naive vertex average on an L-shape', () => {
    const avg = {
      x: L_SHAPE.reduce((s, p) => s + p.x, 0) / L_SHAPE.length,
      y: L_SHAPE.reduce((s, p) => s + p.y, 0) / L_SHAPE.length,
    }
    expect(pointInPolygon(avg, L_SHAPE)).toBe(false)
    expect(pointInPolygon(zoneLabelPoint(L_SHAPE), L_SHAPE)).toBe(true)
  })

  it('keeps a square label near the center', () => {
    const square: SettlementZonePoint[] = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 },
    ]
    const p = zoneLabelPoint(square)
    expect(pointInPolygon(p, square)).toBe(true)
    expect(p.x).toBeGreaterThan(40)
    expect(p.x).toBeLessThan(60)
    expect(p.y).toBeGreaterThan(40)
    expect(p.y).toBeLessThan(60)
  })
})

describe('zoneCentroid', () => {
  it('delegates to the visual label point', () => {
    expect(zoneCentroid(L_SHAPE)).toEqual(zoneLabelPoint(L_SHAPE))
  })
})

describe('zoneRoundedPathSvg', () => {
  it('returns a closed path with quadratic corners', () => {
    const square: SettlementZonePoint[] = [
      { x: 20, y: 20 },
      { x: 80, y: 20 },
      { x: 80, y: 80 },
      { x: 20, y: 80 },
    ]
    const d = zoneRoundedPathSvg(square)
    expect(d.startsWith('M ')).toBe(true)
    expect(d.includes('Q ')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })
})
