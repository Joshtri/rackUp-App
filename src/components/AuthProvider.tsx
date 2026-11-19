import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type AuthSession } from '../lib/api/auth'
import { ApiError, setAuthToken, setUnauthorizedHandler } from '../lib/api/client'
import {
  AuthContext,
  SESSION_KEY,
  endReason,
  loadAuthSession,
  saveAuthSession,
  sessionEnd,
  type AuthApi,
  type AuthState,
  type LogoutReason,
} from '../lib/auth'

const DAY_MS = 86_400_000

function persist(session: AuthSession | null) {
  saveAuthSession(session)
  setAuthToken(session?.token ?? null)
}

/** Restores the stored session; drops it right away if it has already ended. */
function initialState(): AuthState {
  const stored = loadAuthSession()
  if (!stored) return { status: 'anonymous' }
  if (sessionEnd(stored) <= Date.now()) {
    persist(null)
    return { status: 'anonymous', reason: endReason(stored) }
  }
  setAuthToken(stored.token)
  return { status: 'checking', session: stored }
}

/**
 * Owns the login session: restores it on load, checks it with the server,
 * logs out automatically when the token or the account expires, and when any
 * API call comes back 401.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialState)

  const logout = useCallback((reason: LogoutReason = 'logout') => {
    persist(null)
    setState({ status: 'anonymous', reason })
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const session = await authApi.login(username.trim(), password)
    persist(session)
    setState({ status: 'authenticated', session })
  }, [])

  // Any API call refused with 401 ends the session.
  useEffect(() => {
    setUnauthorizedHandler((err) => logout(err.code === 'account_expired' ? 'expired' : 'session'))
  }, [logout])

  // Validate a restored token with the server before showing the app.
  const checking = state.status === 'checking' ? state.session : null
  useEffect(() => {
    if (!checking) return
    const ctrl = new AbortController()
    authApi
      .me(ctrl.signal)
      .then((user) => {
        // Fresh account data, e.g. a new expiry after the admin renewed it.
        const session = { ...checking, user }
        persist(session)
        setState({ status: 'authenticated', session })
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        // 401 is handled by the unauthorized handler (→ logout).
        if (err instanceof ApiError && err.status === 401) return
        // Offline or server down: trust the stored session until it expires,
        // so the shot clock still works without a connection.
        setState({ status: 'authenticated', session: checking })
      })
    return () => ctrl.abort()
  }, [checking])

  // Auto logout when the session ends. Timers are capped at a day because
  // setTimeout can't wait 30 days, and re-checked when the tab comes back
  // (timers don't run while a phone sleeps).
  const active = state.status === 'anonymous' ? null : state.session
  useEffect(() => {
    if (!active) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const check = () => {
      clearTimeout(timer)
      const left = sessionEnd(active) - Date.now()
      if (left <= 0) logout(endReason(active))
      else timer = setTimeout(check, Math.min(left, DAY_MS))
    }
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, logout])

  // Logging in or out in one tab does the same in the others.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SESSION_KEY) return
      const session = loadAuthSession()
      setAuthToken(session?.token ?? null)
      setState(session ? { status: 'authenticated', session } : { status: 'anonymous', reason: 'logout' })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const api = useMemo<AuthApi>(
    () => ({
      state,
      user: state.status === 'anonymous' ? null : state.session.user,
      login,
      logout,
    }),
    [state, login, logout],
  )

  return <AuthContext value={api}>{children}</AuthContext>
}
