import { describe, expect, it } from 'vitest'
import type { GameMember } from '@/types'
import { extractMentionUids } from './chatMentions'

const members: GameMember[] = [
  {
    uid: 'u1',
    role: 'gm',
    displayName: 'Alice',
    nick: 'Ace',
    photoURL: '',
    joinedAt: {} as GameMember['joinedAt'],
  },
  {
    uid: 'u2',
    role: 'player',
    displayName: 'Bob',
    photoURL: '',
    joinedAt: {} as GameMember['joinedAt'],
  },
]

describe('extractMentionUids', () => {
  it('returns UIDs for mentioned members by nick label', () => {
    expect(extractMentionUids('Hello @Ace', members)).toEqual(['u1'])
  })

  it('returns multiple UIDs when several mentions match', () => {
    expect(extractMentionUids('@Ace and @Bob please', members)).toEqual(['u1', 'u2'])
  })

  it('uses displayName when member has no nick', () => {
    expect(extractMentionUids('Hi @Bob', members)).toEqual(['u2'])
  })

  it('returns empty when no mentions match', () => {
    expect(extractMentionUids('no mentions here', members)).toEqual([])
  })
})
