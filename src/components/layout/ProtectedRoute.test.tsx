import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProtectedRoute from './ProtectedRoute'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/contexts/AuthContext'

const mockUseAuth = vi.mocked(useAuth)

function renderProtected(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>Sign in</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows spinner while loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true } as ReturnType<typeof useAuth>)
    renderProtected()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('redirects to sign-in when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>)
    renderProtected()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('renders child route when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1' },
      loading: false,
    } as ReturnType<typeof useAuth>)
    renderProtected()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
