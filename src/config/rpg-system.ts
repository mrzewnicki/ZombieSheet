export interface AttributeDef {
  key: string
  /** i18n key under attributes.* */
  labelKey: string
  group: 'fizyczne' | 'mentalne' | 'umyslowe'
}

export interface AttributeGroupDef {
  key: 'fizyczne' | 'mentalne' | 'umyslowe'
  labelKey: string
  attributes: AttributeDef[]
}

export interface SkillDef {
  key: string
  labelKey: string
  category: string
}

export interface SkillCategoryDef {
  key: string
  labelKey: string
  skills: SkillDef[]
}

export const ATTRIBUTE_GROUPS: AttributeGroupDef[] = [
  {
    key: 'fizyczne',
    labelKey: 'attributes.groups.fizyczne',
    attributes: [
      { key: 'zdrowie',     labelKey: 'attributes.zdrowie',     group: 'fizyczne' },
      { key: 'kondycja',    labelKey: 'attributes.kondycja',    group: 'fizyczne' },
      { key: 'precyzja',    labelKey: 'attributes.precyzja',    group: 'fizyczne' },
      { key: 'tezyzna',     labelKey: 'attributes.tezyzna',     group: 'fizyczne' },
    ],
  },
  {
    key: 'mentalne',
    labelKey: 'attributes.groups.mentalne',
    attributes: [
      { key: 'opanowanie',   labelKey: 'attributes.opanowanie',   group: 'mentalne' },
      { key: 'determinacja', labelKey: 'attributes.determinacja', group: 'mentalne' },
      { key: 'empatia',      labelKey: 'attributes.empatia',      group: 'mentalne' },
      { key: 'ego',          labelKey: 'attributes.ego',          group: 'mentalne' },
    ],
  },
  {
    key: 'umyslowe',
    labelKey: 'attributes.groups.umyslowe',
    attributes: [
      { key: 'rozsadek',     labelKey: 'attributes.rozsadek',     group: 'umyslowe' },
      { key: 'percepcja',    labelKey: 'attributes.percepcja',    group: 'umyslowe' },
      { key: 'inteligencja', labelKey: 'attributes.inteligencja', group: 'umyslowe' },
      { key: 'kreatywnosc',  labelKey: 'attributes.kreatywnosc',  group: 'umyslowe' },
    ],
  },
]

export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  {
    key: 'eksploracja',
    labelKey: 'skills.categories.eksploracja',
    skills: [
      { key: 'wspinaczka',         labelKey: 'skills.wspinaczka',         category: 'eksploracja' },
      { key: 'plywanie',           labelKey: 'skills.plywanie',           category: 'eksploracja' },
      { key: 'parkour',            labelKey: 'skills.parkour',            category: 'eksploracja' },
      { key: 'ukrywanie',          labelKey: 'skills.ukrywanie',          category: 'eksploracja' },
      { key: 'wyszukiwanie',       labelKey: 'skills.wyszukiwanie',       category: 'eksploracja' },
      { key: 'pojazdy',            labelKey: 'skills.pojazdy',            category: 'eksploracja' },
      { key: 'nawigacja',          labelKey: 'skills.nawigacja',          category: 'eksploracja' },
    ],
  },
  {
    key: 'walka',
    labelKey: 'skills.categories.walka',
    skills: [
      { key: 'walka_wrecz',        labelKey: 'skills.walka_wrecz',        category: 'walka' },
      { key: 'bron_biala',         labelKey: 'skills.bron_biala',         category: 'walka' },
      { key: 'bron_palna',         labelKey: 'skills.bron_palna',         category: 'walka' },
      { key: 'bron_miotana',       labelKey: 'skills.bron_miotana',       category: 'walka' },
      { key: 'strzelectwo',        labelKey: 'skills.strzelectwo',        category: 'walka' },
      { key: 'taktyka',            labelKey: 'skills.taktyka',            category: 'walka' },
      { key: 'bron_ciezka',        labelKey: 'skills.bron_ciezka',        category: 'walka' },
    ],
  },
  {
    key: 'nauka',
    labelKey: 'skills.categories.nauka',
    skills: [
      { key: 'medycyna',           labelKey: 'skills.medycyna',           category: 'nauka' },
      { key: 'chemia',             labelKey: 'skills.chemia',             category: 'nauka' },
      { key: 'fizyka',             labelKey: 'skills.fizyka',             category: 'nauka' },
      { key: 'biologia',           labelKey: 'skills.biologia',           category: 'nauka' },
      { key: 'historia',           labelKey: 'skills.historia',           category: 'nauka' },
      { key: 'szyfry',             labelKey: 'skills.szyfry',             category: 'nauka' },
      { key: 'weterynaria',        labelKey: 'skills.weterynaria',        category: 'nauka' },
    ],
  },
  {
    key: 'wytwórstwo',
    labelKey: 'skills.categories.wytwórstwo',
    skills: [
      { key: 'mechanika',          labelKey: 'skills.mechanika',          category: 'wytwórstwo' },
      { key: 'kowalstwo',          labelKey: 'skills.kowalstwo',          category: 'wytwórstwo' },
      { key: 'rusznikarstwo',      labelKey: 'skills.rusznikarstwo',      category: 'wytwórstwo' },
      { key: 'budownictwo',        labelKey: 'skills.budownictwo',        category: 'wytwórstwo' },
      { key: 'krawiectwo',         labelKey: 'skills.krawiectwo',         category: 'wytwórstwo' },
      { key: 'kucharstwo',         labelKey: 'skills.kucharstwo',         category: 'wytwórstwo' },
      { key: 'elektrotechnika',    labelKey: 'skills.elektrotechnika',    category: 'wytwórstwo' },
    ],
  },
  {
    key: 'spoleczne',
    labelKey: 'skills.categories.spoleczne',
    skills: [
      { key: 'zastraszanie',       labelKey: 'skills.zastraszanie',       category: 'spoleczne' },
      { key: 'przekonywanie',      labelKey: 'skills.przekonywanie',      category: 'spoleczne' },
      { key: 'manipulacja',        labelKey: 'skills.manipulacja',        category: 'spoleczne' },
      { key: 'dowodzenie',         labelKey: 'skills.dowodzenie',         category: 'spoleczne' },
      { key: 'handel',             labelKey: 'skills.handel',             category: 'spoleczne' },
      { key: 'wyczucie',           labelKey: 'skills.wyczucie',           category: 'spoleczne' },
    ],
  },
  {
    key: 'natura',
    labelKey: 'skills.categories.natura',
    skills: [
      { key: 'zielarstwo',         labelKey: 'skills.zielarstwo',         category: 'natura' },
      { key: 'tresura',            labelKey: 'skills.tresura',            category: 'natura' },
      { key: 'hodowla',            labelKey: 'skills.hodowla',            category: 'natura' },
      { key: 'jezdziectwo',        labelKey: 'skills.jezdziectwo',        category: 'natura' },
      { key: 'pulapki',            labelKey: 'skills.pulapki',            category: 'natura' },
      { key: 'tropienie',          labelKey: 'skills.tropienie',          category: 'natura' },
    ],
  },
  {
    key: 'okultyzm',
    labelKey: 'skills.categories.okultyzm',
    skills: [
      { key: 'zwyczaje_ocalałych', labelKey: 'skills.zwyczaje_ocalałych', category: 'okultyzm' },
      { key: 'rytualy',            labelKey: 'skills.rytualy',            category: 'okultyzm' },
      { key: 'deathnet',           labelKey: 'skills.deathnet',           category: 'okultyzm' },
      { key: 'livecore',           labelKey: 'skills.livecore',           category: 'okultyzm' },
      { key: 'zombie',             labelKey: 'skills.zombie',             category: 'okultyzm' },
      { key: 'mutacje',            labelKey: 'skills.mutacje',            category: 'okultyzm' },
    ],
  },
]

/**
 * Increment this whenever the mechanics schema changes (new/removed attributes
 * or skills). Existing hero documents whose sheetVersion differs will show an
 * upgrade banner in HeroSheet.
 */
export const SHEET_VERSION = 1

/** All attribute keys pre-initialised to 0. Used when creating a new hero. */
export const DEFAULT_ATTRIBUTES: Record<string, number> = Object.fromEntries(
  ATTRIBUTE_GROUPS.flatMap((g) => g.attributes.map((a) => [a.key, 0]))
)

/** All skill keys pre-initialised to 0. Used when creating a new hero. */
export const DEFAULT_SKILLS: Record<string, number> = Object.fromEntries(
  SKILL_CATEGORIES.flatMap((c) => c.skills.map((s) => [s.key, 0]))
)
