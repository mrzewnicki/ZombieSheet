import type { CampaignNpc, HeroNpcNodePos, HeroNpcRelation, HeroNpcStance } from '@/types'

export const HERO_NPC_NODE_ID = '__hero__'

/** Graph colors per definition. */
export const GRAPH_COLORS = {
  hero: '#c9a227', // gold — player character
  ally: '#3d9a5f', // green — ally
  enemy: '#c45c4a', // red — enemy
  neutral: '#8a8a8a', // gray — neutral
} as const

export function isHeroNpcStance(value: unknown): value is HeroNpcStance {
  return value === 'ally' || value === 'enemy' || value === 'neutral'
}

export function normalizeHeroNpcStance(value: unknown): HeroNpcStance {
  return isHeroNpcStance(value) ? value : 'neutral'
}

export function graphColorForStance(stance: HeroNpcStance): string {
  return GRAPH_COLORS[stance]
}

/** Undirected edge key so A–B and B–A are the same link. */
export function relationEdgeKey(fromId: string, toId: string): string {
  return fromId < toId ? `${fromId}::${toId}` : `${toId}::${fromId}`
}

export function relationEndpoints(relation: HeroNpcRelation): [string, string] {
  return [relation.fromId, relation.toId]
}

export function relationTouches(relation: HeroNpcRelation, nodeId: string): boolean {
  return relation.fromId === nodeId || relation.toId === nodeId
}

export function relationOtherEnd(relation: HeroNpcRelation, nodeId: string): string | null {
  if (relation.fromId === nodeId) return relation.toId
  if (relation.toId === nodeId) return relation.fromId
  return null
}

export function findRelationBetween(
  relations: HeroNpcRelation[],
  a: string,
  b: string,
): HeroNpcRelation | undefined {
  const key = relationEdgeKey(a, b)
  return relations.find((r) => relationEdgeKey(r.fromId, r.toId) === key)
}

export function newHeroNpcRelation(
  fromId: string,
  toId: string,
  label = '',
  stance: HeroNpcStance = 'neutral',
): HeroNpcRelation {
  return {
    id: crypto.randomUUID(),
    fromId,
    toId,
    label: label.trim(),
    stance,
  }
}

/**
 * Normalize stored relations.
 * Legacy shape `{ id, npcId, label, stance? }` → hero — npc.
 */
export function normalizeHeroNpcRelations(raw: unknown): HeroNpcRelation[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: HeroNpcRelation[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const src = item as Record<string, unknown>
    const id = typeof src.id === 'string' && src.id ? src.id : null
    if (!id) continue

    let fromId =
      typeof src.fromId === 'string' && src.fromId ? src.fromId : null
    let toId = typeof src.toId === 'string' && src.toId ? src.toId : null

    // Legacy: only npcId meant an edge from the hero.
    if ((!fromId || !toId) && typeof src.npcId === 'string' && src.npcId) {
      fromId = HERO_NPC_NODE_ID
      toId = src.npcId
    }

    if (!fromId || !toId || fromId === toId) continue

    const key = relationEdgeKey(fromId, toId)
    if (seen.has(key)) continue
    seen.add(key)

    out.push({
      id,
      fromId,
      toId,
      label: typeof src.label === 'string' ? src.label : '',
      stance: normalizeHeroNpcStance(src.stance),
    })
  }
  return out
}

/** Drop relations whose NPC endpoints no longer exist. Hero endpoint always ok. */
export function pruneHeroNpcRelations(
  relations: HeroNpcRelation[],
  npcs: Pick<CampaignNpc, 'id'>[],
): HeroNpcRelation[] {
  const ids = new Set(npcs.map((n) => n.id))
  return relations.filter((r) => {
    const ends = [r.fromId, r.toId]
    return ends.every((end) => end === HERO_NPC_NODE_ID || ids.has(end))
  })
}

/** All campaign NPC ids that appear on the graph. */
export function npcIdsInRelations(relations: HeroNpcRelation[]): string[] {
  const ids = new Set<string>()
  for (const r of relations) {
    if (r.fromId !== HERO_NPC_NODE_ID) ids.add(r.fromId)
    if (r.toId !== HERO_NPC_NODE_ID) ids.add(r.toId)
  }
  return [...ids]
}

export function normalizeNpcNodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of raw) {
    if (typeof id !== 'string' || !id || id === HERO_NPC_NODE_ID) continue
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function pruneNpcNodes(
  ids: string[],
  npcs: Pick<CampaignNpc, 'id'>[],
): string[] {
  const exist = new Set(npcs.map((n) => n.id))
  return ids.filter((id) => exist.has(id))
}

export function graphNpcIds(
  relations: HeroNpcRelation[],
  extraNodeIds: string[] = [],
): string[] {
  const ids = new Set(npcIdsInRelations(relations))
  for (const id of extraNodeIds) {
    if (id && id !== HERO_NPC_NODE_ID) ids.add(id)
  }
  return [...ids]
}

export function clampGraphCoord(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.min(96, Math.max(4, value))
}

export function normalizeNpcPositions(raw: unknown): Record<string, HeroNpcNodePos> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, HeroNpcNodePos> = {}
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || !val || typeof val !== 'object' || Array.isArray(val)) continue
    const src = val as Record<string, unknown>
    if (typeof src.x !== 'number' || typeof src.y !== 'number') continue
    if (!Number.isFinite(src.x) || !Number.isFinite(src.y)) continue
    out[id] = { x: clampGraphCoord(src.x), y: clampGraphCoord(src.y) }
  }
  return out
}

export function pruneNpcPositions(
  positions: Record<string, HeroNpcNodePos>,
  npcIds: string[],
): Record<string, HeroNpcNodePos> {
  const allowed = new Set(npcIds)
  allowed.add(HERO_NPC_NODE_ID)
  const out: Record<string, HeroNpcNodePos> = {}
  for (const [id, pos] of Object.entries(positions)) {
    if (!allowed.has(id)) continue
    out[id] = pos
  }
  return out
}

export function npcPositionsPayload(
  positions: Record<string, HeroNpcNodePos>,
): Record<string, HeroNpcNodePos> {
  const out: Record<string, HeroNpcNodePos> = {}
  for (const [id, pos] of Object.entries(positions)) {
    out[id] = { x: clampGraphCoord(pos.x), y: clampGraphCoord(pos.y) }
  }
  return out
}

export function heroNpcRelationPayload(relations: HeroNpcRelation[]): HeroNpcRelation[] {
  return relations.map((r) => ({
    id: r.id,
    fromId: r.fromId,
    toId: r.toId,
    label: r.label.trim(),
    stance: normalizeHeroNpcStance(r.stance),
  }))
}

export interface GraphNodePos {
  id: string
  x: number
  y: number
  depth: number
}

function stableAngle(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) / 0xffffffff) * Math.PI * 2
}

/**
 * Place graph nodes. Saved positions always win.
 * Auto-placement ignores edges, so linking two nodes never moves them.
 */
export function layoutHeroNpcGraph(
  relations: HeroNpcRelation[],
  viewBox = 100,
  extraNodeIds: string[] = [],
  savedPositions: Record<string, HeroNpcNodePos> = {},
): Map<string, GraphNodePos> {
  const cx = viewBox / 2
  const cy = viewBox / 2
  const npcIds = graphNpcIds(relations, extraNodeIds)
  const positions = new Map<string, GraphNodePos>()

  const heroSaved = savedPositions[HERO_NPC_NODE_ID]
  positions.set(HERO_NPC_NODE_ID, {
    id: HERO_NPC_NODE_ID,
    x: heroSaved?.x ?? cx,
    y: heroSaved?.y ?? cy,
    depth: 0,
  })

  const unsaved: string[] = []
  for (const id of npcIds) {
    const saved = savedPositions[id]
    if (saved) {
      positions.set(id, { id, x: saved.x, y: saved.y, depth: 1 })
    } else {
      unsaved.push(id)
    }
  }

  if (unsaved.length === 0) return positions

  const anySavedNpc = npcIds.some((id) => Boolean(savedPositions[id]))
  const radius = 34
  unsaved.sort()
  unsaved.forEach((id, i) => {
    const n = unsaved.length
    const angle = anySavedNpc
      ? stableAngle(id)
      : n === 1
        ? -Math.PI / 2
        : (i / n) * Math.PI * 2 - Math.PI / 2
    positions.set(id, {
      id,
      x: clampGraphCoord(cx + Math.cos(angle) * radius),
      y: clampGraphCoord(cy + Math.sin(angle) * radius),
      depth: 1,
    })
  })

  return positions
}

/** Fill auto-layout slots for graph nodes that do not yet have a saved position. */
export function fillMissingNpcPositions(
  relations: HeroNpcRelation[],
  extraNodeIds: string[],
  savedPositions: Record<string, HeroNpcNodePos>,
  viewBox = 100,
): Record<string, HeroNpcNodePos> {
  const laid = layoutHeroNpcGraph(relations, viewBox, extraNodeIds, savedPositions)
  const next = { ...savedPositions }
  for (const [id, pos] of laid) {
    if (next[id]) continue
    next[id] = { x: pos.x, y: pos.y }
  }
  return npcPositionsPayload(next)
}
