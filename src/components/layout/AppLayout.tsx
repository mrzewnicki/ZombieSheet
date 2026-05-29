import { ReactNode } from 'react'
import logoUrl from '/logo.png'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import Avatar from '@/components/ui/Avatar'

interface Props {
  children: ReactNode
  backTo?: string
  backLabel?: string
  title?: string
  actions?: ReactNode
}

export default function AppLayout({ children, backTo, backLabel, title, actions }: Props) {
  const { user, signOut } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-dark text-ink font-body">
      {/* Top bar */}
      <header className="border-b border-border bg-void sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-1 group/logo">
            <img src={logoUrl} alt="ZombieSheet" className="h-8 w-8 object-contain" />
            <span className="font-heading text-xl text-blood-light group-hover/logo:text-blood transition-colors animate-flicker">
              Sheet
            </span>
          </Link>

          {backTo && (
            <>
              <span className="text-ink-faint">/</span>
              <button
                onClick={() => navigate(backTo)}
                className="text-ink-muted hover:text-ink text-sm transition-colors"
              >
                {backLabel ?? t('common.back')}
              </button>
            </>
          )}

          {title && (
            <>
              <span className="text-ink-faint">/</span>
              <span className="text-ink text-sm truncate">{title}</span>
            </>
          )}

          <div className="ml-auto flex items-center gap-3">
            {actions}
            {user && (
              <div className="flex items-center gap-2">
                <Avatar
                  src={user.photoURL}
                  name={user.displayName ?? user.email}
                  className="w-7 h-7 border border-border"
                />
                <button
                  onClick={handleSignOut}
                  className="text-xs text-ink-muted hover:text-blood transition-colors"
                >
                  {t('auth.signOut')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
