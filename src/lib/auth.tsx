import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { User as AppUser, UserRole } from '../types'

interface AuthState {
  session: Session | null
  profile: AppUser | null
  loading: boolean
  isAdmin: boolean
  isManager: boolean
  isViewer: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(authId: string): Promise<AppUser | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle()
  return (data as AppUser | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen for auth changes — DO NOT await Supabase calls here.
  // (Supabase docs: awaiting in onAuthStateChange can deadlock.)
  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  // Fetch profile whenever the user id changes
  useEffect(() => {
    const uid = session?.user?.id
    if (!uid) return

    let cancelled = false
    setLoading(true)
    fetchProfile(uid).then(p => {
      if (cancelled) return
      setProfile(p)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [session?.user?.id])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (session?.user?.id) {
      const p = await fetchProfile(session.user.id)
      setProfile(p)
    }
  }

  const role: UserRole | undefined = profile?.role
  const value: AuthState = {
    session,
    profile,
    loading,
    isAdmin: role === 'admin',
    isManager: role === 'admin' || role === 'manager',
    isViewer: !!role,
    signIn,
    signOut,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
