import { useEffect } from 'react'
import { EightBall } from './icons'

/**
 * Shown to visitors without a session. Deliberately looks like a dead page and
 * doesn't mention or link the login page: only people sent the link can log in.
 */
export function NotFound() {
  useEffect(() => {
    document.title = '404 · Halaman tidak ditemukan'
    return () => {
      document.title = 'RackUp'
    }
  }, [])

  return (
    <main className="not-found">
      <EightBall className="empty__ball" />
      <h1>404</h1>
      <p>Halaman tidak ditemukan.</p>
    </main>
  )
}
