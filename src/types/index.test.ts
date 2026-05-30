import { describe, expect, it } from 'vitest'
import { heroFullName, memberLabel } from './index'

describe('memberLabel', () => {
  it('prefers trimmed nick over displayName', () => {
    expect(memberLabel({ nick: '  Ace ', displayName: 'Alice' })).toBe('Ace')
  })

  it('falls back to displayName when nick is empty', () => {
    expect(memberLabel({ nick: '   ', displayName: 'Alice' })).toBe('Alice')
  })

  it('uses displayName when nick is absent', () => {
    expect(memberLabel({ displayName: 'Alice' })).toBe('Alice')
  })
})

describe('heroFullName', () => {
  it('joins name and surname', () => {
    expect(heroFullName({ name: 'Jan', surname: 'Kowalski' })).toBe('Jan Kowalski')
  })

  it('returns fallback when both fields are empty', () => {
    expect(heroFullName({ name: '', surname: '' })).toBe('—')
    expect(heroFullName({ name: '', surname: '' }, 'Unknown')).toBe('Unknown')
  })
})
