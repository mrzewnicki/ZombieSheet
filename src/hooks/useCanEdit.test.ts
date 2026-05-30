import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCanEdit } from './useCanEdit'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('./useGameRole', () => ({
  useGameRole: vi.fn(),
}))

import { useAuth } from '@/contexts/AuthContext'
import { useGameRole } from './useGameRole'

const mockUseAuth = vi.mocked(useAuth)
const mockUseGameRole = vi.mocked(useGameRole)

describe('useCanEdit', () => {
  it('returns false when user is missing', () => {
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>)
    mockUseGameRole.mockReturnValue({ role: 'player', loading: false })
    const { result } = renderHook(() => useCanEdit('g1', 'hero-owner'))
    expect(result.current).toBe(false)
  })

  it('returns false when role is missing', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'u1' } } as ReturnType<typeof useAuth>)
    mockUseGameRole.mockReturnValue({ role: null, loading: false })
    const { result } = renderHook(() => useCanEdit('g1', 'hero-owner'))
    expect(result.current).toBe(false)
  })

  it('returns true for GM regardless of hero owner', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'gm1' } } as ReturnType<typeof useAuth>)
    mockUseGameRole.mockReturnValue({ role: 'gm', loading: false })
    const { result } = renderHook(() => useCanEdit('g1', 'other-owner'))
    expect(result.current).toBe(true)
  })

  it('returns true for player editing own hero', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'p1' } } as ReturnType<typeof useAuth>)
    mockUseGameRole.mockReturnValue({ role: 'player', loading: false })
    const { result } = renderHook(() => useCanEdit('g1', 'p1'))
    expect(result.current).toBe(true)
  })

  it('returns false for player editing another hero', () => {
    mockUseAuth.mockReturnValue({ user: { uid: 'p1' } } as ReturnType<typeof useAuth>)
    mockUseGameRole.mockReturnValue({ role: 'player', loading: false })
    const { result } = renderHook(() => useCanEdit('g1', 'p2'))
    expect(result.current).toBe(false)
  })
})
