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

export interface Hero {
  id: string
  ownerId: string
  name: string
  surname: string
  nickname: string
  imageURL: string
  description: string
  attributes: Record<string, number>
  skills: Record<string, number>
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
}

export interface ArmorItem extends GearVisualFields {
  id: string
  name: string
  description: string
  armorValue: number
  traitIds?: string[]
  traitValues?: GearTraitValues
  sortOrder?: number
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
  createdAt: Timestamp
}

export interface HeroSheetOutletContext {
  hero: Hero
  gameId: string
  heroId: string
  canEdit: boolean
}
