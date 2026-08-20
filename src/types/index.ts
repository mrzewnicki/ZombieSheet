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
  /** Skill keys pinned on the Combat tab (defaults to Walka category). */
  combatSkillKeys?: string[]
  /** Relationship graph edges (hero↔NPC and NPC↔NPC). */
  npcRelations?: HeroNpcRelation[]
  /** NPC ids placed on this hero's graph even without a relation. */
  npcNodes?: string[]
  /** Manual graph layout, percent coords 0–100. Key is `__hero__` or NPC id. */
  npcPositions?: Record<string, HeroNpcNodePos>
  sheetVersion: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Labeled relationship graph on the hero sheet (hero ↔ NPC and NPC ↔ NPC). */
export type HeroNpcStance = 'ally' | 'enemy' | 'neutral'

export interface HeroNpcNodePos {
  x: number
  y: number
}

export interface HeroNpcRelation {
  id: string
  /** Endpoint A — `__hero__` or campaign NPC id. */
  fromId: string
  /** Endpoint B — `__hero__` or campaign NPC id. */
  toId: string
  label: string
  /** Graph color: ally=green, enemy=red, neutral=gray. Hero node is gold. */
  stance: HeroNpcStance
}

/** Game-wide / campaign NPC (shared catalog; GM manages, players may create). */
export interface CampaignNpc {
  id: string
  name: string
  role: string
  imageURL: string
  /** Optional Game-Icons / RPG Awesome icon when there is no portrait. */
  icon?: string
  notes: string
  /** Creator uid — players may edit their own; GM edits all. */
  createdByUid?: string
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

export type ArmorCategory = 'clothing' | 'supplementary' | 'main'

/** Signed deltas applied to base armor slot limits (e.g. { clothing: 1 }). */
export type ArmorSlotModifiers = Partial<Record<ArmorCategory, number>>

export type GearTraitPolarity = 'positive' | 'negative'

export type GearTraitScopeCategory = 'weapon' | 'armor' | 'gear'

export type GearTraitCategory = GearTraitScopeCategory | 'common'

export interface GearTraitDefinition {
  id: string
  name: string
  polarity: GearTraitPolarity
  description: string
  category: GearTraitCategory
  /**
   * Optional slot deltas while an item with this trait is in use.
   * Positive = more slots, negative = fewer (atuty / wady).
   */
  armorSlotModifiers?: ArmorSlotModifiers
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
  /** Protective category (clothing / supplementary / main). Missing → clothing. */
  category?: ArmorCategory
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

/** Shared settlement card under games/{gameId}/settlement/{id}. */
export type SettlementTraitPolarity = 'positive' | 'negative'

export interface SettlementTraitLine {
  id: string
  name: string
  polarity: SettlementTraitPolarity
  description: string
  value: number
}

export interface SettlementConstructionInstance {
  id: string
  catalogKey: string
  label: string
  /** Position on map as 0–100 percent. */
  x: number
  y: number
  notes: string
  /** Optional marker icon color (CSS hex). */
  iconColor?: string
  /** Optional marker background color (CSS hex). */
  bgColor?: string
  /** Map layer; default objects. */
  layer?: 'background' | 'objects'
}

/** Decorative / terrain marker on the settlement map (not a buildable construction). */
export interface SettlementMapObjectInstance {
  id: string
  catalogKey: string
  label: string
  /** Position on map as 0–100 percent. */
  x: number
  y: number
  notes: string
  iconColor?: string
  bgColor?: string
  /** Map layer; default background. */
  layer?: 'background' | 'objects'
}

/** Undirected path/link between two constructions on the settlement map. */
export type SettlementConnectionLineStyle = 'solid' | 'dashed' | 'dotted' | 'dashDot'
/** Arrow relative to stored fromId → toId (ids are sorted). */
export type SettlementConnectionEndSymbol = 'none' | 'arrowTo' | 'arrowFrom' | 'arrowBoth'

export interface SettlementConnection {
  id: string
  fromId: string
  toId: string
  /** Optional stroke color (CSS hex). Empty = default map path color. */
  color?: string
  /** Stroke pattern. Default solid. */
  lineStyle?: SettlementConnectionLineStyle
  /** Optional arrowhead(s). Default none. */
  endSymbol?: SettlementConnectionEndSymbol
}

/** Neutral settlement character (NPC). */
export interface SettlementNpc {
  id: string
  name: string
  /** Role / function in the settlement (free text). */
  role: string
  /** Assigned construction instance id, or empty if unassigned. */
  constructionId: string
  imageURL: string
  notes: string
  /** When set, this entry was added from the campaign NPC catalog. */
  campaignNpcId?: string
}

export interface SettlementMapSize {
  /** Grid columns (density). */
  width: number
  /** Grid rows (density). */
  height: number
  /** Custom map background (Firebase Storage download URL). */
  backgroundImageURL?: string
  /** Storage path for replace/delete. */
  backgroundStoragePath?: string
  /** Background image opacity 0–100; default 100. */
  backgroundOpacity?: number
  /** Snap markers/vertices to grid cell centers. */
  snapToGrid?: boolean
}

/** User-defined construction entry for this settlement's catalog. */
export interface SettlementCustomConstruction {
  id: string
  name: string
  description: string
  category: string
  complexity: number
  time: number
  /** Optional gear icon value (`gi:…` / `ra:…`). */
  icon?: string
}

/** Filled polygon region on the settlement map. */
export interface SettlementZonePoint {
  x: number
  y: number
}

export interface SettlementZone {
  id: string
  name: string
  /** Polygon vertices in 0–100 map percent. */
  points: SettlementZonePoint[]
  /** Fill / stroke color (CSS hex). */
  color: string
  /** Optional gear icon (`gi:…` / `ra:…`) at the centroid. */
  icon?: string
  iconColor?: string
  /** Map layer; default background. */
  layer?: 'background' | 'objects'
  /** Soften sharp polygon corners when rendering. Default true. */
  smoothCorners?: boolean
}

export interface Settlement {
  id: string
  name: string
  description: string
  materials: Record<string, number>
  constructions: SettlementConstructionInstance[]
  /** Terrain / environment markers (forest, water, etc.). */
  objects: SettlementMapObjectInstance[]
  /** Extra constructions added to this settlement's picker catalog. */
  customConstructions: SettlementCustomConstruction[]
  /** Named filled regions on the map. */
  zones: SettlementZone[]
  connections: SettlementConnection[]
  npcs: SettlementNpc[]
  traits: SettlementTraitLine[]
  map: SettlementMapSize
  updatedAt?: Timestamp
  updatedBy?: string
}

/** Parallel mix buses for session audio. */
export type MusicChannel = 'ambient' | 'music' | 'effects'

export type MusicPlaybackStatus = 'idle' | 'playing' | 'paused'

export type MusicPlaybackSource = 'track' | 'playlist'

export type MusicLoopMode = 'off' | 'track' | 'playlist'

export interface MusicTrack {
  id: string
  name: string
  storagePath: string
  contentType: string
  sizeBytes: number
  durationMs?: number
  /** Normalized amplitude peaks (0–1) along the track for timeline UI. */
  waveformPeaks?: number[]
  /** Whole-track RMS loudness (0–1), used for level matching. */
  loudnessRms?: number
  /** Loop for single-track playback: off | track. */
  loopMode: Exclude<MusicLoopMode, 'playlist'>
  createdBy: string
  createdAt?: Timestamp
}

export interface MusicPlaylist {
  id: string
  name: string
  trackIds: string[]
  /** Loop when this playlist is the playback source: off | playlist (no per-track loop). */
  loopMode: Exclude<MusicLoopMode, 'track'>
  createdBy: string
  createdAt?: Timestamp
}

export interface MusicPlaybackState {
  channel: MusicChannel
  status: MusicPlaybackStatus
  source: MusicPlaybackSource
  trackId: string
  playlistId?: string
  playlistIndex?: number
  loopMode: MusicLoopMode
  /** GM mix level for the current item (0–1). */
  trackVolume: number
  positionMs: number
  startedAt?: Timestamp | null
  updatedBy?: string
  updatedAt?: Timestamp
}

/**
 * Per-channel mix settings.
 * `loudnessTarget` (0–1): match all tracks to this RMS; 0 = matching off.
 */
export interface MusicChannelSettings {
  channel: MusicChannel
  loudnessTarget: number
  updatedBy?: string
  updatedAt?: Timestamp
}

export interface MusicPresence {
  uid: string
  lastSeen?: Timestamp
  displayName?: string
}

