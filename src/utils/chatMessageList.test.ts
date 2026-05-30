import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '@/types/chat'
import { buildRenderItems, formatChatDate, isSameDay, MESSAGE_GROUP_MS } from './chatMessageList'

function ts(date: Date) {
  return {
    toDate: () => date,
    toMillis: () => date.getTime(),
  } as ChatMessage['sentAt']
}

function msg(
  id: string,
  authorId: string,
  sentAt: Date,
  overrides: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    authorId,
    authorDisplayName: authorId,
    authorPhotoURL: '',
    content: 'hi',
    sentAt: ts(sentAt),
    gmOnly: false,
    mentions: [],
    ...overrides,
  }
}

describe('isSameDay', () => {
  it('compares calendar days', () => {
    expect(isSameDay(new Date('2026-05-30T08:00'), new Date('2026-05-30T22:00'))).toBe(true)
    expect(isSameDay(new Date('2026-05-30'), new Date('2026-05-31'))).toBe(false)
  })
})

describe('formatChatDate', () => {
  it('labels today and yesterday relative to now', () => {
    const now = new Date('2026-05-30T12:00:00')
    expect(formatChatDate(new Date('2026-05-30T08:00'), now)).toBe('Dziś')
    expect(formatChatDate(new Date('2026-05-29T08:00'), now)).toBe('Wczoraj')
  })
})

describe('buildRenderItems', () => {
  it('inserts date separators when the day changes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-30T12:00:00'))

    const items = buildRenderItems([
      msg('1', 'a', new Date('2026-05-29T10:00')),
      msg('2', 'a', new Date('2026-05-30T10:00')),
    ])

    expect(items.filter((i) => i.type === 'date_separator')).toHaveLength(2)
    vi.useRealTimers()
  })

  it('groups consecutive messages from the same author within 5 minutes', () => {
    const base = new Date('2026-05-30T10:00:00')
    const items = buildRenderItems([
      msg('1', 'a', base),
      msg('2', 'a', new Date(base.getTime() + MESSAGE_GROUP_MS - 1000)),
    ])

    const groups = items.filter((i) => i.type === 'group')
    expect(groups).toHaveLength(1)
    if (groups[0].type === 'group') {
      expect(groups[0].group.messages).toHaveLength(2)
    }
  })

  it('starts a new group when authors differ', () => {
    const base = new Date('2026-05-30T10:00:00')
    const items = buildRenderItems([
      msg('1', 'a', base),
      msg('2', 'b', new Date(base.getTime() + 1000)),
    ])

    const groups = items.filter((i) => i.type === 'group')
    expect(groups).toHaveLength(2)
  })
})
