import { Timestamp } from 'firebase/firestore'

export type { ChatMessage, ContextRef, ContextRefType } from './chat'

export type GameRole = 'gm' | 'player'

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL: string
  createdAt: Timestamp
}

export interface Game {
  id: string
  title: string
  description: string
  masterId: string
  inviteToken: string
  createdAt: Timestamp
}

export interface GameMember {
  uid: string
  role: GameRole
  displayName: string
  photoURL: string
  nick?: string
  joinedAt: Timestamp
}

/** Resolves the display label for a member: nick takes priority over account displayName. */
export function memberLabel(m: Pick<GameMember, 'nick' | 'displayName'>): string {
  return m.nick?.trim() || m.displayName
}

/** Resolves the full display name for a hero, with an optional fallback when both fields are empty. */
export function heroFullName(
  hero: Pick<Hero, 'name' | 'surname'>,
  fallback = '—'
): string {
  return [hero.name, hero.surname].filter(Boolean).join(' ') || fallback
}

import type { HeroRace } from '@/config/rpg-system'

export type { HeroRace }

export interface HeroContamination {
  deathNet: number
  liveCore: number
  anomalie: number
}

export interface HeroVitals {
  /** Remaining hit points (0 … maxHp). */
  hp: number
  /** Remaining fatigue pool (0 … maxFatigue). */
  fatigue: number
  /** Remaining stress pool (0 … maxStress). */
  stress: number
  /** Remaining mutation-point pool (0 … mutationPointsMax). */
  mutationPoints: number
  /**
   * Max mutation-point pool. Formula is still TBD in system docs,
   * so this is set manually (Settings).
   */
  mutationPointsMax: number
  /** Permanent contamination tracks; total may exceed max (starts Przemiana). */
  contamination: HeroContamination
}

export type MutationOrigin = 'deathNet' | 'liveCore' | 'anomalie'
export type MutationKind = 'fizyczna' | 'mentalna' | 'psioniczna'
export type MutationCharacter = 'pasywna' | 'aktywna'
export type MutationRank = 1 | 2 | 3 | 4

export interface MutationTraitLine {
  name: string
  value: number
  description: string
}

export interface MutationActivationByRank {
  1: string
  2: string
  3: string
  4: string
}

/** Hero mutation stored under games/{gameId}/heroes/{heroId}/mutations. */
export interface HeroMutation {
  id: string
  name: string
  origin: MutationOrigin
  kind: MutationKind
  character: MutationCharacter
  rank: MutationRank
  description: string
  /** Passive mutations: positive traits. */
  atuty: MutationTraitLine[]
  /** Passive mutations: drawbacks. */
  wady: MutationTraitLine[]
  /** Active mutations: free-text activation cost (PM / notes). */
  activationCost: string
  /** Active mutations: effect text per rank. */
  activationByRank: MutationActivationByRank
  resonance: string
  /** Temporary hibernation after Resonance. */
  hibernating: boolean
  sortOrder?: number
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export interface Hero {
  id: string
  ownerId: string
  name: string
  surname: string
  nickname: string
  imageURL: string
  description: string
  /** Species used for the max-HP racial bonus. */
  race: HeroRace
  attributes: Record<string, number>
  skills: Record<string, number>
  /** Current vital pools; maxima are derived from attributes (+ race for HP). */
  vitals: HeroVitals
  sheetVersion: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface GearVisualFields {
  imageUrl: string
  icon: string
  color: string
}

export interface InventoryItem extends GearVisualFields {
  id: string
  name: string
  qty: number
  description: string
  traitIds?: string[]
  traitValues?: GearTraitValues
  sortOrder?: number
  inUse?: boolean
}

export type WeaponType = 'range' | 'melee'

export type GearTraitPolarity = 'positive' | 'negative'

export type GearTraitScopeCategory = 'weapon' | 'armor' | 'gear'

export type GearTraitCategory = GearTraitScopeCategory | 'common'

export interface GearTraitDefinition {
  id: string
  name: string
  polarity: GearTraitPolarity
  description: string
  category: GearTraitCategory
}

/** Per-item trait values keyed by catalog trait id (1–10). */
export type GearTraitValues = Record<string, number>

export interface WeaponItem extends GearVisualFields {
  id: string
  name: string
  description: string
  qty: number
  type: WeaponType
  damageExpression: string
  traitIds?: string[]
  traitValues?: GearTraitValues
  sortOrder?: number
  inUse?: boolean
}

export interface ArmorItem extends GearVisualFields {
  id: string
  name: string
  description: string
  armorValue: number
  traitIds?: string[]
  traitValues?: GearTraitValues
  sortOrder?: number
  inUse?: boolean
}

export interface HeroGalleryImage {
  id: string
  url: string
  caption: string
  source: 'upload' | 'external'
  createdAt: Timestamp
}

export interface HeroChange {
  id: string
  field: string
  label: string
  oldValue: unknown
  newValue: unknown
  changedAt: Timestamp
}

export interface GearTraitChange {
  id: string
  traitId?: string
  traitName: string
  category: GearTraitCategory
  field: string
  label: string
  oldValue: unknown
  newValue: unknown
  changedByUid: string
  changedByName: string
  changedAt: Timestamp
}

/** Snapshot saved before a sheet version migration. Immutable once written. */
export interface HeroSheetBackup {
  id: string
  fromVersion: number
  toVersion: number
  attributes: Record<string, number>
  skills: Record<string, number>
  race?: HeroRace
  vitals?: HeroVitals
  createdAt: Timestamp
}

export interface HeroSheetOutletContext {
  hero: Hero
  gameId: string
  heroId: string
  canEdit: boolean
}
