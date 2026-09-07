import React, { ReactNode, useCallback, useContext } from 'react'
import crackedTextureUrl from '@/assets/cracked-texture.jpg'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { LayoutContext } from '@/contexts/LayoutContext'
import Avatar from '@/components/ui/Avatar'
import AppFooter from './AppFooter'

interface Props {
  children: ReactNode
}

export default function AppLayout({ children }: Props) {
  const { user, signOut } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ctx = useContext(LayoutContext)
  const { backTo, backLabel, title, actions } = ctx?.header ?? {}
  const fullWidth = ctx?.fullWidth ?? false
  const logoUrl = `${import.meta.env.BASE_URL}logo.png`

  const headerCenterRef = useCallback((el: HTMLDivElement | null) => {
    ctx?.setHeaderCenterEl(el)
  }, [ctx])

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div
      className="min-h-screen flex flex-col bg-dark bg-cracked text-ink font-body"
      style={{ '--cracked-texture-url': `url(${crackedTextureUrl})` } as React.CSSProperties}
    >
      <header className="border-b border-border bg-void sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link to="/dashboard" className="flex items-center gap-1 group/logo shrink-0">
            <img src={logoUrl} alt="ZombieSheet" className="h-8 w-8 object-contain" />
            <span className="font-heading text-xl text-blood-light group-hover/logo:text-blood transition-colors animate-flicker">
              Sheet
            </span>
          </Link>

          {backTo && (
            <>
              <span className="text-ink-faint shrink-0">/</span>
              <button
                onClick={() => navigate(backTo)}
                className="text-ink-muted hover:text-ink text-sm transition-colors shrink-0"
              >
                {backLabel ?? t('common.back')}
              </button>
            </>
          )}

          {title && (
            <>
              <span className="text-ink-faint shrink-0">/</span>
              <span className="text-ink text-sm truncate shrink min-w-0 max-w-[10rem] sm:max-w-[14rem]">{title}</span>
            </>
          )}

          <div ref={headerCenterRef} className="flex-1 min-w-0 flex items-center justify-center gap-3 px-2" />

          <div className="ml-auto flex items-center gap-3 shrink-0">
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

      <main className={`flex-1 py-6 transition-all duration-200 ${
        fullWidth ? 'w-full' : 'max-w-5xl mx-auto px-4'
      }`}>
        {children}
      </main>

      <AppFooter />
    </div>
  )
}
