import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useGameRole } from './useGameRole'

const onSnapshotCallback = vi.hoisted(() => ({ current: null as ((snap: unknown) => void) | null }))

vi.mock('@/config/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({})),
  onSnapshot: vi.fn((_ref, callback) => {
    onSnapshotCallback.current = callback
    return vi.fn()
  }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/AuthContext'

const mockUseAuth = vi.mocked(useAuth)

describe('useGameRole', () => {
  it('returns null role when user is missing', async () => {
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>)
    const { result } = renderHook(() => useGameRole('game-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBeNull()
  })

  it('reads role from member snapshot', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' } } as ReturnType<typeof useAuth>)
    const { result } = renderHook(() => useGameRole('game-1'))

    onSnapshotCallback.current?.({
      exists: () => true,
      data: () => ({ role: 'gm' }),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBe('gm')
  })

  it('returns null when member doc is missing', async () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' } } as ReturnType<typeof useAuth>)
    const { result } = renderHook(() => useGameRole('game-1'))

    onSnapshotCallback.current?.({
      exists: () => false,
      data: () => ({}),
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.role).toBeNull()
  })
})
