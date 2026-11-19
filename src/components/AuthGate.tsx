import CircularProgress from '@mui/material/CircularProgress'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { LOGIN_PATH } from '../lib/config'
import { navigate, useLocation } from '../lib/router'
import { LoginPage } from './LoginPage'
import { NotFound } from './NotFound'

/**
 * Route guard. Every path except the hidden login page needs a valid session.
 * - Visitors who were never logged in on this device get a plain 404, so the
 *   login page stays hidden; only people sent the link can reach it.
 * - Someone whose session just ended (logout, expired) already knows the link
 *   and is taken back to the login page with the reason.
 * - A logged-in user who opens the login page goes back to the app.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useAuth()
  const { pathname } = useLocation()
  const onLoginPage = pathname === LOGIN_PATH
  const endedReason = state.status === 'anonymous' ? state.reason : undefined

  useEffect(() => {
    if (onLoginPage && state.status === 'authenticated') {
      navigate('/', { replace: true })
    } else if (!onLoginPage && endedReason) {
      navigate(`${LOGIN_PATH}?reason=${endedReason}`, { replace: true })
    }
  }, [onLoginPage, state.status, endedReason])

  if (onLoginPage) return state.status === 'anonymous' ? <LoginPage /> : null
  if (state.status === 'checking') {
    return (
      <div className="auth-loading" role="status">
        <CircularProgress size={32} />
        <span>Memeriksa sesi…</span>
      </div>
    )
  }
  if (state.status === 'anonymous') return endedReason ? null : <NotFound />
  return children
}
