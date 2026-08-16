import type {
  SettlementConstructionInstance,
  SettlementConnection,
  SettlementConnectionEndSymbol,
  SettlementConnectionLineStyle,
} from '@/types'

function dist2(
  a: SettlementConstructionInstance,
  b: SettlementConstructionInstance,
): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** Normalize undirected edge endpoints (sorted ids). */
export function normalizeConnectionEnds(fromId: string, toId: string): { fromId: string; toId: string } {
  return fromId < toId ? { fromId, toId } : { fromId: toId, toId: fromId }
}

export function connectionExists(
  connections: SettlementConnection[],
  fromId: string,
  toId: string,
): boolean {
  const key = edgeKey(fromId, toId)
  return connections.some((c) => edgeKey(c.fromId, c.toId) === key)
}

export function newSettlementConnection(fromId: string, toId: string): SettlementConnection {
  const ends = normalizeConnectionEnds(fromId, toId)
  return {
    id: crypto.randomUUID(),
    fromId: ends.fromId,
    toId: ends.toId,
  }
}

/** Default stroke when a connection has no custom color. */
export const DEFAULT_SETTLEMENT_CONNECTION_COLOR = '#8a7a5a'

/** Default marker icon / background when unset. */
export const DEFAULT_SETTLEMENT_MARKER_ICON_COLOR = '#b02020'
export const DEFAULT_SETTLEMENT_MARKER_BG_COLOR = '#231c16'

/** Preset swatches for connection / marker color pickers (hex). */
export const SETTLEMENT_CONNECTION_COLORS = [
  DEFAULT_SETTLEMENT_CONNECTION_COLOR,
  '#c45c4a',
  '#a89050',
  '#5a7a4a',
  '#5a6a7a',
  '#6a5a7a',
  '#a07050',
  '#4a4035',
] as const

export const SETTLEMENT_MARKER_COLORS = [
  DEFAULT_SETTLEMENT_MARKER_ICON_COLOR,
  DEFAULT_SETTLEMENT_MARKER_BG_COLOR,
  '#d4c9a8',
  '#c45c4a',
  '#a89050',
  '#5a7a4a',
  '#5a6a7a',
  '#6a5a7a',
  '#a07050',
  '#8a7a5a',
  '#0e0a07',
] as const

export function settlementConnectionStroke(color: string | undefined): string {
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) return color
  return DEFAULT_SETTLEMENT_CONNECTION_COLOR
}

export const SETTLEMENT_CONNECTION_LINE_STYLES = [
  'solid',
  'dashed',
  'dotted',
  'dashDot',
] as const satisfies readonly SettlementConnectionLineStyle[]

export const SETTLEMENT_CONNECTION_END_SYMBOLS = [
  'none',
  'arrowTo',
  'arrowFrom',
  'arrowBoth',
] as const satisfies readonly SettlementConnectionEndSymbol[]

export function normalizeConnectionLineStyle(
  raw: unknown,
): SettlementConnectionLineStyle | undefined {
  if (raw === 'dashed' || raw === 'dotted' || raw === 'dashDot' || raw === 'solid') {
    return raw === 'solid' ? undefined : raw
  }
  return undefined
}

export function normalizeConnectionEndSymbol(
  raw: unknown,
): SettlementConnectionEndSymbol | undefined {
  if (raw === 'arrowTo' || raw === 'arrowFrom' || raw === 'arrowBoth' || raw === 'none') {
    return raw === 'none' ? undefined : raw
  }
  return undefined
}

/** SVG stroke-dasharray in viewBox units (0–100 map). */
export function settlementConnectionDashArray(
  style: SettlementConnectionLineStyle | undefined,
): string | undefined {
  switch (style) {
    case 'dashed':
      return '3.5 2.2'
    case 'dotted':
      return '0.9 1.8'
    case 'dashDot':
      return '3.2 1.4 0.9 1.4'
    default:
      return undefined
  }
}

export function settlementMarkerIconColor(color: string | undefined): string {
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) return color
  return DEFAULT_SETTLEMENT_MARKER_ICON_COLOR
}

export function settlementMarkerBgColor(color: string | undefined): string {
  if (color && /^#[0-9A-Fa-f]{6}$/.test(color)) return color
  return DEFAULT_SETTLEMENT_MARKER_BG_COLOR
}

/** Drop edges that reference missing constructions. */
export function pruneSettlementConnections(
  connections: SettlementConnection[],
  constructions: SettlementConstructionInstance[],
): SettlementConnection[] {
  const ids = new Set(constructions.map((c) => c.id))
  return connections.filter((c) => ids.has(c.fromId) && ids.has(c.toId) && c.fromId !== c.toId)
}

/** Merge connections; existing edges win (keep their ids). */
export function mergeSettlementConnections(
  existing: SettlementConnection[],
  added: SettlementConnection[],
): SettlementConnection[] {
  const map = new Map<string, SettlementConnection>()
  for (const c of existing) map.set(edgeKey(c.fromId, c.toId), c)
  for (const c of added) {
    const key = edgeKey(c.fromId, c.toId)
    if (!map.has(key)) map.set(key, c)
  }
  return [...map.values()]
}

/**
 * Minimum spanning tree by map distance (N−1 edges). Sparse — no all-to-all.
 */
export function generateSettlementConnections(
  constructions: SettlementConstructionInstance[],
): SettlementConnection[] {
  if (constructions.length < 2) return []

  type Edge = { a: string; b: string; d2: number }
  const edges: Edge[] = []
  for (let i = 0; i < constructions.length; i++) {
    for (let j = i + 1; j < constructions.length; j++) {
      edges.push({
        a: constructions[i].id,
        b: constructions[j].id,
        d2: dist2(constructions[i], constructions[j]),
      })
    }
  }
  edges.sort((x, y) => x.d2 - y.d2)

  const parent = new Map<string, string>()
  function find(id: string): string {
    let p = parent.get(id) ?? id
    while (p !== (parent.get(p) ?? p)) p = parent.get(p) ?? p
    parent.set(id, p)
    return p
  }
  function union(a: string, b: string): boolean {
    const ra = find(a)
    const rb = find(b)
    if (ra === rb) return false
    parent.set(ra, rb)
    return true
  }
  for (const c of constructions) parent.set(c.id, c.id)

  const selected: SettlementConnection[] = []
  for (const edge of edges) {
    if (union(edge.a, edge.b)) {
      selected.push(newSettlementConnection(edge.a, edge.b))
    }
  }
  return selected
}

/**
 * Fill missing MST edges into existing network (does not remove user links).
 */
export function fillMissingMstConnections(
  connections: SettlementConnection[],
  constructions: SettlementConstructionInstance[],
): SettlementConnection[] {
  return mergeSettlementConnections(connections, generateSettlementConnections(constructions))
}

/** Connect one node to its nearest other construction. */
export function connectToNearest(
  connections: SettlementConnection[],
  constructions: SettlementConstructionInstance[],
  newId: string,
): SettlementConnection[] {
  const neu = constructions.find((c) => c.id === newId)
  if (!neu) return connections
  let best: SettlementConstructionInstance | null = null
  let bestD = Infinity
  for (const other of constructions) {
    if (other.id === newId) continue
    const d = dist2(neu, other)
    if (d < bestD) {
      bestD = d
      best = other
    }
  }
  if (!best) return connections
  if (connectionExists(connections, neu.id, best.id)) return connections
  return [...connections, newSettlementConnection(neu.id, best.id)]
}

/** Remove all connections that touch the given construction. */
export function removeConnectionsForConstruction(
  connections: SettlementConnection[],
  constructionId: string,
): SettlementConnection[] {
  return connections.filter((c) => c.fromId !== constructionId && c.toId !== constructionId)
}

/** Remove a single undirected edge between two constructions. */
export function removeConnectionBetween(
  connections: SettlementConnection[],
  fromId: string,
  toId: string,
): SettlementConnection[] {
  const key = edgeKey(fromId, toId)
  return connections.filter((c) => edgeKey(c.fromId, c.toId) !== key)
}
