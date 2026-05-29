import { useAuth } from '@/contexts/AuthContext'
import { useGameRole } from './useGameRole'

/**
 * Returns true when the current user may edit the given hero.
 * GMs can edit any hero; players can only edit their own.
 */
export function useCanEdit(gameId: string, heroOwnerId: string): boolean {
  const { user } = useAuth()
  const { role } = useGameRole(gameId)

  if (!user || !role) return false
  if (role === 'gm') return true
  return user.uid === heroOwnerId
}
