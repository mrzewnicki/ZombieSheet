import { memberLabel } from '@/types'
import type { GameMember } from '@/types'

/** Collects member UIDs whose @label appears in the message text. */
export function extractMentionUids(text: string, members: GameMember[]): string[] {
  return members
    .filter((m) => text.includes('@' + memberLabel(m)))
    .map((m) => m.uid)
}
