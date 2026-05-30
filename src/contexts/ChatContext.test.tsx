import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatProvider, useChatContext } from './ChatContext'

const { addDoc } = vi.hoisted(() => ({
  addDoc: vi.fn().mockResolvedValue({ id: 'msg-1' }),
}))

vi.mock('@/config/features', () => ({
  FEATURES: { chat: true, chatInput: true },
}))

vi.mock('@/config/firebase', () => ({
  db: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  orderBy: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  addDoc,
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn((_ref, callback) => {
    callback({ docs: [] })
    return vi.fn()
  }),
  serverTimestamp: vi.fn(() => 'SERVER_TS'),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'u1', displayName: 'Alice', email: 'a@test.com', photoURL: '' },
  })),
}))

describe('useChatContext', () => {
  it('sendMessage writes a trimmed message document', async () => {
    const { result } = renderHook(() => useChatContext(), {
      wrapper: ({ children }) => <ChatProvider gameId="game-1">{children}</ChatProvider>,
    })

    await waitFor(() => expect(result.current.loading).toBe(false))

    await result.current.sendMessage('  Hello team  ', { gmOnly: true, mentions: ['u2'] })

    expect(addDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        authorId: 'u1',
        content: 'Hello team',
        gmOnly: true,
        mentions: ['u2'],
        sentAt: 'SERVER_TS',
      }),
    )
  })
})
