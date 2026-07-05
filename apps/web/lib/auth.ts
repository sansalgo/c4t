import type { MemberRole } from '@workspace/types'

export interface JwtPayload {
  sub: string
  familyId: string | null
  role: MemberRole | null
  iat: number
  exp: number
}

export interface AuthUser {
  userId: string
  familyId: string | null
  role: MemberRole | null
  displayName?: string
  email?: string
}

export function parseToken(token: string): AuthUser | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const decoded = JSON.parse(
      decodeURIComponent(
        json
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      ),
    ) as JwtPayload

    if (!decoded.sub) return null
    if (decoded.exp * 1000 < Date.now()) return null

    return { userId: decoded.sub, familyId: decoded.familyId, role: decoded.role }
  } catch {
    return null
  }
}
