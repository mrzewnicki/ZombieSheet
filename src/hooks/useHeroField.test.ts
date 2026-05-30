import { describe, expect, it, vi } from 'vitest'
import { useHeroField } from './useHeroField'

const batchUpdate = vi.fn()
const batchSet = vi.fn()
const batchCommit = vi.fn().mockResolvedValue(undefined)

vi.mock('@/config/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  collection: vi.fn((_db: unknown, ...segments: string[]) => ({ path: segments.join('/') })),
  writeBatch: vi.fn(() => ({
    update: batchUpdate,
    set: batchSet,
    commit: batchCommit,
  })),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}))

describe('useHeroField', () => {
  it('writes hero field update and audit change in one batch', async () => {
    const { updateField } = useHeroField('game-1', 'hero-1')
    await updateField('skills.stealth', 'Stealth', 3, 1)

    expect(batchUpdate).toHaveBeenCalledWith(
      { path: 'games/game-1/heroes/hero-1' },
      { 'skills.stealth': 3, updatedAt: 'SERVER_TS' },
    )
    expect(batchSet).toHaveBeenCalledWith(
      expect.anything(),
      {
        field: 'skills.stealth',
        label: 'Stealth',
        oldValue: 1,
        newValue: 3,
        changedAt: 'SERVER_TS',
      },
    )
    expect(batchCommit).toHaveBeenCalled()
  })
})
