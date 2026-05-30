import { Timestamp } from 'firebase/firestore'

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

export interface InventoryItem {
  id: string
  name: string
  qty: number
  description: string
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

export interface HeroSheetOutletContext {
  hero: Hero
  gameId: string
  heroId: string
  canEdit: boolean
}
