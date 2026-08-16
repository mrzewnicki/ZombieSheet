import type { SettlementZone, SettlementZonePoint } from '@/types'

export const DEFAULT_SETTLEMENT_ZONE_COLOR = '#5a7a4a'
export const DEFAULT_SETTLEMENT_ZONE_ICON_COLOR = '#d4c9a8'
/** Corner radius in map % when `smoothCorners` is enabled. */
export const DEFAULT_ZONE_CORNER_RADIUS = 2.8
/** Default: corners are smoothed unless explicitly disabled. */
export const DEFAULT_ZONE_SMOOTH_CORNERS = true

export function zoneSmoothCorners(smoothCorners: boolean | undefined): boolean {
  return smoothCorners !== false
}

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

function averageOfVertices(points: SettlementZonePoint[]): SettlementZonePoint {
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}

/** Ray-cast point-in-polygon (non-zero / even-odd for simple rings). */
export function pointInPolygon(point: SettlementZonePoint, ring: SettlementZonePoint[]): boolean {
  if (ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x
    const yi = ring[i].y
    const xj = ring[j].x
    const yj = ring[j].y
    const intersect =
      yi > point.y !== yj > point.y
      && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function distToSegmentSquared(
  p: SettlementZonePoint,
  a: SettlementZonePoint,
  b: SettlementZonePoint,
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-12) {
    const dx = p.x - a.x
    const dy = p.y - a.y
    return dx * dx + dy * dy
  }
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const dx = p.x - (a.x + abx * t)
  const dy = p.y - (a.y + aby * t)
  return dx * dx + dy * dy
}

/** Signed distance: positive inside, negative outside (approx via edge distance). */
function polygonSignedDistance(point: SettlementZonePoint, ring: SettlementZonePoint[]): number {
  let minDist2 = Infinity
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    minDist2 = Math.min(minDist2, distToSegmentSquared(point, ring[j], ring[i]))
  }
  const dist = Math.sqrt(minDist2)
  return pointInPolygon(point, ring) ? dist : -dist
}

type Cell = { x: number; y: number; h: number; d: number; max: number }

/** Tiny max-heap by `max` (polylabel cell potential). */
function pushCell(heap: Cell[], cell: Cell) {
  heap.push(cell)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heap[parent].max >= heap[i].max) break
    ;[heap[parent], heap[i]] = [heap[i], heap[parent]]
    i = parent
  }
}

function popCell(heap: Cell[]): Cell | undefined {
  if (heap.length === 0) return undefined
  const top = heap[0]
  const last = heap.pop()!
  if (heap.length === 0) return top
  heap[0] = last
  let i = 0
  for (;;) {
    const left = i * 2 + 1
    const right = left + 1
    let largest = i
    if (left < heap.length && heap[left].max > heap[largest].max) largest = left
    if (right < heap.length && heap[right].max > heap[largest].max) largest = right
    if (largest === i) break
    ;[heap[i], heap[largest]] = [heap[largest], heap[i]]
    i = largest
  }
  return top
}

/**
 * Visual center for labels: pole of inaccessibility (Mapbox polylabel-style).
 * Always prefers a point inside the polygon, in its thickest region.
 */
export function zoneLabelPoint(
  points: SettlementZonePoint[],
  precision = 0.5,
): SettlementZonePoint {
  if (points.length === 0) return { x: 50, y: 50 }
  if (points.length < 3) return averageOfVertices(points)

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  const width = maxX - minX
  const height = maxY - minY
  if (width < 1e-6 && height < 1e-6) {
    return { x: points[0].x, y: points[0].y }
  }

  const cellSize = Math.max(width, height) || 1
  let h = cellSize / 2

  const centroid = averageOfVertices(points)
  let best: Cell = {
    x: centroid.x,
    y: centroid.y,
    h: 0,
    d: polygonSignedDistance(centroid, points),
    max: 0,
  }
  const bboxCenter = { x: minX + width / 2, y: minY + height / 2 }
  const bboxD = polygonSignedDistance(bboxCenter, points)
  if (bboxD > best.d) {
    best = { x: bboxCenter.x, y: bboxCenter.y, h: 0, d: bboxD, max: 0 }
  }

  const cellQueue: Cell[] = []

  function enqueue(x: number, y: number, half: number) {
    const d = polygonSignedDistance({ x, y }, points)
    pushCell(cellQueue, { x, y, h: half, d, max: d + half * Math.SQRT2 })
  }

  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      enqueue(x + h, y + h, h)
    }
  }

  for (;;) {
    const cell = popCell(cellQueue)
    if (!cell) break
    if (cell.d > best.d) best = cell
    if (cell.max - best.d <= precision) break
    h = cell.h / 2
    enqueue(cell.x - h, cell.y - h, h)
    enqueue(cell.x + h, cell.y - h, h)
    enqueue(cell.x - h, cell.y + h, h)
    enqueue(cell.x + h, cell.y + h, h)
  }

  if (best.d < 0) {
    return {
      x: Math.max(minX, Math.min(maxX, centroid.x)),
      y: Math.max(minY, Math.min(maxY, centroid.y)),
    }
  }

  return { x: best.x, y: best.y }
}

/** Label anchor for a zone (visual center inside the polygon). */
export function zoneCentroid(points: SettlementZonePoint[]): SettlementZonePoint {
  return zoneLabelPoint(points)
}

export function zonePointsToSvg(points: SettlementZonePoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(' ')
}

/**
 * SVG path for a closed polygon with quadratic rounded corners.
 * Vertices stay sharp for editing; this is display-only.
 */
export function zoneRoundedPathSvg(
  points: SettlementZonePoint[],
  radius = DEFAULT_ZONE_CORNER_RADIUS,
): string {
  const n = points.length
  if (n < 3) return ''
  if (radius <= 0) {
    return `M ${points.map((p) => `${p.x} ${p.y}`).join(' L ')} Z`
  }

  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]
    const toPrevX = prev.x - curr.x
    const toPrevY = prev.y - curr.y
    const toNextX = next.x - curr.x
    const toNextY = next.y - curr.y
    const lenPrev = Math.hypot(toPrevX, toPrevY)
    const lenNext = Math.hypot(toNextX, toNextY)
    if (lenPrev < 1e-8 || lenNext < 1e-8) {
      if (i === 0) parts.push(`M ${curr.x} ${curr.y}`)
      else parts.push(`L ${curr.x} ${curr.y}`)
      continue
    }
    const r = Math.min(radius, lenPrev * 0.5, lenNext * 0.5)
    const startX = curr.x + (toPrevX / lenPrev) * r
    const startY = curr.y + (toPrevY / lenPrev) * r
    const endX = curr.x + (toNextX / lenNext) * r
    const endY = curr.y + (toNextY / lenNext) * r
    if (i === 0) parts.push(`M ${startX} ${startY}`)
    else parts.push(`L ${startX} ${startY}`)
    parts.push(`Q ${curr.x} ${curr.y} ${endX} ${endY}`)
  }
  parts.push('Z')
  return parts.join(' ')
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
  partial?: Partial<Pick<SettlementZone, 'name' | 'color' | 'icon' | 'iconColor' | 'layer'>>,
): SettlementZone {
  const layer = partial?.layer
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
    ...(layer && layer !== 'background' ? { layer } : {}),
  }
}
