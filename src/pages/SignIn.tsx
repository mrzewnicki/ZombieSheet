import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import Button from '@/components/ui/Button'

export default function SignIn() {
  const { user, signInWithGoogle, devSignIn, authError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/dashboard'

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, navigate, from])

  async function handleSignIn() {
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch {
      // error already surfaced via externalSignInUrl
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-blood/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Logo */}
        <div className="text-center">
          <h1 className="font-heading text-5xl text-ink animate-flicker tracking-widest">
            Zombie<span className="text-blood">Sheet</span>
          </h1>
          <p className="mt-3 text-ink-muted text-sm font-mono uppercase tracking-widest">
            {t('auth.tagline')}
          </p>
        </div>

        {/* Divider */}
        <div className="w-full border-t border-border" />

        {/* Sign in */}
        <Button
          onClick={handleSignIn}
          loading={loading}
          className="w-full py-3 text-base"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {loading ? t('auth.signingIn') : t('auth.signInWithGoogle')}
        </Button>

        {authError && (
          <p className="text-blood text-xs text-center font-mono break-all">{authError}</p>
        )}

        {import.meta.env.DEV && (
          <div className="w-full flex flex-col gap-2 pt-2 border-t border-border">
            <span className="text-ink-faint text-[10px] uppercase tracking-widest text-center">
              dev only
            </span>
            <Button variant="outline" onClick={devSignIn} className="w-full text-xs">
              Zaloguj jako ootexh@gmail.com (dev)
            </Button>
          </div>
        )}

        <p className="text-ink-faint text-xs text-center font-mono">
          © ZombieSheet · Post-apo RPG
        </p>
      </div>
    </div>
  )
}
