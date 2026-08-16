import type { CampaignNpc, HeroNpcRelation, HeroNpcStance } from '@/types'

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

/**
 * Radial BFS layout from the hero. Nodes only connected among NPCs are
 * placed on outer rings of their own components.
 */
export function layoutHeroNpcGraph(
  relations: HeroNpcRelation[],
  viewBox = 100,
): Map<string, GraphNodePos> {
  const cx = viewBox / 2
  const cy = viewBox / 2
  const adj = new Map<string, Set<string>>()

  function addEdge(a: string, b: string) {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }

  for (const r of relations) {
    addEdge(r.fromId, r.toId)
  }

  if (!adj.has(HERO_NPC_NODE_ID)) {
    adj.set(HERO_NPC_NODE_ID, new Set())
  }

  const positions = new Map<string, GraphNodePos>()
  positions.set(HERO_NPC_NODE_ID, { id: HERO_NPC_NODE_ID, x: cx, y: cy, depth: 0 })

  const depthOf = new Map<string, number>()
  depthOf.set(HERO_NPC_NODE_ID, 0)
  const queue = [HERO_NPC_NODE_ID]
  const visited = new Set<string>([HERO_NPC_NODE_ID])

  while (queue.length > 0) {
    const cur = queue.shift()!
    const depth = depthOf.get(cur) ?? 0
    for (const next of adj.get(cur) ?? []) {
      if (visited.has(next)) continue
      visited.add(next)
      depthOf.set(next, depth + 1)
      queue.push(next)
    }
  }

  const byDepth = new Map<number, string[]>()
  for (const [id, depth] of depthOf) {
    if (id === HERO_NPC_NODE_ID) continue
    const list = byDepth.get(depth) ?? []
    list.push(id)
    byDepth.set(depth, list)
  }

  const maxDepth = Math.max(0, ...byDepth.keys())
  for (const [depth, ids] of byDepth) {
    const n = ids.length
    const radius = maxDepth <= 1
      ? 34
      : 18 + (depth / maxDepth) * 30
    ids.forEach((id, i) => {
      const angle = n === 1
        ? -Math.PI / 2
        : (i / n) * Math.PI * 2 - Math.PI / 2
      positions.set(id, {
        id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        depth,
      })
    })
  }

  // Orphan components (no path to hero): fan them on the outer rim.
  const orphans = [...adj.keys()].filter((id) => !visited.has(id))
  if (orphans.length > 0) {
    // BFS each orphan component from its first node
    const placed = new Set(positions.keys())
    let orphanIndex = 0
    for (const start of orphans) {
      if (placed.has(start)) continue
      const comp: string[] = []
      const q = [start]
      const seen = new Set<string>([start])
      while (q.length) {
        const cur = q.shift()!
        comp.push(cur)
        for (const next of adj.get(cur) ?? []) {
          if (seen.has(next) || placed.has(next)) continue
          seen.add(next)
          q.push(next)
        }
      }
      const baseAngle = (orphanIndex / Math.max(1, orphans.length)) * Math.PI * 2
      orphanIndex += 1
      comp.forEach((id, i) => {
        const radius = 38
        const angle = baseAngle + (i - (comp.length - 1) / 2) * 0.35
        positions.set(id, {
          id,
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          depth: 99,
        })
        placed.add(id)
      })
    }
  }

  return positions
}
