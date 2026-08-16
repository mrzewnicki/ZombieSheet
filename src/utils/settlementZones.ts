import type { SettlementZone, SettlementZonePoint } from '@/types'

export const DEFAULT_SETTLEMENT_ZONE_COLOR = '#5a7a4a'
export const DEFAULT_SETTLEMENT_ZONE_ICON_COLOR = '#d4c9a8'

export const SETTLEMENT_ZONE_COLORS = [
  DEFAULT_SETTLEMENT_ZONE_COLOR,
  '#5a6a7a',
  '#a89050',
  '#c45c4a',
  '#6a5a7a',
  '#8a7a5a',
  '#4a8fbf',
  '#a07050',
  '#231c16',
  '#d4c9a8',
] as const

export function zoneCentroid(points: SettlementZonePoint[]): SettlementZonePoint {
  if (points.length === 0) return { x: 50, y: 50 }
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}

export function zonePointsToSvg(points: SettlementZonePoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

export function translateZonePoints(
  points: SettlementZonePoint[],
  dx: number,
  dy: number,
): SettlementZonePoint[] {
  return points.map((p) => ({
    x: Math.max(0, Math.min(100, p.x + dx)),
    y: Math.max(0, Math.min(100, p.y + dy)),
  }))
}

export function clampZonePoint(p: SettlementZonePoint): SettlementZonePoint {
  return {
    x: Math.max(0, Math.min(100, p.x)),
    y: Math.max(0, Math.min(100, p.y)),
  }
}

export function moveZoneVertex(
  points: SettlementZonePoint[],
  index: number,
  point: SettlementZonePoint,
): SettlementZonePoint[] {
  if (index < 0 || index >= points.length) return points
  return points.map((p, i) => (i === index ? clampZonePoint(point) : p))
}

/** Project P onto segment AB; returns point and t in [0,1]. */
export function projectPointOntoSegment(
  p: SettlementZonePoint,
  a: SettlementZonePoint,
  b: SettlementZonePoint,
): { point: SettlementZonePoint; t: number; dist: number } {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-8) {
    const point = { ...a }
    return { point, t: 0, dist: Math.hypot(p.x - a.x, p.y - a.y) }
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2))
  const point = { x: a.x + abx * t, y: a.y + aby * t }
  return { point, t, dist: Math.hypot(p.x - point.x, p.y - point.y) }
}

/** Insert a vertex after edgeIndex (edge from points[i] → points[i+1]). */
export function insertZonePointOnEdge(
  points: SettlementZonePoint[],
  edgeIndex: number,
  point: SettlementZonePoint,
): SettlementZonePoint[] {
  if (points.length < 2) return points
  const i = ((edgeIndex % points.length) + points.length) % points.length
  const next = [...points]
  next.splice(i + 1, 0, clampZonePoint(point))
  return next
}

/** Close enough to first vertex to finish the polygon (map %). */
export function isNearZonePoint(
  a: SettlementZonePoint,
  b: SettlementZonePoint,
  threshold = 2.5,
): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) <= threshold
}

export function newSettlementZone(
  points: SettlementZonePoint[],
  partial?: Partial<Pick<SettlementZone, 'name' | 'color' | 'icon' | 'iconColor'>>,
): SettlementZone {
  return {
    id: crypto.randomUUID(),
    name: partial?.name?.trim() ?? '',
    points: points.map((p) => ({
      x: Math.max(0, Math.min(100, p.x)),
      y: Math.max(0, Math.min(100, p.y)),
    })),
    color: partial?.color?.trim() || DEFAULT_SETTLEMENT_ZONE_COLOR,
    ...(partial?.icon?.trim() ? { icon: partial.icon.trim() } : {}),
    ...(partial?.iconColor?.trim() ? { iconColor: partial.iconColor.trim() } : {}),
  }
}
