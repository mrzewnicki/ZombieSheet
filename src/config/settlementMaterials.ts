/** Settlement material catalog keys (system docs: Materiały). */
export const SETTLEMENT_MATERIAL_KEYS = [
  'drewno',
  'spoiwa',
  'kamien',
  'metal',
  'chemia',
  'elektryka',
  'szklo',
  'tkanina',
] as const

export type SettlementMaterialKey = (typeof SETTLEMENT_MATERIAL_KEYS)[number]

export interface SettlementMaterialDef {
  key: SettlementMaterialKey
  /** Barter / rarity scale 1–5. */
  value: number
  /** Free-text property tags from the system (e.g. −Łatwopalny1). */
  properties: string
  /** i18n key under settlement.materials.{key}.name / .description */
  labelKey: string
  descriptionKey: string
}

export const SETTLEMENT_MATERIALS: SettlementMaterialDef[] = [
  {
    key: 'drewno',
    value: 1,
    properties: '−Wrażliwy na wilgoć1 −Łatwopalny1',
    labelKey: 'settlement.materials.drewno.name',
    descriptionKey: 'settlement.materials.drewno.description',
  },
  {
    key: 'spoiwa',
    value: 1,
    properties: '',
    labelKey: 'settlement.materials.spoiwa.name',
    descriptionKey: 'settlement.materials.spoiwa.description',
  },
  {
    key: 'kamien',
    value: 2,
    properties: '',
    labelKey: 'settlement.materials.kamien.name',
    descriptionKey: 'settlement.materials.kamien.description',
  },
  {
    key: 'metal',
    value: 2,
    properties: '',
    labelKey: 'settlement.materials.metal.name',
    descriptionKey: 'settlement.materials.metal.description',
  },
  {
    key: 'chemia',
    value: 3,
    properties: '✚Wielofunkcyjny −Łatwopalny3',
    labelKey: 'settlement.materials.chemia.name',
    descriptionKey: 'settlement.materials.chemia.description',
  },
  {
    key: 'elektryka',
    value: 3,
    properties: '−Wrażliwy na wilgoć4',
    labelKey: 'settlement.materials.elektryka.name',
    descriptionKey: 'settlement.materials.elektryka.description',
  },
  {
    key: 'szklo',
    value: 3,
    properties: '−Kruchy4',
    labelKey: 'settlement.materials.szklo.name',
    descriptionKey: 'settlement.materials.szklo.description',
  },
  {
    key: 'tkanina',
    value: 3,
    properties: '',
    labelKey: 'settlement.materials.tkanina.name',
    descriptionKey: 'settlement.materials.tkanina.description',
  },
]

export function emptySettlementMaterials(): Record<SettlementMaterialKey, number> {
  return Object.fromEntries(
    SETTLEMENT_MATERIAL_KEYS.map((key) => [key, 0]),
  ) as Record<SettlementMaterialKey, number>
}

export function isSettlementMaterialKey(value: string): value is SettlementMaterialKey {
  return (SETTLEMENT_MATERIAL_KEYS as readonly string[]).includes(value)
}
