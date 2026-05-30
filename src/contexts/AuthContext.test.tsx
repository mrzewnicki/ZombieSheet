import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from './AuthContext'

const authStateCallback = vi.hoisted(() => ({ current: null as ((user: unknown) => void) | null }))

vi.mock('@/config/firebase', () => ({
  auth: {},
  db: {},
  googleProvider: {},
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, callback) => {
    authStateCallback.current = callback
    return vi.fn()
  }),
  signInWithPopup: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
}))

function AuthProbe() {
  const { user, loading } = useAuth()
  if (loading) return <div>loading</div>
  return <div>{user ? `user:${user.uid}` : 'anonymous'}</div>
}

describe('AuthProvider', () => {
  it('exposes authenticated user after auth state resolves', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()

    authStateCallback.current?.({ uid: 'user-1', displayName: 'Test', email: 't@test.com', photoURL: '' })

    await waitFor(() => {
      expect(screen.getByText('user:user-1')).toBeInTheDocument()
    })
  })

  it('exposes anonymous state when signed out', async () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    )

    authStateCallback.current?.(null)

    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeInTheDocument()
    })
  })
})
