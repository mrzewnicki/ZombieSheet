import type { ChatMessage } from '@/types/chat'

/** Group threshold in milliseconds (5 min) */
export const MESSAGE_GROUP_MS = 5 * 60 * 1000

export interface MessageGroup {
  key: string
  messages: ChatMessage[]
}

export type RenderItem =
  | { type: 'date_separator'; label: string; key: string }
  | { type: 'group'; group: MessageGroup }

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  )
}

export function formatChatDate(d: Date, now: Date = new Date()): string {
  const today = now
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  if (isSameDay(d, today)) return 'Dziś'
  if (isSameDay(d, yesterday)) return 'Wczoraj'
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

export function buildRenderItems(messages: ChatMessage[]): RenderItem[] {
  const items: RenderItem[] = []
  let lastGroupDate: Date | null = null
  let currentGroup: MessageGroup | null = null

  function pushGroup() {
    if (currentGroup && currentGroup.messages.length > 0) {
      items.push({ type: 'group', group: currentGroup })
    }
  }

  for (const msg of messages) {
    const msgDate = msg.sentAt ? msg.sentAt.toDate() : new Date()

    if (!lastGroupDate || !isSameDay(lastGroupDate, msgDate)) {
      pushGroup()
      currentGroup = null
      lastGroupDate = msgDate
      items.push({
        type: 'date_separator',
        label: formatChatDate(msgDate),
        key: `sep-${msgDate.toDateString()}`,
      })
    }

    const lastMsg = currentGroup?.messages[currentGroup.messages.length - 1]
    const lastTs = lastMsg?.sentAt ? lastMsg.sentAt.toMillis() : 0
    const currTs = msg.sentAt ? msg.sentAt.toMillis() : Date.now()
    const sameAuthor = lastMsg?.authorId === msg.authorId
    const closeInTime = currTs - lastTs < MESSAGE_GROUP_MS

    if (sameAuthor && closeInTime && currentGroup) {
      currentGroup.messages.push(msg)
    } else {
      pushGroup()
      currentGroup = { key: msg.id, messages: [msg] }
    }
  }

  pushGroup()
  return items
}
