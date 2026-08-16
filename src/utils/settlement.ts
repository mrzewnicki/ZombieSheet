import {
  emptySettlementMaterials,
  isSettlementMaterialKey,
  type SettlementMaterialKey,
} from '@/config/settlementMaterials'
import type {
  Settlement,
  SettlementConnection,
  SettlementConstructionInstance,
  SettlementCustomConstruction,
  SettlementMapObjectInstance,
  SettlementNpc,
  SettlementTraitLine,
  SettlementTraitPolarity,
  SettlementZone,
  SettlementZonePoint,
} from '@/types'
import {
  normalizeConnectionEndSymbol,
  normalizeConnectionLineStyle,
  pruneSettlementConnections,
} from '@/utils/settlementConnections'
import { isSettlementMapObjectKey } from '@/config/settlementMapObjects'
import {
  isSettlementConstructionCategory,
} from '@/config/settlementConstructions'
import { DEFAULT_SETTLEMENT_ZONE_COLOR } from '@/utils/settlementZones'
import {
  DEFAULT_BACKGROUND_LAYER,
  DEFAULT_CONSTRUCTION_LAYER,
  normalizeMapLayer,
} from '@/utils/settlementMapLayers'
import {
  clampMapBackgroundOpacity,
  clampMapGridDim,
  DEFAULT_MAP_BACKGROUND_OPACITY,
} from '@/utils/settlementMapGrid'
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
    customConstructions: [],
    zones: [],
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
  const layer = normalizeMapLayer(src.layer, DEFAULT_CONSTRUCTION_LAYER)
  return {
    id,
    catalogKey,
    label: typeof src.label === 'string' ? src.label : '',
    x: clampPct(src.x, 50),
    y: clampPct(src.y, 50),
    notes: typeof src.notes === 'string' ? src.notes : '',
    ...(iconColor ? { iconColor } : {}),
    ...(bgColor ? { bgColor } : {}),
    ...(layer !== DEFAULT_CONSTRUCTION_LAYER ? { layer } : {}),
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
  const layer = normalizeMapLayer(src.layer, DEFAULT_BACKGROUND_LAYER)
  return {
    id,
    catalogKey,
    label: typeof src.label === 'string' ? src.label : '',
    x: clampPct(src.x, 50),
    y: clampPct(src.y, 50),
    notes: typeof src.notes === 'string' ? src.notes : '',
    ...(iconColor ? { iconColor } : {}),
    ...(bgColor ? { bgColor } : {}),
    ...(layer !== DEFAULT_BACKGROUND_LAYER ? { layer } : {}),
  }
}

function normalizeCustomConstruction(raw: unknown): SettlementCustomConstruction | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const id = typeof src.id === 'string' && src.id ? src.id : null
  if (!id) return null
  const categoryRaw = typeof src.category === 'string' ? src.category : 'podstawowe'
  return {
    id,
    name: typeof src.name === 'string' ? src.name : '',
    description: typeof src.description === 'string' ? src.description : '',
    category: isSettlementConstructionCategory(categoryRaw) ? categoryRaw : 'podstawowe',
    complexity: Math.max(1, nonNegInt(src.complexity, 1)),
    time: Math.max(1, nonNegInt(src.time, 1)),
    ...(typeof src.icon === 'string' && src.icon.trim()
      ? { icon: src.icon.trim() }
      : {}),
  }
}

function normalizeZonePoint(raw: unknown): SettlementZonePoint | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  return {
    x: clampPct(src.x, 50),
    y: clampPct(src.y, 50),
  }
}

function normalizeZone(raw: unknown): SettlementZone | null {
  if (!raw || typeof raw !== 'object') return null
  const src = raw as Record<string, unknown>
  const id = typeof src.id === 'string' && src.id ? src.id : null
  if (!id) return null
  const points = Array.isArray(src.points)
    ? src.points.map(normalizeZonePoint).filter((p): p is SettlementZonePoint => p != null)
    : []
  if (points.length < 3) return null
  const color = parseHexColor(src.color) || DEFAULT_SETTLEMENT_ZONE_COLOR
  const iconColor = parseHexColor(src.iconColor)
  const icon = typeof src.icon === 'string' && src.icon.trim() ? src.icon.trim() : undefined
  const layer = normalizeMapLayer(src.layer, DEFAULT_BACKGROUND_LAYER)
  // Default true — only persist the off state.
  const smoothCornersOff = src.smoothCorners === false
  return {
    id,
    name: typeof src.name === 'string' ? src.name : '',
    points,
    color,
    ...(icon ? { icon } : {}),
    ...(iconColor ? { iconColor } : {}),
    ...(layer !== DEFAULT_BACKGROUND_LAYER ? { layer } : {}),
    ...(smoothCornersOff ? { smoothCorners: false } : {}),
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
  const customConstructions = Array.isArray(raw.customConstructions)
    ? raw.customConstructions
      .map(normalizeCustomConstruction)
      .filter((c): c is SettlementCustomConstruction => c != null)
    : []
  const zones = Array.isArray(raw.zones)
    ? raw.zones.map(normalizeZone).filter((z): z is SettlementZone => z != null)
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
    customConstructions,
    zones,
    connections,
    npcs,
    traits: Array.isArray(raw.traits)
      ? raw.traits.map(normalizeTrait).filter((t): t is SettlementTraitLine => t != null)
      : [],
    map: {
      width: clampMapGridDim(mapRaw.width, empty.map.width),
      height: clampMapGridDim(mapRaw.height, empty.map.height),
      ...(typeof mapRaw.backgroundImageURL === 'string' && mapRaw.backgroundImageURL.trim()
        ? { backgroundImageURL: mapRaw.backgroundImageURL.trim() }
        : {}),
      ...(typeof mapRaw.backgroundStoragePath === 'string' && mapRaw.backgroundStoragePath.trim()
        ? { backgroundStoragePath: mapRaw.backgroundStoragePath.trim() }
        : {}),
      backgroundOpacity: clampMapBackgroundOpacity(
        mapRaw.backgroundOpacity,
        DEFAULT_MAP_BACKGROUND_OPACITY,
      ),
      snapToGrid: mapRaw.snapToGrid === true,
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
      ...(c.layer && c.layer !== DEFAULT_CONSTRUCTION_LAYER ? { layer: c.layer } : {}),
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
      ...(o.layer && o.layer !== DEFAULT_BACKGROUND_LAYER ? { layer: o.layer } : {}),
    })),
    customConstructions: settlement.customConstructions.map((c) => ({
      id: c.id,
      name: c.name.trim(),
      description: c.description.trim(),
      category: isSettlementConstructionCategory(c.category) ? c.category : 'podstawowe',
      complexity: Math.max(1, nonNegInt(c.complexity, 1)),
      time: Math.max(1, nonNegInt(c.time, 1)),
      ...(c.icon?.trim() ? { icon: c.icon.trim() } : {}),
    })),
    zones: settlement.zones.map((z) => ({
      id: z.id,
      name: z.name.trim(),
      points: z.points.map((p) => ({
        x: clampPct(p.x, 50),
        y: clampPct(p.y, 50),
      })),
      color: parseHexColor(z.color) || DEFAULT_SETTLEMENT_ZONE_COLOR,
      ...(z.icon?.trim() ? { icon: z.icon.trim() } : {}),
      ...(z.iconColor ? { iconColor: z.iconColor } : {}),
      ...(z.layer && z.layer !== DEFAULT_BACKGROUND_LAYER ? { layer: z.layer } : {}),
      ...(z.smoothCorners === false ? { smoothCorners: false } : {}),
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
      width: clampMapGridDim(settlement.map.width, 20),
      height: clampMapGridDim(settlement.map.height, 20),
      // Always write nested flags — setDoc({ merge:true }) keeps omitted nested keys.
      snapToGrid: settlement.map.snapToGrid === true,
      // Drop legacy hex gridType if present in older docs.
      gridType: 'square',
      backgroundImageURL: settlement.map.backgroundImageURL?.trim() ?? '',
      backgroundStoragePath: settlement.map.backgroundStoragePath?.trim() ?? '',
      backgroundOpacity: clampMapBackgroundOpacity(
        settlement.map.backgroundOpacity,
        DEFAULT_MAP_BACKGROUND_OPACITY,
      ),
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

export function newCustomConstruction(input: {
  name: string
  description?: string
  category?: string
  complexity?: number
  time?: number
  icon?: string
}): SettlementCustomConstruction {
  const category = input.category && isSettlementConstructionCategory(input.category)
    ? input.category
    : 'podstawowe'
  const icon = input.icon?.trim()
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: (input.description ?? '').trim(),
    category,
    complexity: Math.max(1, Math.trunc(input.complexity ?? 1) || 1),
    time: Math.max(1, Math.trunc(input.time ?? 1) || 1),
    ...(icon ? { icon } : {}),
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
