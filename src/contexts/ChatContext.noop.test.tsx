import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/config/features', () => ({
  FEATURES: { chat: false, chatInput: false },
}))

const { addDoc } = vi.hoisted(() => ({
  addDoc: vi.fn(),
}))

vi.mock('@/config/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc,
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ user: { uid: 'u1' } })),
}))

import { useChatContext } from './ChatContext'

describe('useChatContext when chat is disabled', () => {
  it('uses NOOP sendMessage without calling Firestore', async () => {
    const { result } = renderHook(() => useChatContext())
    await result.current.sendMessage('hello')
    expect(addDoc).not.toHaveBeenCalled()
  })
})
