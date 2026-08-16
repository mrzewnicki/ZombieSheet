import type { SettlementMapSize, SettlementZonePoint } from '@/types'

export const DEFAULT_MAP_SNAP_TO_GRID = false
export const MIN_MAP_GRID_DIM = 4
export const MAX_MAP_GRID_DIM = 60
export const DEFAULT_MAP_GRID_DIM = 20
export const DEFAULT_MAP_BACKGROUND_OPACITY = 100

export function clampMapGridDim(value: unknown, fallback = DEFAULT_MAP_GRID_DIM): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback
  return Math.max(MIN_MAP_GRID_DIM, Math.min(MAX_MAP_GRID_DIM, n))
}

/** Background image opacity as 0–100 percent. */
export function clampMapBackgroundOpacity(
  value: unknown,
  fallback = DEFAULT_MAP_BACKGROUND_OPACITY,
): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function mapBackgroundOpacity(
  map: Pick<SettlementMapSize, 'backgroundOpacity'>,
): number {
  return clampMapBackgroundOpacity(map.backgroundOpacity)
}

export function mapSnapToGrid(map: Pick<SettlementMapSize, 'snapToGrid'>): boolean {
  return map.snapToGrid === true
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n))
}

/** Square cell center for col/row (0-based). */
export function squareCellCenter(
  col: number,
  row: number,
  cols: number,
  rows: number,
): SettlementZonePoint {
  const cw = 100 / cols
  const ch = 100 / rows
  return {
    x: (col + 0.5) * cw,
    y: (row + 0.5) * ch,
  }
}

export function snapMapPoint(
  x: number,
  y: number,
  map: Pick<SettlementMapSize, 'width' | 'height' | 'snapToGrid'>,
): SettlementZonePoint {
  if (!mapSnapToGrid(map)) {
    return { x: clampPct(x), y: clampPct(y) }
  }
  const cols = clampMapGridDim(map.width)
  const rows = clampMapGridDim(map.height)
  const cw = 100 / cols
  const ch = 100 / rows
  const col = Math.max(0, Math.min(cols - 1, Math.floor(x / cw)))
  const row = Math.max(0, Math.min(rows - 1, Math.floor(y / ch)))
  return squareCellCenter(col, row, cols, rows)
}
