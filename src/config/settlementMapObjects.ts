export type SettlementMapObjectKey = 'las' | 'kamienie' | 'woda' | 'zwierzeta'

export interface SettlementMapObjectDef {
  key: SettlementMapObjectKey
  /** Polish display name. */
  name: string
  /** English display name. */
  nameEn: string
  description: string
  descriptionEn: string
  defaultIconColor: string
  defaultBgColor: string
}

export const SETTLEMENT_MAP_OBJECTS: readonly SettlementMapObjectDef[] = [
  {
    key: 'las',
    name: 'Las',
    nameEn: 'Forest',
    description: 'Zadrzewiony obszar wokół osady — osłona, drewno, zwierzyna.',
    descriptionEn: 'Wooded area around the settlement — cover, timber, game.',
    defaultIconColor: '#5a7a4a',
    defaultBgColor: '#0e0a07',
  },
  {
    key: 'kamienie',
    name: 'Kamienie',
    nameEn: 'Rocks',
    description: 'Skaliste formacje lub złoża kamienia do budowy i osłony.',
    descriptionEn: 'Rocky formations or stone deposits for building and cover.',
    defaultIconColor: '#8a7a5a',
    defaultBgColor: '#0e0a07',
  },
  {
    key: 'woda',
    name: 'Woda',
    nameEn: 'Water',
    description: 'Źródło, staw lub rzeka — woda pitna i naturalna bariera.',
    descriptionEn: 'Spring, pond, or river — drinking water and a natural barrier.',
    defaultIconColor: '#5a6a7a',
    defaultBgColor: '#0e0a07',
  },
  {
    key: 'zwierzeta',
    name: 'Zwierzęta',
    nameEn: 'Animals',
    description: 'Siedlisko zwierząt — łowiectwo, zagrożenie lub hodowla.',
    descriptionEn: 'Animal habitat — hunting, threat, or livestock.',
    defaultIconColor: '#a89050',
    defaultBgColor: '#0e0a07',
  },
] as const

const BY_KEY = new Map(SETTLEMENT_MAP_OBJECTS.map((d) => [d.key, d]))

export function isSettlementMapObjectKey(key: string): key is SettlementMapObjectKey {
  return BY_KEY.has(key as SettlementMapObjectKey)
}

export function getSettlementMapObject(key: string): SettlementMapObjectDef | undefined {
  return BY_KEY.get(key as SettlementMapObjectKey)
}

export function mapObjectLocalizedName(def: SettlementMapObjectDef, lang: string): string {
  return lang.startsWith('en') ? def.nameEn : def.name
}

export function mapObjectLocalizedDescription(def: SettlementMapObjectDef, lang: string): string {
  return lang.startsWith('en') ? def.descriptionEn : def.description
}
