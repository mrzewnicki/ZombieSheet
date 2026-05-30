import { Timestamp } from 'firebase/firestore'

export type ContextRefType = 'dice_roll' | 'character_event'

export interface ContextRef {
  type: ContextRefType
  heroId: string
  heroName: string
  data: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  authorId: string
  authorDisplayName: string
  authorPhotoURL: string
  content: string
  sentAt: Timestamp
  gmOnly: boolean
  mentions: string[]
  contextRef?: ContextRef
}
