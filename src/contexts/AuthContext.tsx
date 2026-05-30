import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  User, onAuthStateChanged, signInWithPopup,
  signInWithEmailAndPassword, signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '@/config/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  authError: string | null
  signInWithGoogle: () => Promise<void>
  devSignIn: () => Promise<void>
  signOut: () => Promise<void>
}

/** Dev-only credentials, gated behind import.meta.env.DEV so they are stripped from production builds. */
const DEV_EMAIL = 'ootexh@gmail.com'
const DEV_PASSWORD = 'devdev123'

function getErrorMessage(err: unknown): string {
  return (err as { message?: string }).message ?? String(err)
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function persistUser(firebaseUser: User) {
  await setDoc(
    doc(db, 'users', firebaseUser.uid),
    {
      uid: firebaseUser.uid,
      displayName: firebaseUser.displayName ?? '',
      email: firebaseUser.email ?? '',
      photoURL: firebaseUser.photoURL ?? '',
    },
    { merge: true }
  )
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) await persistUser(firebaseUser)
      setLoading(false)
    })
    return unsub
  }, [])

  async function signInWithGoogle() {
    setAuthError(null)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await persistUser(result.user)
    } catch (err: unknown) {
      console.error('[Auth] signIn error:', err)
      setAuthError(getErrorMessage(err))
    }
  }

  async function devSignIn() {
    setAuthError(null)
    try {
      const result = await signInWithEmailAndPassword(auth, DEV_EMAIL, DEV_PASSWORD)
      await persistUser(result.user)
    } catch (err: unknown) {
      console.error('[Auth] dev signIn error:', err)
      setAuthError(getErrorMessage(err))
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, signInWithGoogle, devSignIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
