import {
  SETTLEMENT_MATERIAL_KEYS,
  type SettlementMaterialKey,
} from '@/config/settlementMaterials'
import {
  resolveSettlementConstruction,
} from '@/config/settlementConstructions'
import type { SettlementCustomConstruction } from '@/types'
import { emptySettlementMaterials } from '@/config/settlementMaterials'

export interface BuildTxnEntry {
  instanceId: string
  catalogKey: string
  /** +1 = added in this transaction, -1 = removed a pre-existing construction. */
  delta: 1 | -1
}

export type MaterialDelta = Record<SettlementMaterialKey, number>

export function emptyMaterialDelta(): MaterialDelta {
  return emptySettlementMaterials()
}

export function constructionMaterialCost(
  catalogKey: string,
  customs: SettlementCustomConstruction[] = [],
): MaterialDelta {
  const cost = emptyMaterialDelta()
  const def = resolveSettlementConstruction(catalogKey, customs)
  if (!def) return cost
  for (const key of SETTLEMENT_MATERIAL_KEYS) {
    const n = def.materials[key]
    if (typeof n === 'number' && n > 0) cost[key] = n
  }
  return cost
}

/** Apply add/remove of one construction into the ledger. */
export function applyBuildTxnChange(
  entries: BuildTxnEntry[],
  instanceId: string,
  catalogKey: string,
  change: 'add' | 'remove',
): BuildTxnEntry[] {
  if (change === 'add') {
    return [...entries, { instanceId, catalogKey, delta: 1 }]
  }
  const addIdx = entries.findIndex((e) => e.instanceId === instanceId && e.delta === 1)
  if (addIdx >= 0) {
    return entries.filter((_, i) => i !== addIdx)
  }
  if (entries.some((e) => e.instanceId === instanceId && e.delta === -1)) {
    return entries
  }
  return [...entries, { instanceId, catalogKey, delta: -1 }]
}

/** Net materials to subtract (negative = refund). */
export function summarizeBuildTxnCost(
  entries: BuildTxnEntry[],
  customs: SettlementCustomConstruction[] = [],
): MaterialDelta {
  const total = emptyMaterialDelta()
  for (const entry of entries) {
    const cost = constructionMaterialCost(entry.catalogKey, customs)
    for (const key of SETTLEMENT_MATERIAL_KEYS) {
      total[key] += cost[key] * entry.delta
    }
  }
  return total
}

export function materialDeltaHasValues(delta: MaterialDelta): boolean {
  return SETTLEMENT_MATERIAL_KEYS.some((key) => delta[key] !== 0)
}

/** True if stock covers all positive deductions. */
export function canAffordMaterialDelta(
  materials: Record<string, number>,
  delta: MaterialDelta,
): boolean {
  for (const key of SETTLEMENT_MATERIAL_KEYS) {
    const need = delta[key]
    if (need > 0 && (materials[key] ?? 0) < need) return false
  }
  return true
}

/** Subtract delta from stock (refunds when delta is negative). Never below 0. */
export function applyMaterialDelta(
  materials: Record<string, number>,
  delta: MaterialDelta,
): Record<SettlementMaterialKey, number> {
  const next = emptySettlementMaterials()
  for (const key of SETTLEMENT_MATERIAL_KEYS) {
    next[key] = Math.max(0, (materials[key] ?? 0) - delta[key])
  }
  return next
}
