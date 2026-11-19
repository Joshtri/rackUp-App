import { createContext, useContext } from 'react'
import type { AuthSession, User } from './api/auth'

/** Why the user was sent to the login page; shown as a message there. */
export type LogoutReason = 'logout' | 'expired' | 'session'

export type AuthState =
  /** Checking the stored token with the server. */
  | { status: 'checking'; session: AuthSession }
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'anonymous'; reason?: LogoutReason }

export type AuthApi = {
  state: AuthState
  /** Logged-in account, or null. */
  user: User | null
  /** Throws ApiError (invalid_credentials, account_expired, network...). */
  login: (username: string, password: string) => Promise<void>
  logout: (reason?: LogoutReason) => void
}

export const AuthContext = createContext<AuthApi | null>(null)

export function useAuth() {
  const api = useContext(AuthContext)
  if (!api) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return api
}

// ---- Stored session ----
// localStorage, because the API lives on another domain and authenticates
// with a bearer token (no cookies). See docs/AUTH.md for the trade-off.

export const SESSION_KEY = 'rackup:session:v1'

function isSession(v: unknown): v is AuthSession {
  const s = v as AuthSession | null
  return (
    !!s &&
    typeof s.token === 'string' &&
    Number.isFinite(s.expiresAt) &&
    typeof s.user?.username === 'string' &&
    Number.isFinite(s.user?.expiresAt)
  )
}

export function loadAuthSession(): AuthSession | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null')
    return isSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveAuthSession(session: AuthSession | null) {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Storage blocked: the session lasts until the tab closes.
  }
}

/** When the session stops working: the token's or the account's expiry, whichever is first. */
export const sessionEnd = (s: AuthSession) => Math.min(s.expiresAt, s.user.expiresAt)

/** Reason to show when a session ends on its own. */
export const endReason = (s: AuthSession, now = Date.now()): LogoutReason =>
  s.user.expiresAt <= now ? 'expired' : 'session'
