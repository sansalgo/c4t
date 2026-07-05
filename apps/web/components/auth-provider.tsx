"use client"

import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api } from "@/lib/api"
import { type AuthUser } from "@/lib/auth"

interface MeResponse {
  id: string
  displayName: string
  email?: string
  memberships: Array<{ familyId: string; role: string }>
}

interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (user: AuthUser) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    api
      .get<MeResponse>('/auth/me')
      .then((me) => {
        const m = me.memberships[0]
        if (m) {
          setUser({ userId: me.id, familyId: m.familyId, role: m.role as AuthUser['role'], displayName: me.displayName, email: me.email })
        }
      })
      .catch(() => {
        // 401 = not logged in — stay null
      })
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback((authUser: AuthUser) => {
    setUser(authUser)
    // authUser from a fresh login/signup only has JWT claims (no displayName/email) — enrich it now.
    api
      .get<MeResponse>('/auth/me')
      .then((me) => {
        const m = me.memberships[0]
        if (m) {
          setUser({ userId: me.id, familyId: m.familyId, role: m.role as AuthUser['role'], displayName: me.displayName, email: me.email })
        }
      })
      .catch(() => {})
  }, [])

  const logout = useCallback(async () => {
    await api.post('/auth/logout').catch(() => null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
