import {
  emptySettlementMaterials,
  isSettlementMaterialKey,
  type SettlementMaterialKey,
} from '@/config/settlementMaterials'
import type {
  Settlement,
  SettlementConnection,
  SettlementConstructionInstance,
  SettlementMapObjectInstance,
  SettlementNpc,
  SettlementTraitLine,
  SettlementTraitPolarity,
} from '@/types'
import {
  normalizeConnectionEndSymbol,
  normalizeConnectionLineStyle,
  pruneSettlementConnections,
} from '@/utils/settlementConnections'
import { isSettlementMapObjectKey } from '@/config/settlementMapObjects'
export const SETTLEMENT_DOC_ID = 'main'
export const SETTLEMENT_COLLECTION = 'settlement'

export function emptySettlement(id = SETTLEMENT_DOC_ID): Settlement {
  return {
    id,
    name: '',
    description: '',
    materials: emptySettlementMaterials(),
    constructions: [],
    objects: [],
    connections: [],
    npcs: [],
    traits: [],
    map: { width: 20, height: 20 },
  }
}

function nonNegInt(value: unknown, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.trunc(value))
}

function clampPct(value: unknown, fallback = 50): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(0, Math.min(100, value))
}

function normalizeMaterials(raw: unknown): Record<SettlementMaterialKey, number> {
  const base = emptySettlementMaterials()
  if (!raw || typeof raw !== 'object') return base
  const src = raw as Record<string, unknown>
  for (const key of Object.keys(base) as SettlementMaterialKey[]) {
    base[key] = nonNegInt(src[key], 0)
  }
  for (const [key, value] of Object.entries(src)) {
    if (!isSettlementMaterialKey(key)) continue
    base[key] = nonNegInt(value, 0)
  }
  return base
}

function parseHexColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const c = raw.trim()
  return /^#[0-9A-Fa-f]{6}$/.test(c) ? c : undefined
}

function normalizeConstruction(raw: unknown): SettlementConstructionInstance | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const id = typeof src.id === 'string' && src.id ? src.id : null
  const catalogKey = typeof src.catalogKey === 'string' ? src.catalogKey : ''
  if (!id || !catalogKey) return null
  const iconColor = parseHexColor(src.iconColor)
  const bgColor = parseHexColor(src.bgColor)
  return {
    id,
    catalogKey,
    label: typeof src.label === 'string' ? src.label : '',
    x: clampPct(src.x, 50),
    y: clampPct(src.y, 50),
    notes: typeof src.notes === 'string' ? src.notes : '',
    ...(iconColor ? { iconColor } : {}),
    ...(bgColor ? { bgColor } : {}),
  }
}

function normalizeMapObject(raw: unknown): SettlementMapObjectInstance | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const id = typeof src.id === 'string' && src.id ? src.id : null
  const catalogKey = typeof src.catalogKey === 'string' ? src.catalogKey : ''
  if (!id || !catalogKey || !isSettlementMapObjectKey(catalogKey)) return null
  const iconColor = parseHexColor(src.iconColor)
  const bgColor = parseHexColor(src.bgColor)
  return {
    id,
    catalogKey,
    label: typeof src.label === 'string' ? src.label : '',
    x: clampPct(src.x, 50),
    y: clampPct(src.y, 50),
    notes: typeof src.notes === 'string' ? src.notes : '',
    ...(iconColor ? { iconColor } : {}),
    ...(bgColor ? { bgColor } : {}),
  }
}

function normalizeConnection(raw: unknown): SettlementConnection | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const id = typeof src.id === 'string' && src.id ? src.id : null
  const fromId = typeof src.fromId === 'string' ? src.fromId : ''
  const toId = typeof src.toId === 'string' ? src.toId : ''
  if (!id || !fromId || !toId || fromId === toId) return null
  const swapped = fromId > toId
  const ends = swapped ? { fromId: toId, toId: fromId } : { fromId, toId }
  const color = parseHexColor(src.color)
  const lineStyle = normalizeConnectionLineStyle(src.lineStyle)
  let endSymbol = normalizeConnectionEndSymbol(src.endSymbol)
  if (swapped && endSymbol === 'arrowTo') endSymbol = 'arrowFrom'
  else if (swapped && endSymbol === 'arrowFrom') endSymbol = 'arrowTo'
  return {
    id,
    ...ends,
    ...(color ? { color } : {}),
    ...(lineStyle ? { lineStyle } : {}),
    ...(endSymbol ? { endSymbol } : {}),
  }
}

function normalizeNpc(raw: unknown): SettlementNpc | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const id = typeof src.id === 'string' && src.id ? src.id : null
  if (!id) return null
  const campaignNpcId =
    typeof src.campaignNpcId === 'string' && src.campaignNpcId
      ? src.campaignNpcId
      : undefined
  return {
    id,
    name: typeof src.name === 'string' ? src.name : '',
    role: typeof src.role === 'string' ? src.role : '',
    constructionId: typeof src.constructionId === 'string' ? src.constructionId : '',
    imageURL: typeof src.imageURL === 'string' ? src.imageURL : '',
    notes: typeof src.notes === 'string' ? src.notes : '',
    ...(campaignNpcId ? { campaignNpcId } : {}),
  }
}

function normalizeTrait(raw: unknown): SettlementTraitLine | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const id = typeof src.id === 'string' && src.id ? src.id : null
  if (!id) return null
  const polarity: SettlementTraitPolarity =
    src.polarity === 'negative' ? 'negative' : 'positive'
  return {
    id,
    name: typeof src.name === 'string' ? src.name : '',
    polarity,
    description: typeof src.description === 'string' ? src.description : '',
    value: nonNegInt(src.value, 0),
  }
}

/** Clear construction assignments that point at missing buildings. */
export function pruneSettlementNpcs(
  npcs: SettlementNpc[],
  constructions: SettlementConstructionInstance[],
): SettlementNpc[] {
  const ids = new Set(constructions.map((c) => c.id))
  return npcs.map((npc) => ({
    ...npc,
    constructionId: npc.constructionId && ids.has(npc.constructionId) ? npc.constructionId : '',
  }))
}

export function normalizeSettlement(id: string, raw: Record<string, unknown> | undefined | null): Settlement {
  const empty = emptySettlement(id)
  if (!raw) return empty
  const mapRaw = raw.map && typeof raw.map === 'object'
    ? raw.map as Record<string, unknown>
    : {}
  const constructions = Array.isArray(raw.constructions)
    ? raw.constructions.map(normalizeConstruction).filter((c): c is SettlementConstructionInstance => c != null)
    : []
  const objects = Array.isArray(raw.objects)
    ? raw.objects.map(normalizeMapObject).filter((o): o is SettlementMapObjectInstance => o != null)
    : []
  const connections = pruneSettlementConnections(
    Array.isArray(raw.connections)
      ? raw.connections.map(normalizeConnection).filter((c): c is SettlementConnection => c != null)
      : [],
    constructions,
  )
  const npcs = pruneSettlementNpcs(
    Array.isArray(raw.npcs)
      ? raw.npcs.map(normalizeNpc).filter((n): n is SettlementNpc => n != null)
      : [],
    constructions,
  )
  return {
    id,
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    materials: normalizeMaterials(raw.materials),
    constructions,
    objects,
    connections,
    npcs,
    traits: Array.isArray(raw.traits)
      ? raw.traits.map(normalizeTrait).filter((t): t is SettlementTraitLine => t != null)
      : [],
    map: {
      width: Math.max(1, nonNegInt(mapRaw.width, empty.map.width)),
      height: Math.max(1, nonNegInt(mapRaw.height, empty.map.height)),
    },
    updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined,
  }
}

export function settlementPayload(settlement: Settlement, uid?: string) {
  const npcs = pruneSettlementNpcs(settlement.npcs, settlement.constructions)
  return {
    name: settlement.name.trim(),
    description: settlement.description.trim(),
    materials: settlement.materials,
    constructions: settlement.constructions.map((c) => ({
      id: c.id,
      catalogKey: c.catalogKey,
      label: c.label.trim(),
      x: clampPct(c.x, 50),
      y: clampPct(c.y, 50),
      notes: c.notes.trim(),
      ...(c.iconColor ? { iconColor: c.iconColor } : {}),
      ...(c.bgColor ? { bgColor: c.bgColor } : {}),
    })),
    objects: settlement.objects.map((o) => ({
      id: o.id,
      catalogKey: o.catalogKey,
      label: o.label.trim(),
      x: clampPct(o.x, 50),
      y: clampPct(o.y, 50),
      notes: o.notes.trim(),
      ...(o.iconColor ? { iconColor: o.iconColor } : {}),
      ...(o.bgColor ? { bgColor: o.bgColor } : {}),
    })),
    connections: pruneSettlementConnections(settlement.connections, settlement.constructions).map((c) => ({
      id: c.id,
      fromId: c.fromId,
      toId: c.toId,
      ...(c.color ? { color: c.color } : {}),
      ...(c.lineStyle ? { lineStyle: c.lineStyle } : {}),
      ...(c.endSymbol ? { endSymbol: c.endSymbol } : {}),
    })),
    npcs: npcs.map((n) => ({
      id: n.id,
      name: n.name.trim(),
      role: n.role.trim(),
      constructionId: n.constructionId,
      imageURL: n.imageURL.trim(),
      notes: n.notes.trim(),
      ...(n.campaignNpcId ? { campaignNpcId: n.campaignNpcId } : {}),
    })),
    traits: settlement.traits.map((t) => ({
      id: t.id,
      name: t.name.trim(),
      polarity: t.polarity,
      description: t.description.trim(),
      value: nonNegInt(t.value, 0),
    })),
    map: {
      width: settlement.map.width,
      height: settlement.map.height,
    },
    updatedBy: uid ?? settlement.updatedBy ?? null,
  }
}

export function newConstructionInstance(
  catalogKey: string,
  x = 50,
  y = 50,
): SettlementConstructionInstance {
  return {
    id: crypto.randomUUID(),
    catalogKey,
    label: '',
    x: clampPct(x, 50),
    y: clampPct(y, 50),
    notes: '',
  }
}

export function newMapObjectInstance(
  catalogKey: string,
  x = 50,
  y = 50,
): SettlementMapObjectInstance {
  return {
    id: crypto.randomUUID(),
    catalogKey,
    label: '',
    x: clampPct(x, 50),
    y: clampPct(y, 50),
    notes: '',
  }
}

export function newSettlementTrait(
  polarity: SettlementTraitPolarity = 'positive',
): SettlementTraitLine {
  return {
    id: crypto.randomUUID(),
    name: '',
    polarity,
    description: '',
    value: 0,
  }
}

export function newSettlementNpc(): SettlementNpc {
  return {
    id: crypto.randomUUID(),
    name: '',
    role: '',
    constructionId: '',
    imageURL: '',
    notes: '',
  }
}

/** Snapshot a campaign NPC into the settlement community list. */
export function settlementNpcFromCampaign(
  campaign: { id: string; name: string; role: string; imageURL: string; notes: string },
): SettlementNpc {
  return {
    id: crypto.randomUUID(),
    campaignNpcId: campaign.id,
    name: campaign.name,
    role: campaign.role,
    constructionId: '',
    imageURL: campaign.imageURL,
    notes: campaign.notes,
  }
}

/** Campaign NPCs not yet present in the settlement community. */
export function availableCampaignNpcsForSettlement<T extends { id: string }>(
  campaignNpcs: T[],
  settlementNpcs: SettlementNpc[],
): T[] {
  const linked = new Set(
    settlementNpcs.flatMap((n) =>
      n.campaignNpcId ? [n.campaignNpcId] : [],
    ),
  )
  return campaignNpcs.filter((c) => !linked.has(c.id))
}

/** Display name: custom label or catalog key for i18n lookup. */
export function constructionDisplayKey(instance: SettlementConstructionInstance): string {
  return instance.label.trim() || instance.catalogKey
}
