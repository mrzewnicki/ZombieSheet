export interface AttributeDef {
  key: string
  /** i18n key under attributes.* */
  labelKey: string
  group: 'fizyczne' | 'mentalne' | 'umyslowe'
  docUrl: string
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
  docUrl: string
}

export interface SkillCategoryDef {
  key: string
  labelKey: string
  skills: SkillDef[]
}

const CECHY = 'https://mrzewnicki.github.io/MarkdownViewer/#/zombie/system/Cechy'
const UMIEJETNOSCI = 'https://mrzewnicki.github.io/MarkdownViewer/#/zombie/system/Umiej%C4%99tno%C5%9Bci'

export const ATTRIBUTE_GROUPS: AttributeGroupDef[] = [
  {
    key: 'fizyczne',
    labelKey: 'attributes.groups.fizyczne',
    attributes: [
      { key: 'sila',        labelKey: 'attributes.sila',        group: 'fizyczne', docUrl: `${CECHY}?s=si%C5%82a` },
      { key: 'zrecznosc',   labelKey: 'attributes.zrecznosc',   group: 'fizyczne', docUrl: `${CECHY}?s=zr%C4%99czno%C5%9B%C4%87` },
      { key: 'kondycja',    labelKey: 'attributes.kondycja',    group: 'fizyczne', docUrl: `${CECHY}?s=kondycja` },
    ],
  },
  {
    key: 'mentalne',
    labelKey: 'attributes.groups.mentalne',
    attributes: [
      { key: 'charyzma',     labelKey: 'attributes.charyzma',     group: 'mentalne', docUrl: `${CECHY}?s=charyzma` },
      { key: 'manipulacja',  labelKey: 'attributes.manipulacja',  group: 'mentalne', docUrl: `${CECHY}?s=manipulacja` },
      { key: 'opanowanie',   labelKey: 'attributes.opanowanie',   group: 'mentalne', docUrl: `${CECHY}?s=opanowanie` },
    ],
  },
  {
    key: 'umyslowe',
    labelKey: 'attributes.groups.umyslowe',
    attributes: [
      { key: 'inteligencja', labelKey: 'attributes.inteligencja', group: 'umyslowe', docUrl: `${CECHY}?s=inteligencja` },
      { key: 'spryt',        labelKey: 'attributes.spryt',        group: 'umyslowe', docUrl: `${CECHY}?s=spryt` },
      { key: 'determinacja', labelKey: 'attributes.determinacja', group: 'umyslowe', docUrl: `${CECHY}?s=determinacja` },
    ],
  },
]

export const SKILL_CATEGORIES: SkillCategoryDef[] = [
  {
    key: 'eksploracja',
    labelKey: 'skills.categories.eksploracja',
    skills: [
      { key: 'wspinaczka',         labelKey: 'skills.wspinaczka',         category: 'eksploracja', docUrl: `${UMIEJETNOSCI}?s=wspinaczka` },
      { key: 'plywanie',           labelKey: 'skills.plywanie',           category: 'eksploracja', docUrl: `${UMIEJETNOSCI}?s=p%C5%82ywanie` },
      { key: 'parkour',            labelKey: 'skills.parkour',            category: 'eksploracja', docUrl: `${UMIEJETNOSCI}?s=parkour` },
      { key: 'ukrywanie',          labelKey: 'skills.ukrywanie',          category: 'eksploracja', docUrl: `${UMIEJETNOSCI}?s=ukrywanie` },
      { key: 'wyszukiwanie',       labelKey: 'skills.wyszukiwanie',       category: 'eksploracja', docUrl: `${UMIEJETNOSCI}?s=wyszukiwanie` },
      { key: 'pojazdy',            labelKey: 'skills.pojazdy',            category: 'eksploracja', docUrl: `${UMIEJETNOSCI}?s=prowadzenie` },
      { key: 'nawigacja',          labelKey: 'skills.nawigacja',          category: 'eksploracja', docUrl: `${UMIEJETNOSCI}?s=nawigacja` },
    ],
  },
  {
    key: 'walka',
    labelKey: 'skills.categories.walka',
    skills: [
      { key: 'walka_wrecz',        labelKey: 'skills.walka_wrecz',        category: 'walka', docUrl: `${UMIEJETNOSCI}?s=walka+wrecz` },
      { key: 'bron_biala',         labelKey: 'skills.bron_biala',         category: 'walka', docUrl: `${UMIEJETNOSCI}?s=bro%C5%84+bia%C5%82a` },
      { key: 'bron_palna',         labelKey: 'skills.bron_palna',         category: 'walka', docUrl: `${UMIEJETNOSCI}?s=bro%C5%84+palna` },
      { key: 'bron_miotana',       labelKey: 'skills.bron_miotana',       category: 'walka', docUrl: `${UMIEJETNOSCI}?s=bro%C5%84+miotana` },
      { key: 'strzelectwo',        labelKey: 'skills.strzelectwo',        category: 'walka', docUrl: `${UMIEJETNOSCI}?s=strzelectwo` },
      { key: 'taktyka',            labelKey: 'skills.taktyka',            category: 'walka', docUrl: `${UMIEJETNOSCI}?s=taktyka` },
      { key: 'bron_ciezka',        labelKey: 'skills.bron_ciezka',        category: 'walka', docUrl: `${UMIEJETNOSCI}?s=bro%C5%84+palna+ci%C4%99%C5%BCka` },
    ],
  },
  {
    key: 'nauka',
    labelKey: 'skills.categories.nauka',
    skills: [
      { key: 'medycyna',           labelKey: 'skills.medycyna',           category: 'nauka', docUrl: `${UMIEJETNOSCI}?s=medycyna` },
      { key: 'chemia',             labelKey: 'skills.chemia',             category: 'nauka', docUrl: `${UMIEJETNOSCI}?s=chemia` },
      { key: 'fizyka',             labelKey: 'skills.fizyka',             category: 'nauka', docUrl: `${UMIEJETNOSCI}?s=fizyka` },
      { key: 'biologia',           labelKey: 'skills.biologia',           category: 'nauka', docUrl: `${UMIEJETNOSCI}?s=biologia` },
      { key: 'historia',           labelKey: 'skills.historia',           category: 'nauka', docUrl: `${UMIEJETNOSCI}?s=historia` },
      { key: 'szyfry',             labelKey: 'skills.szyfry',             category: 'nauka', docUrl: `${UMIEJETNOSCI}?s=szyfry` },
      { key: 'weterynaria',        labelKey: 'skills.weterynaria',        category: 'nauka', docUrl: `${UMIEJETNOSCI}?s=weterynaria` },
    ],
  },
  {
    key: 'wytwórstwo',
    labelKey: 'skills.categories.wytwórstwo',
    skills: [
      { key: 'mechanika',          labelKey: 'skills.mechanika',          category: 'wytwórstwo', docUrl: `${UMIEJETNOSCI}?s=mechanika` },
      { key: 'kowalstwo',          labelKey: 'skills.kowalstwo',          category: 'wytwórstwo', docUrl: `${UMIEJETNOSCI}?s=kowalstwo` },
      { key: 'rusznikarstwo',      labelKey: 'skills.rusznikarstwo',      category: 'wytwórstwo', docUrl: `${UMIEJETNOSCI}?s=rusznikarstwo` },
      { key: 'budownictwo',        labelKey: 'skills.budownictwo',        category: 'wytwórstwo', docUrl: `${UMIEJETNOSCI}?s=budownictwo` },
      { key: 'krawiectwo',         labelKey: 'skills.krawiectwo',         category: 'wytwórstwo', docUrl: `${UMIEJETNOSCI}?s=krawiectwo` },
      { key: 'kucharstwo',         labelKey: 'skills.kucharstwo',         category: 'wytwórstwo', docUrl: `${UMIEJETNOSCI}?s=kucharstwo` },
      { key: 'elektrotechnika',    labelKey: 'skills.elektrotechnika',    category: 'wytwórstwo', docUrl: `${UMIEJETNOSCI}?s=elektrotechnika` },
    ],
  },
  {
    key: 'spoleczne',
    labelKey: 'skills.categories.spoleczne',
    skills: [
      { key: 'zastraszanie',       labelKey: 'skills.zastraszanie',       category: 'spoleczne', docUrl: `${UMIEJETNOSCI}?s=zastraszanie` },
      { key: 'przekonywanie',      labelKey: 'skills.przekonywanie',      category: 'spoleczne', docUrl: `${UMIEJETNOSCI}?s=przekonywanie` },
      { key: 'oszustwo',           labelKey: 'skills.oszustwo',           category: 'spoleczne', docUrl: `${UMIEJETNOSCI}?s=oszustwo` },
      { key: 'dowodzenie',         labelKey: 'skills.dowodzenie',         category: 'spoleczne', docUrl: `${UMIEJETNOSCI}?s=dowodzenie` },
      { key: 'handel',             labelKey: 'skills.handel',             category: 'spoleczne', docUrl: `${UMIEJETNOSCI}?s=handel` },
      { key: 'wyczucie',           labelKey: 'skills.wyczucie',           category: 'spoleczne', docUrl: `${UMIEJETNOSCI}?s=wyczucie` },
      { key: 'hazard',             labelKey: 'skills.hazard',             category: 'spoleczne', docUrl: `${UMIEJETNOSCI}?s=hazard` },
    ],
  },
  {
    key: 'natura',
    labelKey: 'skills.categories.natura',
    skills: [
      { key: 'zielarstwo',         labelKey: 'skills.zielarstwo',         category: 'natura', docUrl: `${UMIEJETNOSCI}?s=zielarstwo` },
      { key: 'tresura',            labelKey: 'skills.tresura',            category: 'natura', docUrl: `${UMIEJETNOSCI}?s=tresura` },
      { key: 'hodowla',            labelKey: 'skills.hodowla',            category: 'natura', docUrl: `${UMIEJETNOSCI}?s=hodowla` },
      { key: 'jezdziectwo',        labelKey: 'skills.jezdziectwo',        category: 'natura', docUrl: `${UMIEJETNOSCI}?s=je%C5%BAdzie` },
      { key: 'pulapki',            labelKey: 'skills.pulapki',            category: 'natura', docUrl: `${UMIEJETNOSCI}?s=pu%C5%82apki` },
      { key: 'tropienie',          labelKey: 'skills.tropienie',          category: 'natura', docUrl: `${UMIEJETNOSCI}?s=tropienie` },
      { key: 'sztuka_przetrwania', labelKey: 'skills.sztuka_przetrwania', category: 'natura', docUrl: `${UMIEJETNOSCI}?s=sztuka+przetrwania` },
    ],
  },
  {
    key: 'okultyzm',
    labelKey: 'skills.categories.okultyzm',
    skills: [
      { key: 'zwyczaje_ocalałych', labelKey: 'skills.zwyczaje_ocalałych', category: 'okultyzm', docUrl: `${UMIEJETNOSCI}?s=zwyczaje` },
      { key: 'rytualy',            labelKey: 'skills.rytualy',            category: 'okultyzm', docUrl: `${UMIEJETNOSCI}?s=rytua%C5%82y` },
      { key: 'deathnet',           labelKey: 'skills.deathnet',           category: 'okultyzm', docUrl: `${UMIEJETNOSCI}?s=deathnet` },
      { key: 'anomalie',           labelKey: 'skills.anomalie',           category: 'okultyzm', docUrl: `${UMIEJETNOSCI}?s=anomalie` },
      { key: 'zombie',             labelKey: 'skills.zombie',             category: 'okultyzm', docUrl: `${UMIEJETNOSCI}?s=zombie` },
      { key: 'mutacje',            labelKey: 'skills.mutacje',            category: 'okultyzm', docUrl: `${UMIEJETNOSCI}?s=mutacje` },
      { key: 'snienie',            labelKey: 'skills.snienie',            category: 'okultyzm', docUrl: `${UMIEJETNOSCI}?s=%C5%9Bnienie` },
    ],
  },
]

/**
 * Increment this whenever the mechanics schema changes (new/removed attributes
 * or skills). Existing hero documents whose sheetVersion differs will show an
 * upgrade banner in HeroSheet.
 */
export const SHEET_VERSION = 6

/** Skill keys renamed between sheet versions. Applied during migration. */
export const SKILL_KEY_RENAMES: Record<string, string> = {
  manipulacja: 'oszustwo',
}

export const VITALS_DOC_URL =
  'https://mrzewnicki.github.io/MarkdownViewer/#/zombie/system/%C5%BBycie%20Zm%C4%99czenie%20i%20Stres'

export const MUTATIONS_DOC_URL =
  'https://mrzewnicki.github.io/MarkdownViewer/#/zombie/system/Mutacje%20i%20Ska%C5%BCenie'

export const ARMOR_DOC_URL =
  'https://mrzewnicki.github.io/MarkdownViewer/#/zombie/system/Ekwipunek/EkwipunekOchronny'

export type HeroRace = 'czlowiek' | 'zwierze' | 'zombie' | 'zmutowane_zwierze'

export interface RaceDef {
  key: HeroRace
  /** i18n key under vitals.races.* */
  labelKey: string
  /** Flat bonus added to max HP. */
  hpBonus: number
}

export const RACES: RaceDef[] = [
  { key: 'czlowiek',           labelKey: 'vitals.races.czlowiek',           hpBonus: 3 },
  { key: 'zwierze',            labelKey: 'vitals.races.zwierze',            hpBonus: 3 },
  { key: 'zombie',             labelKey: 'vitals.races.zombie',             hpBonus: 5 },
  { key: 'zmutowane_zwierze',  labelKey: 'vitals.races.zmutowane_zwierze',  hpBonus: 5 },
]

export const DEFAULT_RACE: HeroRace = 'czlowiek'

export function raceHpBonus(race: HeroRace): number {
  return RACES.find((r) => r.key === race)?.hpBonus ?? raceHpBonus(DEFAULT_RACE)
}

/** All attribute keys pre-initialised to 0. Used when creating a new hero. */
export const DEFAULT_ATTRIBUTES: Record<string, number> = Object.fromEntries(
  ATTRIBUTE_GROUPS.flatMap((g) => g.attributes.map((a) => [a.key, 0]))
)

/** All skill keys pre-initialised to 0. Used when creating a new hero. */
export const DEFAULT_SKILLS: Record<string, number> = Object.fromEntries(
  SKILL_CATEGORIES.flatMap((c) => c.skills.map((s) => [s.key, 0]))
)
