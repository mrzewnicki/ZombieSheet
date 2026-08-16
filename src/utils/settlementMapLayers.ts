export type SettlementMapLayer = 'background' | 'objects'

export const SETTLEMENT_MAP_LAYERS = ['background', 'objects'] as const

export function isSettlementMapLayer(value: unknown): value is SettlementMapLayer {
  return value === 'background' || value === 'objects'
}

export function normalizeMapLayer(
  raw: unknown,
  fallback: SettlementMapLayer,
): SettlementMapLayer {
  return isSettlementMapLayer(raw) ? raw : fallback
}

/** Default layer for constructions (buildings). */
export const DEFAULT_CONSTRUCTION_LAYER: SettlementMapLayer = 'objects'
/** Default layer for terrain objects and zones. */
export const DEFAULT_BACKGROUND_LAYER: SettlementMapLayer = 'background'

export function constructionMapLayer(
  layer: SettlementMapLayer | undefined,
): SettlementMapLayer {
  return layer ?? DEFAULT_CONSTRUCTION_LAYER
}

export function objectMapLayer(
  layer: SettlementMapLayer | undefined,
): SettlementMapLayer {
  return layer ?? DEFAULT_BACKGROUND_LAYER
}

export function zoneMapLayer(
  layer: SettlementMapLayer | undefined,
): SettlementMapLayer {
  return layer ?? DEFAULT_BACKGROUND_LAYER
}
